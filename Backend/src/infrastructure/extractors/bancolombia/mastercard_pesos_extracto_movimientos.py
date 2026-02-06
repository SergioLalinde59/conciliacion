"""
Extractor de movimientos individuales para MasterCard Pesos Bancolombia (Nuevo Formato).
Lee PDFs de extracto y extrae cada transacción con el formato:
Autorización | Fecha | Movimiento | Valor ...
"""
import pdfplumber
import re
from typing import List, Dict, Any
from decimal import Decimal
from datetime import datetime

def extraer_movimientos(file_obj: Any) -> List[Dict[str, Any]]:
    """
    Extrae los movimientos individuales de un extracto MasterCard Pesos (Nuevo Formato).
    
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
            
            for page in pdf.pages:
                texto = page.extract_text()
                if not texto:
                    continue
                
                # Verificar si es hoja de Dólares para ignorarla
                # El usuario reporta: "estado de cuenta en:   Dolares"
                # Usamos regex flexible con espacios
                if re.search(r'ESTADO\s+DE\s+CUENTA\s+EN:\s+DOLARES', texto, re.IGNORECASE):
                    print(f"DEBUG: Saltando página {page.page_number} por ser extracto de Dólares")
                    continue
                
                movs_pagina = _extraer_movimientos_desde_texto(texto, numero_linea)
                movimientos.extend(movs_pagina)
                numero_linea += len(movs_pagina)
                
    except Exception as e:
        raise Exception(f"Error al leer movimientos del PDF MasterCard Pesos: {e}")
    
    print(f"DEBUG: Total movimientos encontrados en MasterCard Pesos: {len(movimientos)}")
    return movimientos

def _extraer_movimientos_desde_texto(texto: str, offset_linea: int) -> List[Dict[str, Any]]:
    """
    Extrae movimientos desde el texto de una página del PDF.

    Estrategia mejorada para evitar que números al final de descripciones
    se confundan con valores:
    1. Identificar líneas que empiezan con código + fecha
    2. Buscar el símbolo $ para anclar el valor
    3. Todo lo que está entre fecha y $ es descripción
    """
    movimientos = []
    lineas = texto.split('\n')

    print(f"DEBUG: Procesando texto de página, longitud: {len(texto)}")

    # Dos patrones para mayor robustez:
    # Patrón 1: CON código de autorización (ej: R06441 26/12/2025 DROGUERIA...)
    # Patrón 2: SIN código, fecha directa (ej: 31/01/2026 INTERESES CORRIENTES...)
    patron_con_codigo = re.compile(
        r'^\s*([A-Z][A-Z0-9]*)\s+(\d{2}/\d{2}/\d{4})\s+(.+)$'
    )
    patron_sin_codigo = re.compile(
        r'^\s*(\d{2}/\d{2}/\d{4})\s+(.+)$'
    )

    # Regex para encontrar el valor: busca $ seguido de número
    # Esto ancla correctamente el valor y evita confundir números en descripciones
    patron_valor = re.compile(r'([-]?\$\s*[-]?[\d.,]+)')

    for linea in lineas:
        linea = linea.strip()
        if not linea:
            continue

        # Intentar primero con código, luego sin código
        inicio_match = patron_con_codigo.search(linea)
        if inicio_match:
            # Con código: group(1)=código, group(2)=fecha, group(3)=resto
            fecha_str = inicio_match.group(2)
            resto = inicio_match.group(3)
        else:
            inicio_match = patron_sin_codigo.search(linea)
            if not inicio_match:
                continue
            # Sin código: group(1)=fecha, group(2)=resto
            fecha_str = inicio_match.group(1)
            resto = inicio_match.group(2)

        # Buscar el valor con $ en el resto de la línea
        valor_match = patron_valor.search(resto)
        if valor_match:
            valor_str = valor_match.group(1)
            # Todo lo que está ANTES del $ es la descripción
            descripcion = resto[:valor_match.start()].strip()
            
            # Debug para verificar qué está encontrando
            print(f"DEBUG: MATCH - Fecha: {fecha_str}, Desc: {descripcion}, Valor: {valor_str}")
            
            try:
                # Formato DD/MM/YYYY (Ej: 26/12/2025)
                fecha = datetime.strptime(fecha_str, '%d/%m/%Y').date()
                
                # Parsear valor y multiplicar por -1 
                # Si el PDF trae positivo (Compras) -> -1 * pos = negativo (Gasto)
                # Si el PDF trae negativo (Abonos) -> -1 * neg = positivo (Ingreso)
                valor_raw = _parsear_valor(valor_str)
                valor = -valor_raw
                
                movimientos.append({
                    'fecha': fecha,
                    'descripcion': descripcion,
                    'referencia': '', # Se podría usar el código de autorización si se quisiera
                    'valor': valor,
                    'numero_linea': offset_linea + len(movimientos) + 1,
                    'raw_text': linea
                })
            except Exception as e:
                print(f"DEBUG: Error parseando linea '{linea}': {e}")
                continue
        # else:
            # print(f"DEBUG: No coincide regex: '{linea}'")
    
    return movimientos

def _parsear_valor(valor_str: str) -> Decimal:
    """Parsea valores numéricos eliminando símbolos de moneda y separadores."""
    if not valor_str:
        return Decimal(0)
    
    # Eliminar símbolo de moneda y espacios internos
    valor_str = valor_str.replace('$', '').replace(' ', '').strip()
    
    # Manejo de separadores: Bancolombia usa punto para miles y coma para decimales
    if ',' in valor_str and valor_str.rfind(',') > valor_str.rfind('.'):
        valor_limpio = valor_str.replace('.', '').replace(',', '.')
    else:
        valor_limpio = valor_str.replace(',', '')
    
    try:
        return Decimal(valor_limpio)
    except:
        return Decimal(0)