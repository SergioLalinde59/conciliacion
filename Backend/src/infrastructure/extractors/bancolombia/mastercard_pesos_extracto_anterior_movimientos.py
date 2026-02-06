"""
Extractor de movimientos individuales para MasterCard Pesos Bancolombia (FORMATO ANTIGUO).
Lee PDFs de extracto y extrae cada transacción.
Valida estrictamente que la página contenga el encabezado "ESTADO DE CUENTA PESOS" (sin espacios).
"""
import pdfplumber
import re
from typing import List, Dict, Any
from decimal import Decimal
from datetime import datetime
import logging

# Configurar logger
logger = logging.getLogger("app_logger")

def extraer_movimientos(file_obj: Any) -> List[Dict[str, Any]]:
    """
    Extrae los movimientos individuales de un extracto MasterCard Pesos (FORMATO ANTIGUO).
    
    Retorna: Lista de diccionarios con las claves:
        - fecha (date)
        - descripcion (str)
        - referencia (str)
        - valor (Decimal)
        - numero_linea (int)
        - raw_text (str)
    """
    movimientos = []
    
    try:
        with pdfplumber.open(file_obj) as pdf:
            numero_linea = 0
            
            for page_num, page in enumerate(pdf.pages, 1):
                texto = page.extract_text()
                if not texto:
                    continue
                
                # Validación estricta de encabezado para asegurar que es sección PESOS
                # Eliminamos espacios y saltos de línea para verificar
                texto_normalizado = texto.replace(" ", "").replace("\n", "")
                
                # DEBUG: Ver qué texto se está validando
                if page_num == 1:
                    logger.info(f"DEBUG HEADER: Texto normalizado inicio: {texto_normalizado[:100]}")

                # Detectar sección PESOS - múltiples variantes:
                # 1. "ESTADO DE CUENTA PESOS" (sin EN:)
                # 2. "ESTADO DE CUENTA EN: PESOS" (con EN:)
                # 3. "Moneda: PESOS" (en resumen, con posibles caracteres triplicados)
                es_seccion_pesos = (
                    "ESTADODECUENTAPESOS" in texto_normalizado or
                    "ESTADODECUENTAEN:PESOS" in texto_normalizado or
                    "CUENTAEN:PESOS" in texto_normalizado or
                    ("ESTADODECUENTA" in texto_normalizado and "PESOS" in texto_normalizado)
                )

                # Evitar páginas de DOLARES
                es_seccion_dolares = "DOLARES" in texto_normalizado or "DDDOOOLLLAAARRREEESSS" in texto_normalizado

                if not es_seccion_pesos or es_seccion_dolares:
                    logger.debug(f"Página {page_num}: No es sección PESOS o es DOLARES. Saltando.")
                    continue
                
                logger.info(f"Página {page_num}: Sección PESOS detectada. Procesando movimientos...")
                
                movs_pagina = _extraer_movimientos_desde_texto(texto, numero_linea)
                movimientos.extend(movs_pagina)
                numero_linea += len(movs_pagina)
                
    except Exception as e:
        logger.error(f"Error al leer movimientos del PDF MasterCard Pesos (Antiguo): {e}")
        # Importante: No re-lanzar excepción para permitir que otros extractores intenten si este falla
        # raise Exception(f"Error al leer movimientos del PDF MasterCard Pesos (Antiguo): {e}")
        return []
    
    logger.info(f"Total movimientos encontrados en MasterCard Pesos (Antiguo): {len(movimientos)}")
    return movimientos

