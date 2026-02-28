from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.centro_costo import CentroCosto

class CentroCostoRepository(ABC):
    @abstractmethod
    def guardar(self, centro_costo: CentroCosto) -> CentroCosto:
        pass

    @abstractmethod
    def obtener_por_id(self, centro_costo_id: int) -> Optional[CentroCosto]:
        pass

    @abstractmethod
    def obtener_todos(self) -> List[CentroCosto]:
        pass
    
    @abstractmethod
    def buscar_por_nombre(self, nombre: str) -> Optional[CentroCosto]:
        pass

    @abstractmethod
    def obtener_id_traslados(self) -> Optional[int]:
        """Obtiene el ID del centro de costos de Traslados de forma dinámica"""
        pass
