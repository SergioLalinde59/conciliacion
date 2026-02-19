from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.presupuesto import Presupuesto


class PresupuestoRepository(ABC):
    """Puerto para el repositorio de presupuestos (maestro)"""

    @abstractmethod
    def guardar(self, presupuesto: Presupuesto) -> Presupuesto:
        """Crea o actualiza un presupuesto"""
        pass

    @abstractmethod
    def obtener_por_id(self, presupuesto_id: int) -> Optional[Presupuesto]:
        pass

    @abstractmethod
    def obtener_todos(self, anio: Optional[int] = None) -> List[Presupuesto]:
        """Lista presupuestos, opcionalmente filtrado por año"""
        pass

    @abstractmethod
    def obtener_activo(self, anio: int) -> Optional[Presupuesto]:
        """Obtiene el presupuesto activo para un año dado"""
        pass

    @abstractmethod
    def obtener_borrador(self, anio: int) -> Optional[Presupuesto]:
        """Obtiene el presupuesto en borrador para un año dado"""
        pass

    @abstractmethod
    def eliminar(self, presupuesto_id: int) -> None:
        """Elimina un presupuesto (solo en estado borrador)"""
        pass

    @abstractmethod
    def cambiar_estado(self, presupuesto_id: int, nuevo_estado: str) -> Presupuesto:
        """Cambia el estado de un presupuesto"""
        pass

    @abstractmethod
    def incrementar_version(self, presupuesto_id: int) -> int:
        """Incrementa version_actual y retorna el nuevo número de versión"""
        pass
