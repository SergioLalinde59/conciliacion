from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal
from datetime import date
import logging
import psycopg2

from src.domain.models.regla_presupuesto import ReglaPresupuesto
from src.domain.ports.regla_presupuesto_repository import ReglaPresupuestoRepository
from src.infrastructure.api.dependencies import get_regla_presupuesto_repository, get_presupuesto_service
from src.application.services.presupuesto_service import PresupuestoService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/reglas-presupuesto", tags=["reglas-presupuesto"])


class ReglaDTO(BaseModel):
    centro_costo_id: Optional[int] = None
    concepto_id: Optional[int] = None
    tipo_gasto: str = 'Variable'
    indicador_nombre: Optional[str] = 'IPC Colombia'
    factor_ajuste: float = 0.0
    monto_fijo_mensual: Optional[float] = None
    notas: Optional[str] = None


class BatchReglasDTO(BaseModel):
    reglas: List[ReglaDTO]


def _regla_to_dict(r) -> dict:
    return {
        "id": r.id,
        "centro_costo_id": r.centro_costo_id,
        "concepto_id": r.concepto_id,
        "tipo_gasto": r.tipo_gasto,
        "indicador_nombre": r.indicador_nombre,
        "factor_ajuste": float(r.factor_ajuste),
        "monto_fijo_mensual": float(r.monto_fijo_mensual) if r.monto_fijo_mensual else None,
        "notas": r.notas,
        "centro_costo_nombre": r.centro_costo_nombre,
        "concepto_nombre": r.concepto_nombre
    }


def _auto_regenerar(service: PresupuestoService) -> dict:
    """Intenta regenerar el presupuesto activo del año actual. Nunca lanza excepciones."""
    try:
        activo = service._presupuesto_repo.obtener_activo(date.today().year)
        if not activo:
            return {"presupuesto_regenerado": False}
        resultado = service.regenerar_en_version_actual(activo.id)
        logger.info(f"Auto-regeneración exitosa: {resultado.get('lineas_generadas', 0)} líneas")
        return {"presupuesto_regenerado": True, "lineas_generadas": resultado.get("lineas_generadas", 0)}
    except Exception as e:
        logger.warning(f"Auto-regeneración falló: {e}")
        return {"presupuesto_regenerado": False, "regeneracion_error": str(e)}


@router.get("")
def listar_reglas(repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository)):
    reglas = repo.obtener_todos()
    return [_regla_to_dict(r) for r in reglas]


@router.post("/batch")
def crear_reglas_lote(
    dto: BatchReglasDTO,
    repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository),
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    """Crea reglas en lote. Omite duplicados (mismo CC+Concepto existente)."""
    try:
        entidades = [
            ReglaPresupuesto(
                centro_costo_id=r.centro_costo_id,
                concepto_id=r.concepto_id,
                tipo_gasto=r.tipo_gasto,
                indicador_nombre=r.indicador_nombre,
                factor_ajuste=Decimal(str(r.factor_ajuste)),
                monto_fijo_mensual=Decimal(str(r.monto_fijo_mensual)) if r.monto_fijo_mensual else None,
                notas=r.notas
            )
            for r in dto.reglas
        ]
        resultado = repo.guardar_lote(entidades)
        resultado.update(_auto_regenerar(service))
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{regla_id}")
def obtener_regla(regla_id: int, repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository)):
    r = repo.obtener_por_id(regla_id)
    if not r:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    return _regla_to_dict(r)


@router.post("")
def crear_regla(
    dto: ReglaDTO,
    repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository),
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    try:
        regla = ReglaPresupuesto(
            centro_costo_id=dto.centro_costo_id,
            concepto_id=dto.concepto_id,
            tipo_gasto=dto.tipo_gasto,
            indicador_nombre=dto.indicador_nombre,
            factor_ajuste=Decimal(str(dto.factor_ajuste)),
            monto_fijo_mensual=Decimal(str(dto.monto_fijo_mensual)) if dto.monto_fijo_mensual else None,
            notas=dto.notas
        )
        guardado = repo.guardar(regla)
        resp = _regla_to_dict(guardado)
        resp.update(_auto_regenerar(service))
        return resp
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except psycopg2.IntegrityError:
        raise HTTPException(status_code=409, detail="Ya existe una regla para este Centro de Costo y Concepto")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{regla_id}")
def actualizar_regla(
    regla_id: int, dto: ReglaDTO,
    repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository),
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    existente = repo.obtener_por_id(regla_id)
    if not existente:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
    try:
        existente.centro_costo_id = dto.centro_costo_id
        existente.concepto_id = dto.concepto_id
        existente.tipo_gasto = dto.tipo_gasto
        existente.indicador_nombre = dto.indicador_nombre
        existente.factor_ajuste = Decimal(str(dto.factor_ajuste))
        existente.monto_fijo_mensual = Decimal(str(dto.monto_fijo_mensual)) if dto.monto_fijo_mensual else None
        existente.notas = dto.notas
        guardado = repo.guardar(existente)
        resp = _regla_to_dict(guardado)
        resp.update(_auto_regenerar(service))
        return resp
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{regla_id}")
def eliminar_regla(
    regla_id: int,
    repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository),
    service: PresupuestoService = Depends(get_presupuesto_service)
):
    repo.eliminar(regla_id)
    resp = {"mensaje": "Regla eliminada"}
    resp.update(_auto_regenerar(service))
    return resp
