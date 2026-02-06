from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from src.domain.models.tipo_cuenta import TipoCuenta
from src.domain.ports.tipo_cuenta_repository import TipoCuentaRepository
from src.infrastructure.api.dependencies import get_tipo_cuenta_repository

router = APIRouter(prefix="/api/tipos-cuenta", tags=["tipos-cuenta"])


class TipoCuentaDTO(BaseModel):
    nombre: str
    descripcion: Optional[str] = None
    # Pesos algoritmo clasificación
    peso_referencia: int = 100
    peso_descripcion: int = 50
    peso_valor: int = 30
    longitud_min_referencia: int = 8
    # Permisos
    permite_crear_manual: bool = False
    permite_editar: bool = False
    permite_modificar: bool = False
    permite_borrar: bool = False
    permite_clasificar: bool = True
    # Validaciones
    requiere_descripcion: bool = False
    valor_minimo: Optional[float] = None
    # UX
    responde_enter: bool = False
    # Clasificación avanzada
    referencia_define_tercero: bool = False
    activo: bool = True


class TipoCuentaResponse(BaseModel):
    id: int
    nombre: str
    descripcion: Optional[str]
    # Pesos algoritmo clasificación
    peso_referencia: int
    peso_descripcion: int
    peso_valor: int
    longitud_min_referencia: int
    # Permisos
    permite_crear_manual: bool
    permite_editar: bool
    permite_modificar: bool
    permite_borrar: bool
    permite_clasificar: bool
    # Validaciones
    requiere_descripcion: bool
    valor_minimo: Optional[float]
    # UX
    responde_enter: bool
    # Clasificación avanzada
    referencia_define_tercero: bool
    activo: bool


def _to_response(tc: TipoCuenta) -> dict:
    return {
        "id": tc.id,
        "nombre": tc.nombre,
        "descripcion": tc.descripcion,
        "peso_referencia": tc.peso_referencia,
        "peso_descripcion": tc.peso_descripcion,
        "peso_valor": tc.peso_valor,
        "longitud_min_referencia": tc.longitud_min_referencia,
        "permite_crear_manual": tc.permite_crear_manual,
        "permite_editar": tc.permite_editar,
        "permite_modificar": tc.permite_modificar,
        "permite_borrar": tc.permite_borrar,
        "permite_clasificar": tc.permite_clasificar,
        "requiere_descripcion": tc.requiere_descripcion,
        "valor_minimo": float(tc.valor_minimo) if tc.valor_minimo else None,
        "responde_enter": tc.responde_enter,
        "referencia_define_tercero": tc.referencia_define_tercero,
        "activo": tc.activo
    }


@router.get("", response_model=List[TipoCuentaResponse])
def listar_tipos_cuenta(repo: TipoCuentaRepository = Depends(get_tipo_cuenta_repository)):
    """Lista todos los tipos de cuenta activos."""
    tipos = repo.obtener_todos()
    return [_to_response(tc) for tc in tipos]


@router.get("/{id}", response_model=TipoCuentaResponse)
def obtener_tipo_cuenta(id: int, repo: TipoCuentaRepository = Depends(get_tipo_cuenta_repository)):
    """Obtiene un tipo de cuenta por su ID."""
    tipo = repo.obtener_por_id(id)
    if not tipo:
        raise HTTPException(status_code=404, detail="Tipo de cuenta no encontrado")
    return _to_response(tipo)


@router.post("", response_model=TipoCuentaResponse)
def crear_tipo_cuenta(dto: TipoCuentaDTO, repo: TipoCuentaRepository = Depends(get_tipo_cuenta_repository)):
    """Crea un nuevo tipo de cuenta."""
    from decimal import Decimal
    nuevo = TipoCuenta(
        id=None,
        nombre=dto.nombre,
        descripcion=dto.descripcion,
        peso_referencia=dto.peso_referencia,
        peso_descripcion=dto.peso_descripcion,
        peso_valor=dto.peso_valor,
        longitud_min_referencia=dto.longitud_min_referencia,
        permite_crear_manual=dto.permite_crear_manual,
        permite_editar=dto.permite_editar,
        permite_modificar=dto.permite_modificar,
        permite_borrar=dto.permite_borrar,
        permite_clasificar=dto.permite_clasificar,
        requiere_descripcion=dto.requiere_descripcion,
        valor_minimo=Decimal(str(dto.valor_minimo)) if dto.valor_minimo else None,
        responde_enter=dto.responde_enter,
        referencia_define_tercero=dto.referencia_define_tercero,
        activo=dto.activo
    )
    try:
        guardado = repo.guardar(nuevo)
        return _to_response(guardado)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{id}", response_model=TipoCuentaResponse)
def actualizar_tipo_cuenta(id: int, dto: TipoCuentaDTO, repo: TipoCuentaRepository = Depends(get_tipo_cuenta_repository)):
    """Actualiza un tipo de cuenta existente."""
    from decimal import Decimal
    existente = repo.obtener_por_id(id)
    if not existente:
        raise HTTPException(status_code=404, detail="Tipo de cuenta no encontrado")

    actualizado = TipoCuenta(
        id=id,
        nombre=dto.nombre,
        descripcion=dto.descripcion,
        peso_referencia=dto.peso_referencia,
        peso_descripcion=dto.peso_descripcion,
        peso_valor=dto.peso_valor,
        longitud_min_referencia=dto.longitud_min_referencia,
        permite_crear_manual=dto.permite_crear_manual,
        permite_editar=dto.permite_editar,
        permite_modificar=dto.permite_modificar,
        permite_borrar=dto.permite_borrar,
        permite_clasificar=dto.permite_clasificar,
        requiere_descripcion=dto.requiere_descripcion,
        valor_minimo=Decimal(str(dto.valor_minimo)) if dto.valor_minimo else None,
        responde_enter=dto.responde_enter,
        referencia_define_tercero=dto.referencia_define_tercero,
        activo=dto.activo
    )
    try:
        guardado = repo.guardar(actualizado)
        return _to_response(guardado)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{id}")
def eliminar_tipo_cuenta(id: int, repo: TipoCuentaRepository = Depends(get_tipo_cuenta_repository)):
    """Desactiva un tipo de cuenta (soft delete)."""
    existente = repo.obtener_por_id(id)
    if not existente:
        raise HTTPException(status_code=404, detail="Tipo de cuenta no encontrado")

    # Soft delete: marcar como inactivo
    existente.activo = False
    try:
        repo.guardar(existente)
        return {"mensaje": "Tipo de cuenta desactivado correctamente"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
