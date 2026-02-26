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
        centros_costos_incluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False,
        direccion: str = 'egreso'
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
        centros_costos_incluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False,
        direccion: str = 'egreso'
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
        centros_costos_incluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False,
        direccion: str = 'egreso'
    ) -> List[dict]:
        """Comparación presupuesto vs real agrupada por tercero"""
        pass

    @abstractmethod
    def comparar_resumen_mensual(
        self,
        presupuesto_id: int,
        anio: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        centros_costos_incluidos: Optional[List[int]] = None,
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None,
        tercero_id: Optional[int] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False,
        direccion: str = 'egreso'
    ) -> List[dict]:
        """Resumen mensual: presupuestado vs ejecutado por mes, con filtros opcionales"""
        pass

    @abstractmethod
    def obtener_gastos_sin_presupuesto(
        self,
        presupuesto_id: int,
        anio: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        centros_costos_incluidos: Optional[List[int]] = None,
        direccion: str = 'egreso'
    ) -> List[dict]:
        """Movimientos del año actual sin filas en presupuesto_detalle, con info de regla existente"""
        pass
