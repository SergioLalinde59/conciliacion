from fastapi import APIRouter, Depends, HTTPException
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, field_validator

from src.domain.models.tipo_gasto import TipoGasto
from src.domain.ports.tipo_gasto_repository import TipoGastoRepository
from src.infrastructure.api.dependencies import get_tipo_gasto_repository

router = APIRouter(prefix="/api/tipos-gasto", tags=["tipos-gasto"])


class TipoGastoDTO(BaseModel):
    tipo: str
    descripcion: Optional[str] = None
    indicador_default: Optional[str] = None
    excluir_presupuesto: bool = False
    activo: bool = True
    keywords: List[Dict[str, Any]] = []
    prioridad: int = 99

    @field_validator("keywords")
    @classmethod
    def validar_keywords(cls, v: list) -> list:
        for i, par in enumerate(v):
            cc = par.get("centro_costo")
            concepto = par.get("concepto")
            if not cc or not concepto:
                raise ValueError(
                    f"Keyword #{i+1}: centro_costo y concepto son obligatorios"
                )
        return v


def _to_response(t: TipoGasto) -> dict:
    return {
        "id": t.id, "tipo": t.tipo,
        "descripcion": t.descripcion, "indicador_default": t.indicador_default,
        "excluir_presupuesto": t.excluir_presupuesto, "activo": t.activo,
        "keywords": t.keywords, "prioridad": t.prioridad
    }


@router.get("")
def listar_tipos_gasto(repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)):
    tipos = repo.obtener_todos()
    return [_to_response(t) for t in tipos]


@router.get("/{tipo_id}")
def obtener_tipo_gasto(tipo_id: int, repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)):
    t = repo.obtener_por_id(tipo_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tipo de gasto no encontrado")
    return _to_response(t)


@router.post("")
def crear_tipo_gasto(dto: TipoGastoDTO, repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)):
    try:
        tipo = TipoGasto(
            tipo=dto.tipo, descripcion=dto.descripcion,
            indicador_default=dto.indicador_default,
            excluir_presupuesto=dto.excluir_presupuesto, activo=dto.activo,
            keywords=dto.keywords, prioridad=dto.prioridad
        )
        guardado = repo.guardar(tipo)
        return _to_response(guardado)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{tipo_id}")
def actualizar_tipo_gasto(
    tipo_id: int, dto: TipoGastoDTO,
    repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)
):
    existente = repo.obtener_por_id(tipo_id)
    if not existente:
        raise HTTPException(status_code=404, detail="Tipo de gasto no encontrado")
    try:
        existente.tipo = dto.tipo
        existente.descripcion = dto.descripcion
        existente.indicador_default = dto.indicador_default
        existente.excluir_presupuesto = dto.excluir_presupuesto
        existente.activo = dto.activo
        existente.keywords = dto.keywords
        existente.prioridad = dto.prioridad
        guardado = repo.guardar(existente)
        return _to_response(guardado)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tipo_id}")
def eliminar_tipo_gasto(tipo_id: int, repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)):
    repo.eliminar(tipo_id)
    return {"mensaje": "Tipo de gasto desactivado"}
