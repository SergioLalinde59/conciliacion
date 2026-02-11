from dataclasses import dataclass
from typing import Optional
from datetime import datetime
from decimal import Decimal


@dataclass
class ReglaPresupuesto:
    """Entidad de Dominio para reglas de clasificación CC/Concepto → tipo gasto + indicador"""
    tipo_gasto: str
    indicador_nombre: Optional[str] = None
    centro_costo_id: Optional[int] = None
    concepto_id: Optional[int] = None
    factor_ajuste: Decimal = Decimal('0')
    monto_fijo_mensual: Optional[Decimal] = None
    id: Optional[int] = None
    notas: Optional[str] = None
    created_at: Optional[datetime] = None
    # Campos JOIN (solo lectura)
    centro_costo_nombre: Optional[str] = None
    concepto_nombre: Optional[str] = None

    def __post_init__(self):
        if not self.tipo_gasto:
            raise ValueError("El tipo de gasto es obligatorio")
        if self.tipo_gasto != 'No Repetitivo' and not self.indicador_nombre and self.monto_fijo_mensual is None:
            raise ValueError("Debe especificar indicador económico o monto fijo mensual")
        if not isinstance(self.factor_ajuste, Decimal):
            self.factor_ajuste = Decimal(str(self.factor_ajuste))
        if self.monto_fijo_mensual is not None and not isinstance(self.monto_fijo_mensual, Decimal):
            self.monto_fijo_mensual = Decimal(str(self.monto_fijo_mensual))
