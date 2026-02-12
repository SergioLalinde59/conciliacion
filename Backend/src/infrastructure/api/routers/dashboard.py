from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import date, datetime
import calendar

MESES_ES = {
    1: "Enero", 2: "Febrero", 3: "Marzo", 4: "Abril",
    5: "Mayo", 6: "Junio", 7: "Julio", 8: "Agosto",
    9: "Septiembre", 10: "Octubre", 11: "Noviembre", 12: "Diciembre"
}
from pydantic import BaseModel

from src.domain.ports.movimiento_repository import MovimientoRepository
from src.domain.ports.presupuesto_repository import PresupuestoRepository
from src.domain.ports.presupuesto_comparacion_repository import PresupuestoComparacionRepository
from src.infrastructure.api.dependencies import (
    get_movimiento_repository,
    get_presupuesto_repository,
    get_presupuesto_comparacion_repository,
)
from src.infrastructure.logging.config import logger

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

class DashboardStats(BaseModel):
    periodo: str
    cuenta_id: Optional[int]
    cuenta_nombre: str
    centro_costo_id: Optional[int]
    centro_costo_nombre: str
    conteo: int
    ingresos: float
    egresos: float

@router.get("/estadisticas", response_model=List[DashboardStats])
def obtener_estadisticas(
    desde: Optional[date] = None,
    hasta: Optional[date] = None,
    repo: MovimientoRepository = Depends(get_movimiento_repository)
):
    """
    Obtiene estadísticas para el dashboard.
    Agrupadas por yyyy-mmm, cuenta, centro_costo.
    """
    try:
        stats = repo.obtener_estadisticas_dashboard(
            fecha_inicio=desde,
            fecha_fin=hasta
        )
        return stats
    except Exception as e:
        logger.error(f"Error obteniendo estadísticas del dashboard: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno al obtener estadísticas")


@router.get("/presupuesto-widget")
def obtener_widget_presupuesto(
    centros_costos_excluidos: Optional[List[int]] = Query(None),
    centro_costo_id: Optional[int] = None,
    concepto_id: Optional[int] = None,
    tercero_id: Optional[int] = None,
    repo_presupuesto: PresupuestoRepository = Depends(get_presupuesto_repository),
    repo_comparacion: PresupuestoComparacionRepository = Depends(get_presupuesto_comparacion_repository)
):
    """Widget de presupuesto para el dashboard: consumo del mes actual"""
    try:
        hoy = datetime.now()
        anio_actual = hoy.year
        mes_actual = hoy.month
        ultimo_dia = calendar.monthrange(anio_actual, mes_actual)[1]
        dias_restantes = ultimo_dia - hoy.day

        presupuesto = repo_presupuesto.obtener_activo(anio_actual)
        if not presupuesto:
            return {
                "tiene_presupuesto": False,
                "presupuesto_mes_actual": 0,
                "ejecutado_mes_actual": 0,
                "porcentaje_consumido": 0,
                "semaforo": "verde",
                "dias_restantes": dias_restantes,
                "mes_nombre": MESES_ES.get(mes_actual, calendar.month_name[mes_actual])
            }

        verde_hasta = presupuesto.semaforo_verde_hasta
        amarillo_hasta = presupuesto.semaforo_amarillo_hasta
        umbral_mes = presupuesto.umbral_minimo_mensual
        umbral_anual = presupuesto.umbral_minimo_anual
        usar_materialidad = umbral_mes > 0 or umbral_anual > 0

        def _es_no_material(pres: float) -> bool:
            return (umbral_mes > 0 and pres < umbral_mes) or \
                   (umbral_anual > 0 and pres * 12 < umbral_anual)

        def _calcular_semaforo(pct: float) -> str:
            if pct <= (100 + verde_hasta):
                return "verde"
            elif pct <= (100 + amarillo_hasta):
                return "amarillo"
            return "rojo"

        def _totales_mes(m: int) -> tuple:
            """Retorna (presupuestado, ejecutado) para un mes, filtrando no-materiales."""
            if usar_materialidad:
                detalle = repo_comparacion.comparar_por_centro_costo(
                    presupuesto_id=presupuesto.id,
                    anio=anio_actual,
                    mes_inicio=m,
                    mes_fin=m,
                    centros_costos_excluidos=centros_costos_excluidos,
                    verde_hasta=verde_hasta,
                    amarillo_hasta=amarillo_hasta
                )
                materiales = [r for r in detalle if not _es_no_material(r["presupuestado"])]
                return (
                    sum(r["presupuestado"] for r in materiales),
                    sum(r["ejecutado"] for r in materiales),
                )
            else:
                m_data = next((r for r in resumen if r["mes"] == m), None)
                return (
                    m_data["presupuestado"] if m_data else 0,
                    m_data["ejecutado"] if m_data else 0,
                )

        resumen = repo_comparacion.comparar_resumen_mensual(
            presupuesto_id=presupuesto.id,
            anio=anio_actual,
            centros_costos_excluidos=centros_costos_excluidos,
            centro_costo_id=centro_costo_id,
            concepto_id=concepto_id,
            tercero_id=tercero_id,
            verde_hasta=verde_hasta,
            amarillo_hasta=amarillo_hasta
        )

        presupuestado, ejecutado = _totales_mes(mes_actual)
        porcentaje = round((ejecutado / presupuestado * 100), 1) if presupuestado > 0 else 0
        semaforo = _calcular_semaforo(porcentaje)

        # Meses a mostrar: hasta 3, adaptativo (ene=1, feb=2, mar+=3)
        mes_inicio = max(1, mes_actual - 2)
        meses = []
        for m in range(mes_inicio, mes_actual + 1):
            m_pres, m_ejec = _totales_mes(m)
            m_pct = round((m_ejec / m_pres * 100), 1) if m_pres > 0 else 0
            meses.append({
                "mes": m,
                "mes_nombre": MESES_ES.get(m, ""),
                "presupuestado": m_pres,
                "ejecutado": m_ejec,
                "porcentaje": m_pct,
                "semaforo": _calcular_semaforo(m_pct),
            })

        return {
            "tiene_presupuesto": True,
            "presupuesto_id": presupuesto.id,
            "presupuesto_nombre": presupuesto.nombre,
            "presupuesto_mes_actual": presupuestado,
            "ejecutado_mes_actual": ejecutado,
            "porcentaje_consumido": porcentaje,
            "semaforo": semaforo,
            "dias_restantes": dias_restantes,
            "mes_nombre": MESES_ES.get(mes_actual, calendar.month_name[mes_actual]),
            "meses": meses
        }
    except Exception as e:
        logger.error(f"Error obteniendo widget de presupuesto: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno")
