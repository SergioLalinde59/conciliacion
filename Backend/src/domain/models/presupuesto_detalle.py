from dataclasses import dataclass
from typing import Optional
from datetime import datetime
from decimal import Decimal


@dataclass
class PresupuestoDetalle:
    """Entidad de Dominio para líneas de presupuesto mensual por clasificación"""
    presupuesto_id: int
    centro_costo_id: int
    mes: int
    monto_presupuestado: Decimal
    tipo: str = 'variable'
    direccion: str = 'egreso'
    version: int = 1

    id: Optional[int] = None
    concepto_id: Optional[int] = None
    tercero_id: Optional[int] = None
    monto_ajustado: Optional[Decimal] = None
    monto_base: Optional[Decimal] = None
    notas: Optional[str] = None
    created_at: Optional[datetime] = None

    # Campos de JOIN (solo lectura)
    centro_costo_nombre: Optional[str] = None
    concepto_nombre: Optional[str] = None
    tercero_nombre: Optional[str] = None

    def __post_init__(self):
        if not 1 <= self.mes <= 12:
            raise ValueError(f"El mes debe estar entre 1 y 12, recibido: {self.mes}")
        if self.monto_presupuestado is None:
            raise ValueError("El monto presupuestado es obligatorio")
        if not isinstance(self.monto_presupuestado, Decimal):
            self.monto_presupuestado = Decimal(str(self.monto_presupuestado))
        if self.monto_ajustado is not None and not isinstance(self.monto_ajustado, Decimal):
            self.monto_ajustado = Decimal(str(self.monto_ajustado))
        if self.monto_base is not None and not isinstance(self.monto_base, Decimal):
            self.monto_base = Decimal(str(self.monto_base))

    @property
    def monto_efectivo(self) -> Decimal:
        """Retorna monto_ajustado si existe, sino monto_presupuestado"""
        return self.monto_ajustado if self.monto_ajustado is not None else self.monto_presupuestado
