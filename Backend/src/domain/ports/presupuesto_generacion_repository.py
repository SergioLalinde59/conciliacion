from abc import ABC, abstractmethod
from typing import List, Optional
from src.domain.models.presupuesto_detalle import PresupuestoDetalle


class PresupuestoGeneracionRepository(ABC):
    """Puerto para generar líneas de presupuesto desde datos históricos"""

    @abstractmethod
    def generar_base_desde_anio(
        self,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None
    ) -> List[PresupuestoDetalle]:
        """
        Genera líneas de presupuesto base a partir de los egresos reales de un año.
        Agrupa por centro_costo + concepto + tercero + mes.
        Retorna lista de PresupuestoDetalle SIN presupuesto_id asignado.
        """
        pass

    @abstractmethod
    def obtener_combinaciones_gasto(
        self,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None
    ) -> List[dict]:
        """Combinaciones únicas (CC, Concepto) con meses_activos y monto_total."""
        pass

    @abstractmethod
    def obtener_desglose_mensual(
        self,
        anio_fuente: int,
        centro_costo_id: int,
        concepto_id: Optional[int] = None
    ) -> List[dict]:
        """Desglose mensual de un CC/Concepto específico.
        Returns: [{ mes: int, monto: float }]"""
        pass
