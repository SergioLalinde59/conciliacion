"""
Extractor de movimientos para FondoRenta (Inversiones) Bancolombia desde archivos Excel (.xlsx).
Lee archivos descargados del portal de Bancolombia.
Columnas esperadas: Fecha, Descripcion, Detalles, Numero de unidades, Valor
"""

import openpyxl
from decimal import Decimal
from typing import List, Dict, Any
from datetime import datetime, date


def extraer_movimientos(file_obj: Any) -> List[Dict]:
    """
    Extrae movimientos de un archivo Excel de FondoRenta Bancolombia.

    Estructura esperada:
        Fila 0: Encabezados (Fecha, Descripcion, Detalles, Numero de unidades, Valor)
        Fila 1+: Datos de movimientos

    Returns:
        Lista de dicts con: fecha (str ISO), descripcion, referencia, valor (Decimal)
    """
    try:
        wb = openpyxl.load_workbook(file_obj, read_only=True, data_only=True)
        ws = wb.active
    except Exception as e:
        raise Exception(f"Error al leer el archivo Excel: {e}")

    movimientos = []
    primera_fila = True

    for row in ws.iter_rows(values_only=True):
        if primera_fila:
            primera_fila = False
            continue

        if not row or len(row) < 5:
            continue

        fecha_raw = row[0]
        descripcion_raw = row[1]
        detalles_raw = row[2]
        # row[3] = numero de unidades (no se usa para movimientos)
        valor_raw = row[4]

        # Validar que haya fecha y valor
        if fecha_raw is None or valor_raw is None:
            continue

        # Convertir fecha
        if isinstance(fecha_raw, datetime):
            fecha_str = fecha_raw.date().isoformat()
        elif isinstance(fecha_raw, date):
            fecha_str = fecha_raw.isoformat()
        elif isinstance(fecha_raw, str):
            fecha_str = fecha_raw.strip()
        else:
            continue

        # Convertir valor a Decimal
        try:
            valor = Decimal(str(valor_raw))
        except Exception:
            continue

        # Detalles tiene más información, usarlo como descripción
        descripcion = str(detalles_raw).strip() if detalles_raw else str(descripcion_raw).strip() if descripcion_raw else ''
        referencia = ''

        movimientos.append({
            'fecha': fecha_str,
            'descripcion': descripcion,
            'referencia': referencia,
            'valor': valor
        })

    wb.close()
    return movimientos
