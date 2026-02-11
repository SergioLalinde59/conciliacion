from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel
import logging

from src.domain.ports.presupuesto_repository import PresupuestoRepository
from src.domain.ports.presupuesto_detalle_repository import PresupuestoDetalleRepository
from src.domain.ports.presupuesto_comparacion_repository import PresupuestoComparacionRepository
from src.domain.ports.presupuesto_generacion_repository import PresupuestoGeneracionRepository
from src.application.services.presupuesto_service import PresupuestoService
from src.infrastructure.api.dependencies import (
    get_presupuesto_repository,
    get_presupuesto_detalle_repository,
    get_presupuesto_comparacion_repository,
    get_presupuesto_generacion_repository,
    get_presupuesto_service,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/presupuestos", tags=["presupuestos"])


# --- Schemas ---

class PresupuestoCreateDTO(BaseModel):
    anio: int
    nombre: str
    notas: Optional[str] = None
    semaforo_verde_hasta: float
    semaforo_amarillo_hasta: float
    umbral_minimo_mensual: float = 0.0
    umbral_minimo_anual: float = 0.0
    umbral_no_repetitivo: int = 4

class PresupuestoUpdateDTO(BaseModel):
    nombre: Optional[str] = None
    notas: Optional[str] = None
    semaforo_verde_hasta: Optional[float] = None
    semaforo_amarillo_hasta: Optional[float] = None
    umbral_minimo_mensual: Optional[float] = None
    umbral_minimo_anual: Optional[float] = None
    umbral_no_repetitivo: Optional[int] = None

class PresupuestoResponse(BaseModel):
    id: int
    anio: int
    nombre: str
    estado: str
    notas: Optional[str] = None
    semaforo_verde_hasta: float
    semaforo_amarillo_hasta: float
    umbral_minimo_mensual: float = 0.0
    umbral_minimo_anual: float = 0.0
    umbral_no_repetitivo: int = 4
    created_at: Optional[str] = None

class GenerarDTO(BaseModel):
    anio_fuente: int
    centros_costos_excluidos: Optional[List[int]] = None
    umbral: Optional[int] = None
    no_repetitivos_incluidos: Optional[List[dict]] = None
    montos_fijos: Optional[List[dict]] = None

class PrevisualizarDTO(BaseModel):
    anio_fuente: int
    centros_costos_excluidos: Optional[List[int]] = None
    umbral: Optional[int] = None

class DetalleCreateDTO(BaseModel):
    centro_costo_id: int
    concepto_id: Optional[int] = None
    tercero_id: Optional[int] = None
    mes: int
    monto_presupuestado: float
    tipo: str = 'variable'
    notas: Optional[str] = None

class DetalleUpdateDTO(BaseModel):
    centro_costo_id: Optional[int] = None
    concepto_id: Optional[int] = None
    tercero_id: Optional[int] = None
    mes: Optional[int] = None
    monto_presupuestado: Optional[float] = None
    monto_ajustado: Optional[float] = None
    tipo: Optional[str] = None
    notas: Optional[str] = None

class AjusteGlobalDTO(BaseModel):
    porcentaje: float

class AjusteCentroCostoDTO(BaseModel):
    centro_costo_id: int
    porcentaje: float

class AjusteLineaDTO(BaseModel):
    monto: float


# --- Endpoints Maestro ---

@router.get("")
def listar_presupuestos(
    anio: Optional[int] = None,
    repo: PresupuestoRepository = Depends(get_presupuesto_repository)
):
    presupuestos = repo.obtener_todos(anio=anio)
    return [
        {
            "id": p.id, "anio": p.anio, "nombre": p.nombre,
            "estado": p.estado, "notas": p.notas,
            "semaforo_verde_hasta": p.semaforo_verde_hasta,
            "semaforo_amarillo_hasta": p.semaforo_amarillo_hasta,
            "umbral_minimo_mensual": p.umbral_minimo_mensual,
            "umbral_minimo_anual": p.umbral_minimo_anual,
            "umbral_no_repetitivo": p.umbral_no_repetitivo,
            "created_at": str(p.created_at) if p.created_at else None
        }
        for p in presupuestos
    ]

@router.get("/clasificacion-preview")
def clasificacion_preview(
    anio: int = Query(..., description="Año fuente para analizar gastos"),
    centros_costos_excluidos: Optional[List[int]] = Query(None),
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    """Preview de clasificación: muestra cada combo CC/Concepto y la regla que aplica"""
    try:
        return service.obtener_clasificacion_preview(
            anio_fuente=anio,
            centros_costos_excluidos=centros_costos_excluidos
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error en clasificacion preview: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/clasificacion-preview/detalle-mensual")
def detalle_mensual(
    anio: int = Query(..., description="Año fuente"),
    centro_costo_id: int = Query(...),
    concepto_id: Optional[int] = Query(None),
    repo: PresupuestoGeneracionRepository = Depends(get_presupuesto_generacion_repository)
):
    """Desglose mensual de gastos para un CC/Concepto específico"""
    try:
        return repo.obtener_desglose_mensual(anio, centro_costo_id, concepto_id)
    except Exception as e:
        logger.error(f"Error en detalle mensual: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{presupuesto_id}")
def obtener_presupuesto(
    presupuesto_id: int,
    repo: PresupuestoRepository = Depends(get_presupuesto_repository)
):
    p = repo.obtener_por_id(presupuesto_id)
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    return {
        "id": p.id, "anio": p.anio, "nombre": p.nombre,
        "estado": p.estado, "notas": p.notas,
        "semaforo_verde_hasta": p.semaforo_verde_hasta,
        "semaforo_amarillo_hasta": p.semaforo_amarillo_hasta,
        "umbral_minimo_mensual": p.umbral_minimo_mensual,
        "umbral_minimo_anual": p.umbral_minimo_anual,
        "created_at": str(p.created_at) if p.created_at else None
    }

@router.post("")
def crear_presupuesto(
    dto: PresupuestoCreateDTO,
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    try:
        p = service.crear_presupuesto(
            anio=dto.anio, nombre=dto.nombre, notas=dto.notas,
            semaforo_verde_hasta=dto.semaforo_verde_hasta,
            semaforo_amarillo_hasta=dto.semaforo_amarillo_hasta,
            umbral_minimo_mensual=dto.umbral_minimo_mensual,
            umbral_minimo_anual=dto.umbral_minimo_anual,
            umbral_no_repetitivo=dto.umbral_no_repetitivo
        )
        return {
            "id": p.id, "anio": p.anio, "nombre": p.nombre,
            "estado": p.estado, "notas": p.notas,
            "semaforo_verde_hasta": p.semaforo_verde_hasta,
            "semaforo_amarillo_hasta": p.semaforo_amarillo_hasta,
            "umbral_minimo_mensual": p.umbral_minimo_mensual,
            "umbral_minimo_anual": p.umbral_minimo_anual,
            "umbral_no_repetitivo": p.umbral_no_repetitivo,
            "created_at": str(p.created_at) if p.created_at else None
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.put("/{presupuesto_id}")
def actualizar_presupuesto(
    presupuesto_id: int,
    dto: PresupuestoUpdateDTO,
    repo: PresupuestoRepository = Depends(get_presupuesto_repository)
):
    p = repo.obtener_por_id(presupuesto_id)
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    # Nombre y notas solo en borrador
    if (dto.nombre is not None or dto.notas is not None) and not p.puede_editar:
        raise HTTPException(status_code=400, detail="Solo se pueden editar nombre/notas en presupuestos en borrador")
    if dto.nombre is not None:
        p.nombre = dto.nombre
    if dto.notas is not None:
        p.notas = dto.notas
    # Semáforos se pueden editar siempre (son configuración)
    if dto.semaforo_verde_hasta is not None:
        p.semaforo_verde_hasta = dto.semaforo_verde_hasta
    if dto.semaforo_amarillo_hasta is not None:
        p.semaforo_amarillo_hasta = dto.semaforo_amarillo_hasta
    # Umbrales de materialidad se pueden editar siempre (son configuración)
    if dto.umbral_minimo_mensual is not None:
        p.umbral_minimo_mensual = dto.umbral_minimo_mensual
    if dto.umbral_minimo_anual is not None:
        p.umbral_minimo_anual = dto.umbral_minimo_anual
    if dto.umbral_no_repetitivo is not None:
        p.umbral_no_repetitivo = dto.umbral_no_repetitivo
    try:
        guardado = repo.guardar(p)
        return {
            "id": guardado.id, "anio": guardado.anio, "nombre": guardado.nombre,
            "estado": guardado.estado, "notas": guardado.notas,
            "semaforo_verde_hasta": guardado.semaforo_verde_hasta,
            "semaforo_amarillo_hasta": guardado.semaforo_amarillo_hasta,
            "umbral_minimo_mensual": guardado.umbral_minimo_mensual,
            "umbral_minimo_anual": guardado.umbral_minimo_anual,
            "created_at": str(guardado.created_at) if guardado.created_at else None
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{presupuesto_id}")
def eliminar_presupuesto(
    presupuesto_id: int,
    repo: PresupuestoRepository = Depends(get_presupuesto_repository)
):
    try:
        repo.eliminar(presupuesto_id)
        return {"mensaje": "Presupuesto eliminado correctamente"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.post("/{presupuesto_id}/activar")
def activar_presupuesto(
    presupuesto_id: int,
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    try:
        p = service.activar_presupuesto(presupuesto_id)
        return {"id": p.id, "estado": p.estado, "mensaje": "Presupuesto activado"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.post("/{presupuesto_id}/cerrar")
def cerrar_presupuesto(
    presupuesto_id: int,
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    try:
        p = service.cerrar_presupuesto(presupuesto_id)
        return {"id": p.id, "estado": p.estado, "mensaje": "Presupuesto cerrado"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# --- Generación ---

@router.post("/{presupuesto_id}/previsualizar")
def previsualizar_generacion(
    presupuesto_id: int,
    dto: PrevisualizarDTO,
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    """Vista previa de generación inteligente sin persistir"""
    try:
        result = service.previsualizar_generacion(
            presupuesto_id=presupuesto_id,
            anio_fuente=dto.anio_fuente,
            centros_costos_excluidos=dto.centros_costos_excluidos,
            umbral=dto.umbral
        )
        return {
            "regulares": len(result.regulares),
            "no_repetitivos": result.no_repetitivos,
            "fijos_sin_monto": result.fijos_sin_monto,
            "resumen": result.resumen
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error previsualizando presupuesto: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{presupuesto_id}/generar")
def generar_presupuesto(
    presupuesto_id: int,
    dto: GenerarDTO,
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    """Genera presupuesto con clasificación inteligente y aumentos diferenciados"""
    try:
        resultado = service.generar_desde_anio_anterior(
            presupuesto_id=presupuesto_id,
            anio_fuente=dto.anio_fuente,
            centros_costos_excluidos=dto.centros_costos_excluidos,
            umbral=dto.umbral,
            no_repetitivos_incluidos=dto.no_repetitivos_incluidos,
            montos_fijos=dto.montos_fijos
        )
        return resultado
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error generando presupuesto: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# --- Detalle CRUD ---

@router.get("/{presupuesto_id}/detalle")
def listar_detalle(
    presupuesto_id: int,
    centro_costo_id: Optional[int] = None,
    concepto_id: Optional[int] = None,
    tercero_id: Optional[int] = None,
    mes: Optional[int] = None,
    repo: PresupuestoDetalleRepository = Depends(get_presupuesto_detalle_repository)
):
    detalles = repo.obtener_por_presupuesto(
        presupuesto_id=presupuesto_id,
        centro_costo_id=centro_costo_id,
        concepto_id=concepto_id,
        tercero_id=tercero_id,
        mes=mes
    )
    return [
        {
            "id": d.id, "presupuesto_id": d.presupuesto_id,
            "centro_costo_id": d.centro_costo_id, "concepto_id": d.concepto_id,
            "tercero_id": d.tercero_id, "mes": d.mes,
            "monto_presupuestado": float(d.monto_presupuestado),
            "monto_ajustado": float(d.monto_ajustado) if d.monto_ajustado is not None else None,
            "monto_base": float(d.monto_base) if d.monto_base is not None else None,
            "monto_efectivo": float(d.monto_efectivo),
            "tipo": d.tipo, "notas": d.notas,
            "centro_costo_nombre": d.centro_costo_nombre,
            "concepto_nombre": d.concepto_nombre,
            "tercero_nombre": d.tercero_nombre,
        }
        for d in detalles
    ]

@router.post("/{presupuesto_id}/detalle")
def crear_detalle(
    presupuesto_id: int,
    dto: DetalleCreateDTO,
    repo: PresupuestoDetalleRepository = Depends(get_presupuesto_detalle_repository)
):
    from src.domain.models.presupuesto_detalle import PresupuestoDetalle
    try:
        detalle = PresupuestoDetalle(
            presupuesto_id=presupuesto_id,
            centro_costo_id=dto.centro_costo_id,
            concepto_id=dto.concepto_id,
            tercero_id=dto.tercero_id,
            mes=dto.mes,
            monto_presupuestado=Decimal(str(dto.monto_presupuestado)),
            tipo=dto.tipo,
            notas=dto.notas
        )
        guardado = repo.guardar(detalle)
        return {"id": guardado.id, "mensaje": "Línea creada"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.put("/{presupuesto_id}/detalle/{detalle_id}")
def actualizar_detalle(
    presupuesto_id: int,
    detalle_id: int,
    dto: DetalleUpdateDTO,
    repo: PresupuestoDetalleRepository = Depends(get_presupuesto_detalle_repository)
):
    detalle = repo.obtener_por_id(detalle_id)
    if not detalle or detalle.presupuesto_id != presupuesto_id:
        raise HTTPException(status_code=404, detail="Línea no encontrada")
    if dto.centro_costo_id is not None:
        detalle.centro_costo_id = dto.centro_costo_id
    if dto.concepto_id is not None:
        detalle.concepto_id = dto.concepto_id
    if dto.tercero_id is not None:
        detalle.tercero_id = dto.tercero_id
    if dto.mes is not None:
        detalle.mes = dto.mes
    if dto.monto_presupuestado is not None:
        detalle.monto_presupuestado = Decimal(str(dto.monto_presupuestado))
    if dto.monto_ajustado is not None:
        detalle.monto_ajustado = Decimal(str(dto.monto_ajustado))
    if dto.tipo is not None:
        detalle.tipo = dto.tipo
    if dto.notas is not None:
        detalle.notas = dto.notas
    try:
        guardado = repo.guardar(detalle)
        return {"id": guardado.id, "mensaje": "Línea actualizada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/{presupuesto_id}/detalle/{detalle_id}")
def eliminar_detalle(
    presupuesto_id: int,
    detalle_id: int,
    repo: PresupuestoDetalleRepository = Depends(get_presupuesto_detalle_repository)
):
    detalle = repo.obtener_por_id(detalle_id)
    if not detalle or detalle.presupuesto_id != presupuesto_id:
        raise HTTPException(status_code=404, detail="Línea no encontrada")
    repo.eliminar(detalle_id)
    return {"mensaje": "Línea eliminada"}


# --- Ajustes ---

@router.post("/{presupuesto_id}/ajuste/global")
def ajuste_global(
    presupuesto_id: int,
    dto: AjusteGlobalDTO,
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    try:
        count = service.aplicar_ajuste_global(presupuesto_id, Decimal(str(dto.porcentaje)))
        return {"lineas_afectadas": count, "mensaje": f"Ajuste de {dto.porcentaje}% aplicado a {count} líneas"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.post("/{presupuesto_id}/ajuste/centro-costo")
def ajuste_centro_costo(
    presupuesto_id: int,
    dto: AjusteCentroCostoDTO,
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    try:
        count = service.aplicar_ajuste_por_centro_costo(
            presupuesto_id, dto.centro_costo_id, Decimal(str(dto.porcentaje))
        )
        return {"lineas_afectadas": count, "mensaje": f"Ajuste de {dto.porcentaje}% aplicado a {count} líneas"}
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.put("/{presupuesto_id}/detalle/{detalle_id}/ajustar")
def ajustar_linea(
    presupuesto_id: int,
    detalle_id: int,
    dto: AjusteLineaDTO,
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    try:
        detalle = service.aplicar_ajuste_linea(detalle_id, Decimal(str(dto.monto)))
        return {
            "id": detalle.id,
            "monto_ajustado": float(detalle.monto_ajustado) if detalle.monto_ajustado else None,
            "mensaje": "Línea ajustada"
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))


# --- Comparación Presupuesto vs Real ---

@router.get("/{presupuesto_id}/comparacion")
def comparar_presupuesto_vs_real(
    presupuesto_id: int,
    nivel: str = "centro_costo",
    mes_inicio: int = 1,
    mes_fin: int = 12,
    centro_costo_id: Optional[int] = None,
    concepto_id: Optional[int] = None,
    centros_costos_excluidos: Optional[List[int]] = Query(None),
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    try:
        return service.comparar_presupuesto_vs_real(
            presupuesto_id=presupuesto_id,
            nivel=nivel,
            mes_inicio=mes_inicio,
            mes_fin=mes_fin,
            centro_costo_id=centro_costo_id,
            concepto_id=concepto_id,
            centros_costos_excluidos=centros_costos_excluidos
        )
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        logger.error(f"Error en comparación presupuesto vs real: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generando comparación")

@router.get("/{presupuesto_id}/comparacion/mensual")
def comparar_resumen_mensual(
    presupuesto_id: int,
    centros_costos_excluidos: Optional[List[int]] = Query(None),
    centro_costo_id: Optional[int] = None,
    concepto_id: Optional[int] = None,
    tercero_id: Optional[int] = None,
    repo_presupuesto: PresupuestoRepository = Depends(get_presupuesto_repository),
    repo_comparacion: PresupuestoComparacionRepository = Depends(get_presupuesto_comparacion_repository)
):
    p = repo_presupuesto.obtener_por_id(presupuesto_id)
    if not p:
        raise HTTPException(status_code=404, detail="Presupuesto no encontrado")
    try:
        return repo_comparacion.comparar_resumen_mensual(
            presupuesto_id=presupuesto_id,
            anio=p.anio,
            centros_costos_excluidos=centros_costos_excluidos,
            centro_costo_id=centro_costo_id,
            concepto_id=concepto_id,
            tercero_id=tercero_id,
            verde_hasta=p.semaforo_verde_hasta,
            amarillo_hasta=p.semaforo_amarillo_hasta
        )
    except Exception as e:
        logger.error(f"Error en resumen mensual: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Error generando resumen mensual")


# --- Resúmenes del presupuesto ---

@router.get("/{presupuesto_id}/resumen/centro-costo")
def resumen_por_centro_costo(
    presupuesto_id: int,
    mes_inicio: int = 1,
    mes_fin: int = 12,
    repo: PresupuestoDetalleRepository = Depends(get_presupuesto_detalle_repository)
):
    return repo.obtener_resumen_por_centro_costo(presupuesto_id, mes_inicio, mes_fin)

@router.get("/{presupuesto_id}/resumen/mensual")
def resumen_mensual(
    presupuesto_id: int,
    repo: PresupuestoDetalleRepository = Depends(get_presupuesto_detalle_repository)
):
    return repo.obtener_resumen_mensual(presupuesto_id)
