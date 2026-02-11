from abc import ABC, abstractmethod
from typing import Optional
from datetime import date
from src.domain.models.trm import Trm


class TrmRepository(ABC):
    """Puerto para el almacenamiento local (cache) de TRM."""

    @abstractmethod
    def guardar(self, trm: Trm) -> Trm:
        """Guarda o actualiza la TRM para una fecha (upsert)."""
        pass

    @abstractmethod
    def obtener_por_fecha(self, fecha: date) -> Optional[Trm]:
        """Obtiene la TRM exacta para una fecha."""
        pass

    @abstractmethod
    def obtener_mas_cercana(self, fecha: date) -> Optional[Trm]:
        """Obtiene la TRM más cercana anterior o igual a la fecha."""
        pass
