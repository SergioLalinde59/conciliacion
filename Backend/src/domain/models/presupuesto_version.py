from dataclasses import dataclass
from typing import Optional
from datetime import datetime
from decimal import Decimal


@dataclass
class PresupuestoVersion:
    """Metadatos de una versión generada de un presupuesto"""
    presupuesto_id: int
    version: int
    lineas_generadas: int = 0
    total_presupuestado: Decimal = Decimal('0')
    anio_fuente: Optional[int] = None
    notas: Optional[str] = None
    id: Optional[int] = None
    created_at: Optional[datetime] = None
