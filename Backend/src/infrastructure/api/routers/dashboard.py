from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from datetime import date, datetime
import calendar
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
                "mes_nombre": calendar.month_name[mes_actual]
            }

        verde_hasta = presupuesto.semaforo_verde_hasta
        amarillo_hasta = presupuesto.semaforo_amarillo_hasta

        resumen = repo_comparacion.comparar_resumen_mensual(
            presupuesto_id=presupuesto.id,
            anio=anio_actual,
            verde_hasta=verde_hasta,
            amarillo_hasta=amarillo_hasta
        )

        mes_data = next((r for r in resumen if r["mes"] == mes_actual), None)

        presupuestado = mes_data["presupuestado"] if mes_data else 0
        ejecutado = mes_data["ejecutado"] if mes_data else 0
        porcentaje = round((ejecutado / presupuestado * 100), 1) if presupuestado > 0 else 0

        # Direccional: sub-ejecución siempre es verde
        if porcentaje <= (100 + verde_hasta):
            semaforo = "verde"
        elif porcentaje <= (100 + amarillo_hasta):
            semaforo = "amarillo"
        else:
            semaforo = "rojo"

        return {
            "tiene_presupuesto": True,
            "presupuesto_id": presupuesto.id,
            "presupuesto_nombre": presupuesto.nombre,
            "presupuesto_mes_actual": presupuestado,
            "ejecutado_mes_actual": ejecutado,
            "porcentaje_consumido": porcentaje,
            "semaforo": semaforo,
            "dias_restantes": dias_restantes,
            "mes_nombre": calendar.month_name[mes_actual]
        }
    except Exception as e:
        logger.error(f"Error obteniendo widget de presupuesto: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error interno")
