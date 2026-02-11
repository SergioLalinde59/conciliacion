from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.regla_presupuesto import ReglaPresupuesto


class ReglaPresupuestoRepository(ABC):
    @abstractmethod
    def guardar(self, regla: ReglaPresupuesto) -> ReglaPresupuesto:
        pass

    @abstractmethod
    def obtener_todos(self) -> List[ReglaPresupuesto]:
        pass

    @abstractmethod
    def obtener_por_id(self, id: int) -> Optional[ReglaPresupuesto]:
        pass

    @abstractmethod
    def eliminar(self, id: int) -> None:
        pass

    @abstractmethod
    def guardar_lote(self, reglas: List[ReglaPresupuesto]) -> dict:
        """Crea reglas en lote. Omite duplicados (mismo CC+Concepto).
        Returns: { creadas: int, omitidas: int }"""
        pass