def _extraer_movimientos_desde_texto(texto: str, offset_linea: int) -> List[Dict[str, Any]]:
    """
    Extrae movimientos desde el texto de una página del PDF.

    Estrategia mejorada para evitar que números al final de descripciones
    se confundan con valores:
    1. Identificar líneas que empiezan con (opcional código) + fecha
    2. Buscar el valor monetario desde el final de la línea
    3. Todo lo que está entre fecha y valor es descripción
    """
    movimientos = []
    lineas = texto.split('\n')

    # Dos patrones explícitos para mayor robustez:
    # Patrón 1: CON código de autorización (ej: T00661 27/01/2026 APPLE.COM/BILL $ 3,55)
    # Patrón 2: SIN código, fecha directa (ej: 31/01/2026 INTERESES CORRIENTES $ 33,175.52)
    patron_con_codigo = re.compile(
        r'^\s*([A-Z][A-Z0-9]*)\s+(\d{1,2}\s*/\s*\d{1,2}\s*/\s*\d{4})\s+(.+)$'
    )
    patron_sin_codigo = re.compile(
        r'^\s*(\d{1,2}\s*/\s*\d{1,2}\s*/\s*\d{4})\s+(.+)$'
    )

    # Regex para encontrar valor monetario (puede tener $ o no, puede tener - al final)
    # Busca el ÚLTIMO número con formato monetario en la línea
    patron_valor = re.compile(r'([-]?\$?\s*[-]?[\d]+[,.][\d.,]+(?:\s*-)?)(?:\s|$)')

    for i, linea in enumerate(lineas):
        linea = linea.strip()
        if not linea:
            continue

        # Intentar primero con código, luego sin código
        inicio_match = patron_con_codigo.search(linea)
        if inicio_match:
            # Con código: group(1)=código, group(2)=fecha, group(3)=resto
            fecha_str = inicio_match.group(2).replace(" ", "")
            resto = inicio_match.group(3)
        else:
            inicio_match = patron_sin_codigo.search(linea)
            if not inicio_match:
                continue
            # Sin código: group(1)=fecha, group(2)=resto
            fecha_str = inicio_match.group(1).replace(" ", "")
            resto = inicio_match.group(2)

        # Buscar todos los valores en el resto y tomar el primero (el valor original)
        valor_matches = list(patron_valor.finditer(resto))
        if not valor_matches:
            continue

        # Tomar el primer match (valor original, no el saldo)
        valor_match = valor_matches[0]
        valor_str = valor_match.group(1)
        # Todo lo que está ANTES del valor es la descripción
        descripcion = resto[:valor_match.start()].strip()

        # Filtros adicionales para evitar falsos positivos (como encabezados repetidos)
        if "Fecha" in fecha_str or "Transacción" in descripcion:
            continue

        try:
            # Formato DD/MM/YYYY
            fecha = datetime.strptime(fecha_str, '%d/%m/%Y').date()

            # Parsear valor
            # Lógica de signo:
            # Si es Abono (tiene menos al final o es negativo), debería sumar saldo (positivo).
            # Si es Compra (positivo), debería restar saldo (negativo).
            # PERO la lógica solicitada para este extractor fue: "Multiplicar por -1".
            # Asumimos que el PDF muestra Compras como Positivo y Abonos como Negativo (con - al final).
            # Si PDF: 3,532.89 (Compra) -> * -1 -> -3,532.89 (Resta saldo). CORRECTO.
            # Si PDF: 7,600,000- (Abono) -> * -1 -> ??
            # Necesitamos parsear el negativo correctamente primero.

            valor_raw = _parsear_valor_formato_col(valor_str)

            # Aplicar inversión de signo global requrida para este extracto
            valor = valor_raw * Decimal(-1)

            movimientos.append({
                'fecha': fecha,
                'descripcion': descripcion,
                'referencia': '',
                'valor': valor,
                'numero_linea': offset_linea + len(movimientos) + 1,
                'raw_text': linea
            })
        except Exception as e:
            logger.warning(f"Error parseando linea '{linea}': {e}")
            continue
        else:
            # DEBUG: Logear líneas que NO matchean pero parecen tener fecha, para diagnosticar
            if "/" in linea and len(linea) > 20 and i < 20: # Solo primeras lineas para no spam
                 logger.debug(f"DEBUG NO MATCH: '{linea}'")

    return movimientos

def _parsear_valor_formato_col(valor_str: str) -> Decimal:
    """
    Parsea valores con detección automática de formato (Lógica robusta del extractor antiguo).
    Soporta signo menos al final '100.00-'.
    """
    if not valor_str:
        return Decimal(0)
    
    # Eliminar símbolo de moneda y espacios
    valor_limpio = valor_str.replace('$', '').strip()
    
    # Detectar signo negativo al final (común en abonos Bancolombia)
    es_negativo = False
    if valor_limpio.endswith('-'):
        es_negativo = True
        valor_limpio = valor_limpio.rstrip('-').strip()
    elif valor_limpio.startswith('-'):
        es_negativo = True
        valor_limpio = valor_limpio.lstrip('-').strip()
    
    # Detectar formato: Si tiene coma Y punto, determinar cuál es decimal
    tiene_coma = ',' in valor_limpio
    tiene_punto = '.' in valor_limpio
    
    if tiene_coma and tiene_punto:
        # Determinar cuál viene último (ese es el decimal)
        pos_coma = valor_limpio.rfind(',')
        pos_punto = valor_limpio.rfind('.')
        
        if pos_punto > pos_coma:
            # Formato USA: 1,234.56
            valor_limpio = valor_limpio.replace(',', '')
        else:
            # Formato COL: 1.234,56
            valor_limpio = valor_limpio.replace('.', '').replace(',', '.')
    elif tiene_coma:
        # Solo tiene coma.
        partes = valor_limpio.split(',')
        if len(partes) == 2 and len(partes[1]) <= 2:
            # Probablemente decimal: 123,45
            valor_limpio = valor_limpio.replace(',', '.')
        else:
            # Probablemente miles: 1,234
            valor_limpio = valor_limpio.replace(',', '')
    elif tiene_punto:
        # Solo tiene punto.
        partes = valor_limpio.split('.')
        if len(partes[-1]) > 2:
            # Probablemente miles: 1.234
            valor_limpio = valor_limpio.replace('.', '')
        # else: decimal USA 123.45, dejar como está
    
    try:
        val = Decimal(valor_limpio)
        return val * Decimal(-1) if es_negativo else val
    except:
        return Decimal(0)
