from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal

from src.domain.models.regla_presupuesto import ReglaPresupuesto
from src.domain.ports.regla_presupuesto_repository import ReglaPresupuestoRepository
from src.infrastructure.api.dependencies import get_regla_presupuesto_repository

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


@router.get("")
def listar_reglas(repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository)):
    reglas = repo.obtener_todos()
    return [
        {
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
        for r in reglas
    ]


@router.post("/batch")
def crear_reglas_lote(
    dto: BatchReglasDTO,
    repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository)
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
        return resultado
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{regla_id}")
def obtener_regla(regla_id: int, repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository)):
    r = repo.obtener_por_id(regla_id)
    if not r:
        raise HTTPException(status_code=404, detail="Regla no encontrada")
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


@router.post("")
def crear_regla(dto: ReglaDTO, repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository)):
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
        return {
            "id": guardado.id,
            "centro_costo_id": guardado.centro_costo_id,
            "concepto_id": guardado.concepto_id,
            "tipo_gasto": guardado.tipo_gasto,
            "indicador_nombre": guardado.indicador_nombre,
            "factor_ajuste": float(guardado.factor_ajuste),
            "monto_fijo_mensual": float(guardado.monto_fijo_mensual) if guardado.monto_fijo_mensual else None,
            "notas": guardado.notas,
            "centro_costo_nombre": guardado.centro_costo_nombre,
            "concepto_nombre": guardado.concepto_nombre
        }
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{regla_id}")
def actualizar_regla(
    regla_id: int, dto: ReglaDTO,
    repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository)
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
        return {
            "id": guardado.id,
            "centro_costo_id": guardado.centro_costo_id,
            "concepto_id": guardado.concepto_id,
            "tipo_gasto": guardado.tipo_gasto,
            "indicador_nombre": guardado.indicador_nombre,
            "factor_ajuste": float(guardado.factor_ajuste),
            "monto_fijo_mensual": float(guardado.monto_fijo_mensual) if guardado.monto_fijo_mensual else None,
            "notas": guardado.notas,
            "centro_costo_nombre": guardado.centro_costo_nombre,
            "concepto_nombre": guardado.concepto_nombre
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{regla_id}")
def eliminar_regla(regla_id: int, repo: ReglaPresupuestoRepository = Depends(get_regla_presupuesto_repository)):
    repo.eliminar(regla_id)
    return {"mensaje": "Regla eliminada"}
