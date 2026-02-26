from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.perspectiva import Perspectiva

class PerspectivaRepository(ABC):
    @abstractmethod
    def obtener_todas(self) -> List[Perspectiva]:
        pass

    @abstractmethod
    def obtener_por_id(self, id: int) -> Optional[Perspectiva]:
        pass

    @abstractmethod
    def obtener_por_slug(self, slug: str) -> Optional[Perspectiva]:
        pass

    @abstractmethod
    def guardar(self, perspectiva: Perspectiva) -> Perspectiva:
        pass

    @abstractmethod
    def eliminar(self, id: int) -> None:
        pass
