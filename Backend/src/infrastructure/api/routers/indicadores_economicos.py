from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel

from src.domain.models.indicador_economico import IndicadorEconomico
from src.domain.ports.indicador_economico_repository import IndicadorEconomicoRepository
from src.infrastructure.api.dependencies import get_indicador_economico_repository

router = APIRouter(prefix="/api/indicadores-economicos", tags=["indicadores-economicos"])


def _to_response(i: IndicadorEconomico) -> dict:
    return {
        "id": i.id, "anio": i.anio, "indicador": i.indicador,
        "valor_porcentaje": float(i.valor_porcentaje),
        "notas": i.notas,
        "rango_min_smlv": float(i.rango_min_smlv) if i.rango_min_smlv is not None else None,
        "rango_max_smlv": float(i.rango_max_smlv) if i.rango_max_smlv is not None else None
    }


class IndicadorDTO(BaseModel):
    anio: int
    indicador: str
    valor_porcentaje: float
    notas: Optional[str] = None
    rango_min_smlv: Optional[float] = None
    rango_max_smlv: Optional[float] = None


@router.get("")
def listar_indicadores(
    anio: Optional[int] = None,
    repo: IndicadorEconomicoRepository = Depends(get_indicador_economico_repository)
):
    if anio:
        indicadores = repo.obtener_por_anio(anio)
    else:
        indicadores = repo.obtener_todos()
    return [_to_response(i) for i in indicadores]


@router.get("/{indicador_id}")
def obtener_indicador(
    indicador_id: int,
    repo: IndicadorEconomicoRepository = Depends(get_indicador_economico_repository)
):
    i = repo.obtener_por_id(indicador_id)
    if not i:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    return _to_response(i)


@router.post("")
def crear_indicador(
    dto: IndicadorDTO,
    repo: IndicadorEconomicoRepository = Depends(get_indicador_economico_repository)
):
    try:
        indicador = IndicadorEconomico(
            anio=dto.anio, indicador=dto.indicador,
            valor_porcentaje=dto.valor_porcentaje, notas=dto.notas,
            rango_min_smlv=dto.rango_min_smlv, rango_max_smlv=dto.rango_max_smlv
        )
        guardado = repo.guardar(indicador)
        return _to_response(guardado)
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{indicador_id}")
def actualizar_indicador(
    indicador_id: int, dto: IndicadorDTO,
    repo: IndicadorEconomicoRepository = Depends(get_indicador_economico_repository)
):
    existente = repo.obtener_por_id(indicador_id)
    if not existente:
        raise HTTPException(status_code=404, detail="Indicador no encontrado")
    try:
        existente.anio = dto.anio
        existente.indicador = dto.indicador
        existente.valor_porcentaje = dto.valor_porcentaje
        existente.notas = dto.notas
        existente.rango_min_smlv = dto.rango_min_smlv
        existente.rango_max_smlv = dto.rango_max_smlv
        guardado = repo.guardar(existente)
        return _to_response(guardado)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{indicador_id}")
def eliminar_indicador(
    indicador_id: int,
    repo: IndicadorEconomicoRepository = Depends(get_indicador_economico_repository)
):
    repo.eliminar(indicador_id)
    return {"mensaje": "Indicador eliminado"}
