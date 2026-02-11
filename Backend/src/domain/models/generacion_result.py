from dataclasses import dataclass, field
from typing import List
from src.domain.models.presupuesto_detalle import PresupuestoDetalle


@dataclass
class GeneracionResult:
    """Resultado de la generación inteligente de presupuesto"""
    regulares: List[PresupuestoDetalle] = field(default_factory=list)
    no_repetitivos: List[dict] = field(default_factory=list)
    fijos_sin_monto: List[dict] = field(default_factory=list)
    resumen: dict = field(default_factory=dict)
