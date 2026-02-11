from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.tipo_gasto import TipoGasto


class TipoGastoRepository(ABC):
    @abstractmethod
    def guardar(self, tipo: TipoGasto) -> TipoGasto:
        pass

    @abstractmethod
    def obtener_todos(self) -> List[TipoGasto]:
        """Retorna solo los activos"""
        pass

    @abstractmethod
    def obtener_por_tipo(self, tipo: str) -> Optional[TipoGasto]:
        pass

    @abstractmethod
    def obtener_por_id(self, id: int) -> Optional[TipoGasto]:
        pass

    @abstractmethod
    def eliminar(self, id: int) -> None:
        """Soft delete: activo=False"""
        pass
