from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel

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


@router.get("")
def listar_tipos_gasto(repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)):
    tipos = repo.obtener_todos()
    return [
        {
            "id": t.id, "tipo": t.tipo,
            "descripcion": t.descripcion, "indicador_default": t.indicador_default,
            "excluir_presupuesto": t.excluir_presupuesto, "activo": t.activo
        }
        for t in tipos
    ]


@router.get("/{tipo_id}")
def obtener_tipo_gasto(tipo_id: int, repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)):
    t = repo.obtener_por_id(tipo_id)
    if not t:
        raise HTTPException(status_code=404, detail="Tipo de gasto no encontrado")
    return {
        "id": t.id, "tipo": t.tipo,
        "descripcion": t.descripcion, "indicador_default": t.indicador_default,
        "excluir_presupuesto": t.excluir_presupuesto, "activo": t.activo
    }


@router.post("")
def crear_tipo_gasto(dto: TipoGastoDTO, repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)):
    try:
        tipo = TipoGasto(
            tipo=dto.tipo, descripcion=dto.descripcion,
            indicador_default=dto.indicador_default,
            excluir_presupuesto=dto.excluir_presupuesto, activo=dto.activo
        )
        guardado = repo.guardar(tipo)
        return {
            "id": guardado.id, "tipo": guardado.tipo,
            "descripcion": guardado.descripcion, "indicador_default": guardado.indicador_default,
            "excluir_presupuesto": guardado.excluir_presupuesto, "activo": guardado.activo
        }
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
        guardado = repo.guardar(existente)
        return {
            "id": guardado.id, "tipo": guardado.tipo,
            "descripcion": guardado.descripcion, "indicador_default": guardado.indicador_default,
            "excluir_presupuesto": guardado.excluir_presupuesto, "activo": guardado.activo
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{tipo_id}")
def eliminar_tipo_gasto(tipo_id: int, repo: TipoGastoRepository = Depends(get_tipo_gasto_repository)):
    repo.eliminar(tipo_id)
    return {"mensaje": "Tipo de gasto desactivado"}
