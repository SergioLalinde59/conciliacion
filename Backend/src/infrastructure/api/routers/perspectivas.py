from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from src.domain.models.perspectiva import Perspectiva
from src.domain.ports.perspectiva_repository import PerspectivaRepository
from src.infrastructure.api.dependencies import get_perspectiva_repository

router = APIRouter(prefix="/api/perspectivas", tags=["perspectivas"])


class PerspectivaDTO(BaseModel):
    nombre: str
    slug: str
    tipo: str = 'excluir'
    centro_costo_ids: List[int] = []
    siempre_excluir_ids: List[int] = []
    es_defecto: bool = False
    orden: int = 0


class PerspectivaResponse(BaseModel):
    id: int
    nombre: str
    slug: str
    tipo: str
    centro_costo_ids: List[int]
    siempre_excluir_ids: List[int]
    es_defecto: bool
    orden: int


def _to_response(p: Perspectiva) -> dict:
    return {
        "id": p.id,
        "nombre": p.nombre,
        "slug": p.slug,
        "tipo": p.tipo,
        "centro_costo_ids": p.centro_costo_ids,
        "siempre_excluir_ids": p.siempre_excluir_ids,
        "es_defecto": p.es_defecto,
        "orden": p.orden,
    }


@router.get("", response_model=List[PerspectivaResponse])
def listar_perspectivas(repo: PerspectivaRepository = Depends(get_perspectiva_repository)):
    perspectivas = repo.obtener_todas()
    return [_to_response(p) for p in perspectivas]


@router.post("", response_model=PerspectivaResponse)
def crear_perspectiva(dto: PerspectivaDTO, repo: PerspectivaRepository = Depends(get_perspectiva_repository)):
    nueva = Perspectiva(
        nombre=dto.nombre, slug=dto.slug, tipo=dto.tipo,
        centro_costo_ids=dto.centro_costo_ids,
        siempre_excluir_ids=dto.siempre_excluir_ids,
        es_defecto=dto.es_defecto, orden=dto.orden
    )
    try:
        guardada = repo.guardar(nueva)
        return _to_response(guardada)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{id}", response_model=PerspectivaResponse)
def actualizar_perspectiva(id: int, dto: PerspectivaDTO, repo: PerspectivaRepository = Depends(get_perspectiva_repository)):
    existente = repo.obtener_por_id(id)
    if not existente:
        raise HTTPException(status_code=404, detail="Perspectiva no encontrada")
    actualizada = Perspectiva(
        id=id, nombre=dto.nombre, slug=dto.slug, tipo=dto.tipo,
        centro_costo_ids=dto.centro_costo_ids,
        siempre_excluir_ids=dto.siempre_excluir_ids,
        es_defecto=dto.es_defecto, orden=dto.orden
    )
    try:
        guardada = repo.guardar(actualizada)
        return _to_response(guardada)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{id}")
def eliminar_perspectiva(id: int, repo: PerspectivaRepository = Depends(get_perspectiva_repository)):
    existente = repo.obtener_por_id(id)
    if not existente:
        raise HTTPException(status_code=404, detail="Perspectiva no encontrada")
    try:
        repo.eliminar(id)
        return {"mensaje": "Eliminada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
