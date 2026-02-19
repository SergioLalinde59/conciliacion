from abc import ABC, abstractmethod
from typing import List, Optional
from decimal import Decimal
from src.domain.models.presupuesto_detalle import PresupuestoDetalle


class PresupuestoDetalleRepository(ABC):
    """Puerto para el repositorio de líneas de presupuesto"""

    # --- CRUD ---

    @abstractmethod
    def guardar(self, detalle: PresupuestoDetalle) -> PresupuestoDetalle:
        """Crea o actualiza una línea de presupuesto"""
        pass

    @abstractmethod
    def guardar_lote(self, detalles: List[PresupuestoDetalle]) -> int:
        """Inserta múltiples líneas. Retorna cantidad insertada."""
        pass

    @abstractmethod
    def obtener_por_id(self, detalle_id: int) -> Optional[PresupuestoDetalle]:
        pass

    @abstractmethod
    def obtener_por_presupuesto(
        self,
        presupuesto_id: int,
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None,
        tercero_id: Optional[int] = None,
        mes: Optional[int] = None,
        version: Optional[int] = None,
        direccion: Optional[str] = None
    ) -> List[PresupuestoDetalle]:
        """Lista líneas de un presupuesto con filtros opcionales.
        Si version=None, usa la versión actual del presupuesto.
        Si direccion=None, retorna ambas direcciones."""
        pass

    @abstractmethod
    def eliminar(self, detalle_id: int) -> None:
        pass

    @abstractmethod
    def eliminar_por_presupuesto(self, presupuesto_id: int) -> int:
        """Elimina todas las líneas de un presupuesto. Retorna cantidad eliminada."""
        pass

    @abstractmethod
    def eliminar_por_version(self, presupuesto_id: int, version: int) -> int:
        """Elimina las líneas de una versión específica. Retorna cantidad eliminada."""
        pass

    # --- Resúmenes agregados ---

    @abstractmethod
    def obtener_resumen_por_centro_costo(
        self, presupuesto_id: int, mes_inicio: int = 1, mes_fin: int = 12
    ) -> List[dict]:
        """Agrupa por centro de costo, suma monto_efectivo"""
        pass

    @abstractmethod
    def obtener_resumen_por_concepto(
        self, presupuesto_id: int, centro_costo_id: int,
        mes_inicio: int = 1, mes_fin: int = 12
    ) -> List[dict]:
        """Agrupa por concepto dentro de un centro de costo"""
        pass

    @abstractmethod
    def obtener_resumen_por_tercero(
        self, presupuesto_id: int, centro_costo_id: int,
        concepto_id: Optional[int] = None,
        mes_inicio: int = 1, mes_fin: int = 12
    ) -> List[dict]:
        """Agrupa por tercero dentro de un centro de costo (y opcionalmente concepto)"""
        pass

    @abstractmethod
    def obtener_resumen_mensual(self, presupuesto_id: int) -> List[dict]:
        """Agrupa por mes, suma total presupuestado"""
        pass

    # --- Ajustes ---

    @abstractmethod
    def aplicar_ajuste_global(self, presupuesto_id: int, porcentaje: Decimal) -> int:
        """Aplica ajuste porcentual a todas las líneas. Retorna cantidad afectada."""
        pass

    @abstractmethod
    def aplicar_ajuste_centro_costo(
        self, presupuesto_id: int, centro_costo_id: int, porcentaje: Decimal
    ) -> int:
        """Aplica ajuste porcentual a líneas de un centro de costo. Retorna cantidad afectada."""
        pass

    @abstractmethod
    def aplicar_ajuste_linea(self, detalle_id: int, monto: Decimal) -> PresupuestoDetalle:
        """Ajusta el monto de una línea específica"""
        pass

    # --- Versiones ---

    @abstractmethod
    def obtener_versiones(self, presupuesto_id: int) -> List[dict]:
        """Lista versiones de un presupuesto con metadatos"""
        pass

    @abstractmethod
    def guardar_version(self, presupuesto_id: int, version: int,
                        lineas_generadas: int, total_presupuestado,
                        anio_fuente: int, notas: str = None) -> None:
        """Registra metadatos de una versión generada"""
        pass

    @abstractmethod
    def contar_reglas_sin_detalle(self, presupuesto_id: int, version: int) -> dict:
        """Cuenta reglas cuya combinación CC+Concepto no tiene filas en presupuesto_detalle"""
        pass

    @abstractmethod
    def comparar_versiones(
        self, presupuesto_id: int, version_a: int, version_b: int,
        nivel: str = 'centro_costo',
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None
    ) -> List[dict]:
        """Compara dos versiones de un presupuesto agrupando por nivel (centro_costo, concepto, tercero)"""
        pass
