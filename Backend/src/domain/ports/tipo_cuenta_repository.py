from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.tipo_cuenta import TipoCuenta


class TipoCuentaRepository(ABC):
    """Puerto abstracto para el repositorio de tipos de cuenta."""

    @abstractmethod
    def obtener_por_id(self, tipo_cuenta_id: int) -> Optional[TipoCuenta]:
        """Obtiene un tipo de cuenta por su ID."""
        pass

    @abstractmethod
    def obtener_todos(self) -> List[TipoCuenta]:
        """Obtiene todos los tipos de cuenta activos."""
        pass

    @abstractmethod
    def guardar(self, tipo_cuenta: TipoCuenta) -> TipoCuenta:
        """Guarda o actualiza un tipo de cuenta."""
        pass