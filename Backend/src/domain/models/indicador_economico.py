from dataclasses import dataclass
from typing import Optional
from datetime import datetime
from decimal import Decimal


@dataclass
class IndicadorEconomico:
    """Entidad de Dominio para indicadores económicos por año"""
    anio: int
    indicador: str
    valor_porcentaje: Decimal
    id: Optional[int] = None
    notas: Optional[str] = None
    rango_min_smlv: Optional[Decimal] = None
    rango_max_smlv: Optional[Decimal] = None
    created_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.indicador:
            raise ValueError("El indicador es obligatorio")
        if not isinstance(self.valor_porcentaje, Decimal):
            self.valor_porcentaje = Decimal(str(self.valor_porcentaje))
        if self.rango_min_smlv is not None and not isinstance(self.rango_min_smlv, Decimal):
            self.rango_min_smlv = Decimal(str(self.rango_min_smlv))
        if self.rango_max_smlv is not None and not isinstance(self.rango_max_smlv, Decimal):
            self.rango_max_smlv = Decimal(str(self.rango_max_smlv))
