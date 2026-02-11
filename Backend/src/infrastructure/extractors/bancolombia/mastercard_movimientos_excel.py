"""
Extractor de movimientos para tarjetas MasterCard Bancolombia desde archivos Excel (.xlsx).
Lee archivos descargados del portal de Bancolombia.
Columnas esperadas: Fecha, Descripcion, Fecha de corte, Valor, Tipo de moneda, Cuotas

Un mismo archivo contiene movimientos COP y USD mezclados.
El campo 'moneda' permite filtrar por cuenta (MasterCardPesos vs MasterCardUSD).
"""

import openpyxl
import openpyxl.worksheet._reader as _reader
from decimal import Decimal
from typing import List, Dict, Any
from datetime import datetime, date

# Patch: openpyxl no maneja "NaN" en celdas numéricas (Bancolombia genera estos valores)
_original_cast_number = _reader._cast_number

def _patched_cast_number(value):
    if isinstance(value, str) and value.lower() == 'nan':
        return None
    return _original_cast_number(value)

_reader._cast_number = _patched_cast_number


def extraer_movimientos(file_obj: Any) -> List[Dict]:
    """
    Extrae movimientos de un archivo Excel de MasterCard Bancolombia.

    Estructura esperada:
        Fila 0: Encabezados (Fecha, Descripcion, Fecha de corte, Valor, Tipo de moneda, Cuotas)
        Fila 1+: Datos de movimientos

    Returns:
        Lista de dicts con: fecha, descripcion, referencia, valor, moneda, fecha_corte
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
        fecha_corte_raw = row[2]
        valor_raw = row[3]
        moneda_raw = row[4]

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

        # Convertir fecha de corte (puede ser None para movimientos pendientes)
        fecha_corte_str = None
        if fecha_corte_raw is not None:
            if isinstance(fecha_corte_raw, datetime):
                fecha_corte_str = fecha_corte_raw.date().isoformat()
            elif isinstance(fecha_corte_raw, date):
                fecha_corte_str = fecha_corte_raw.isoformat()
            elif isinstance(fecha_corte_raw, str) and fecha_corte_raw.strip():
                fecha_corte_str = fecha_corte_raw.strip()

        # Convertir valor a Decimal
        try:
            valor = Decimal(str(valor_raw))
        except Exception:
            continue

        # Descripcion y moneda
        descripcion = str(descripcion_raw).strip() if descripcion_raw else ''
        moneda = str(moneda_raw).strip().upper() if moneda_raw else 'COP'

        movimientos.append({
            'fecha': fecha_str,
            'descripcion': descripcion,
            'referencia': '',
            'valor': valor,
            'moneda': moneda,
            'fecha_corte': fecha_corte_str
        })

    wb.close()
    return movimientos
