"""
Script para diagnosticar la extracción del PDF FondoRenta.
Ejecutar desde la carpeta Backend:
    python test_fondorenta_extract.py

Coloca el PDF en la misma carpeta o especifica la ruta como argumento.
"""
import sys
import os
import pdfplumber
import re
from decimal import Decimal

# Agregar src al path para importar el extractor
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

MESES_ES = {
    'ene': 1, 'feb': 2, 'mar': 3, 'abr': 4, 'may': 5, 'jun': 6,
    'jul': 7, 'ago': 8, 'sep': 9, 'oct': 10, 'nov': 11, 'dic': 12
}

def analizar_pdf(ruta_pdf: str):
    print(f"\n{'='*70}")
    print(f"ANALIZANDO PDF: {ruta_pdf}")
    print(f"{'='*70}\n")

    with pdfplumber.open(ruta_pdf) as pdf:
        for page_num, page in enumerate(pdf.pages, 1):
            print(f"\n{'='*50}")
            print(f"PÁGINA {page_num}")
            print(f"{'='*50}")

            # ============================================
            # 1. TEXTO CRUDO EXTRAÍDO
            # ============================================
            texto = page.extract_text()
            print("\n--- TEXTO CRUDO (línea por línea) ---\n")

            if texto:
                lineas = texto.split('\n')
                for i, linea in enumerate(lineas, 1):
                    # Marcar líneas que parecen tener fecha DD Mes YYYY
                    marker = ""
                    if re.search(r'\d{1,2}\s+[A-Za-z]{3}\s+\d{4}', linea):
                        marker = " <-- FECHA DETECTADA"
                    print(f"{i:3}: [{linea}]{marker}")
            else:
                print("(Sin texto)")

            # ============================================
            # 2. TABLAS DETECTADAS
            # ============================================
            tables = page.extract_tables()
            if tables:
                print(f"\n--- TABLAS DETECTADAS: {len(tables)} ---\n")
                for t_idx, table in enumerate(tables):
                    print(f"TABLA {t_idx + 1} ({len(table)} filas):")
                    for row_idx, row in enumerate(table):
                        print(f"  [{row_idx}]: {row}")
                    print()

            # ============================================
            # 3. INTENTAR EXTRAER CON EL REGEX
            # ============================================
            print("\n--- APLICANDO REGEX DE EXTRACCIÓN ---\n")

            if texto:
                extraer_con_regex(texto)


def extraer_con_regex(texto: str):
    """Aplica el mismo regex que el extractor para ver qué captura."""

    patron_fecha = re.compile(
        r'^\s*(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})\s+(.+)$',
        re.IGNORECASE
    )

    # Regex con lookahead para exactamente 2 decimales
    patron_valor_pesos = re.compile(r'-?\$?\s*(\d{1,3}(?:\.\d{3})*,\d{2})(?!\d)')

    lineas = texto.split('\n')
    movimientos_encontrados = []

    for linea in lineas:
        linea_strip = linea.strip()
        if not linea_strip:
            continue

        fecha_match = patron_fecha.match(linea_strip)
        if fecha_match:
            dia = fecha_match.group(1)
            mes = fecha_match.group(2)
            anio = fecha_match.group(3)
            resto = fecha_match.group(4)

            # Buscar valores monetarios
            valores = [m.group(1) for m in patron_valor_pesos.finditer(resto)]

            # Extraer descripción
            desc_match = re.match(r'^([A-Za-záéíóúÁÉÍÓÚñÑüÜ\s]+)', resto)
            if desc_match:
                descripcion = desc_match.group(1).strip()
            else:
                descripcion = "(no capturada)"

            print(f"✓ MATCH: {dia} {mes} {anio}")
            print(f"  Resto: '{resto}'")
            print(f"  Descripción: '{descripcion}'")
            print(f"  Valores encontrados: {valores}")
            print(f"  Valor final (último): {valores[-1] if valores else 'NINGUNO'}")
            print()

            if valores:
                movimientos_encontrados.append({
                    'fecha': f"{dia}/{mes}/{anio}",
                    'descripcion': descripcion,
                    'valor': valores[-1]
                })
        else:
            # Verificar si la línea tiene una fecha pero no coincide con el patrón
            if re.search(r'\d{1,2}\s+[A-Za-z]{3}\s+\d{4}', linea_strip):
                print(f"✗ NO MATCH (tiene fecha pero no coincide patrón):")
                print(f"  Línea: '{linea_strip}'")
                print(f"  Razón: El patrón espera fecha al INICIO de la línea")
                print()

    # Resumen
    print(f"\n{'='*50}")
    print(f"RESUMEN: {len(movimientos_encontrados)} movimientos extraídos")
    print(f"{'='*50}")
    for i, mov in enumerate(movimientos_encontrados, 1):
        print(f"{i}. {mov['fecha']} | {mov['descripcion'][:40]:<40} | {mov['valor']}")


def buscar_pdf():
    """Busca un PDF de FondoRenta en ubicaciones comunes."""
    posibles = [
        "2026-01 FondoRenta.pdf",
        "FondoRenta.pdf",
        "../2026-01 FondoRenta.pdf",
    ]

    for p in posibles:
        if os.path.exists(p):
            return p

    # Buscar en el directorio actual
    for f in os.listdir('.'):
        if f.endswith('.pdf') and 'fondo' in f.lower():
            return f

    return None


if __name__ == "__main__":
    if len(sys.argv) > 1:
        pdf_path = sys.argv[1]
    else:
        pdf_path = buscar_pdf()
        if not pdf_path:
            print("No se encontró un PDF de FondoRenta.")
            print("\nUso: python test_fondorenta_extract.py <ruta_al_pdf>")
            print("\nO arrastra el PDF a esta carpeta y ejecuta sin argumentos.")
            sys.exit(1)

    if not os.path.exists(pdf_path):
        print(f"Archivo no encontrado: {pdf_path}")
        sys.exit(1)

    analizar_pdf(pdf_path)
