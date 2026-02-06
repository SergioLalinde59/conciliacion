"""
Script de diagnóstico para ver cómo pdfplumber extrae el texto del PDF FondoRenta.
Ejecutar: python test_fondorenta_pdf.py <ruta_al_pdf>
"""
import sys
import pdfplumber

def analizar_pdf(ruta_pdf: str):
    print(f"Analizando: {ruta_pdf}\n")

    with pdfplumber.open(ruta_pdf) as pdf:
        for i, page in enumerate(pdf.pages):
            print(f"{'='*60}")
            print(f"PÁGINA {i+1}")
            print(f"{'='*60}")

            # Método 1: extract_text()
            texto = page.extract_text()
            print("\n--- TEXTO EXTRAÍDO (extract_text) ---")
            if texto:
                for j, linea in enumerate(texto.split('\n'), 1):
                    print(f"{j:3}: {linea}")
            else:
                print("(Sin texto)")

            # Método 2: extract_tables() - para tablas estructuradas
            tables = page.extract_tables()
            if tables:
                print(f"\n--- TABLAS DETECTADAS ({len(tables)}) ---")
                for t_idx, table in enumerate(tables):
                    print(f"\nTabla {t_idx + 1}:")
                    for row_idx, row in enumerate(table):
                        print(f"  Fila {row_idx}: {row}")

            print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Uso: python test_fondorenta_pdf.py <ruta_al_pdf>")
        print("Ejemplo: python test_fondorenta_pdf.py 'C:/Extractos/2026-01 FondoRenta.pdf'")
        sys.exit(1)

    analizar_pdf(sys.argv[1])
