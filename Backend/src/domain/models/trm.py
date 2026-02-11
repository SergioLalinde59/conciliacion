from dataclasses import dataclass
from typing import Optional
from datetime import date, datetime
from decimal import Decimal


@dataclass
class Trm:
    """Tasa Representativa del Mercado (COP por 1 USD) para una fecha."""
    fecha: date
    valor: Decimal
    id: Optional[int] = None
    fuente: Optional[str] = 'datos.gov.co'
    created_at: Optional[datetime] = None

    def __post_init__(self):
        if not self.fecha:
            raise ValueError("La fecha es obligatoria")
        if self.valor is None or self.valor <= 0:
            raise ValueError("El valor de la TRM debe ser positivo")
        if not isinstance(self.valor, Decimal):
            self.valor = Decimal(str(self.valor))
