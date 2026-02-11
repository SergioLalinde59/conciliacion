from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.indicador_economico import IndicadorEconomico


class IndicadorEconomicoRepository(ABC):
    @abstractmethod
    def guardar(self, indicador: IndicadorEconomico) -> IndicadorEconomico:
        pass

    @abstractmethod
    def obtener_por_anio(self, anio: int) -> List[IndicadorEconomico]:
        pass

    @abstractmethod
    def obtener_por_anio_e_indicador(self, anio: int, indicador: str) -> Optional[IndicadorEconomico]:
        pass

    @abstractmethod
    def obtener_todos(self) -> List[IndicadorEconomico]:
        pass

    @abstractmethod
    def obtener_por_id(self, id: int) -> Optional[IndicadorEconomico]:
        pass

    @abstractmethod
    def eliminar(self, id: int) -> None:
        pass
