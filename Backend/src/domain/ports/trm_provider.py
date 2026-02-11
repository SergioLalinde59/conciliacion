from abc import ABC, abstractmethod
from typing import Optional
from datetime import date
from decimal import Decimal


class TrmProvider(ABC):
    """Puerto para obtener la TRM desde una fuente externa."""

    @abstractmethod
    def obtener_trm(self, fecha: date) -> Optional[Decimal]:
        """Obtiene la TRM para una fecha. Retorna None si no disponible."""
        pass
