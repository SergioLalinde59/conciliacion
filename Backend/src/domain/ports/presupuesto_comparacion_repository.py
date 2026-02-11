from abc import ABC, abstractmethod
from typing import List, Optional


class PresupuestoComparacionRepository(ABC):
    """Puerto para comparar presupuesto vs ejecución real"""

    @abstractmethod
    def comparar_por_centro_costo(
        self,
        presupuesto_id: int,
        anio: int,
        mes_inicio: int = 1,
        mes_fin: int = 12,
        centros_costos_excluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0
    ) -> List[dict]:
        """Comparación presupuesto vs real agrupada por centro de costo"""
        pass

    @abstractmethod
    def comparar_por_concepto(
        self,
        presupuesto_id: int,
        anio: int,
        centro_costo_id: int,
        mes_inicio: int = 1,
        mes_fin: int = 12,
        centros_costos_excluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0
    ) -> List[dict]:
        """Comparación presupuesto vs real agrupada por concepto dentro de un CC"""
        pass

    @abstractmethod
    def comparar_por_tercero(
        self,
        presupuesto_id: int,
        anio: int,
        centro_costo_id: int,
        concepto_id: Optional[int] = None,
        mes_inicio: int = 1,
        mes_fin: int = 12,
        centros_costos_excluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0
    ) -> List[dict]:
        """Comparación presupuesto vs real agrupada por tercero"""
        pass

    @abstractmethod
    def comparar_resumen_mensual(
        self,
        presupuesto_id: int,
        anio: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None,
        tercero_id: Optional[int] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0
    ) -> List[dict]:
        """Resumen mensual: presupuestado vs ejecutado por mes, con filtros opcionales"""
        pass
