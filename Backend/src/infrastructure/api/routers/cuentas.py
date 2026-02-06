from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional

from src.domain.models.cuenta import Cuenta
from src.domain.ports.cuenta_repository import CuentaRepository
from src.infrastructure.api.dependencies import get_cuenta_repository

router = APIRouter(prefix="/api/cuentas", tags=["cuentas"])


class CuentaDTO(BaseModel):
    cuenta: str
    permite_carga: bool = False
    permite_conciliar: bool = False
    tipo_cuenta_id: Optional[int] = None


class ConfiguracionTipoResponse(BaseModel):
    """Configuración del tipo de cuenta para el frontend."""
    tipo_cuenta_id: Optional[int] = None
    tipo_cuenta_nombre: Optional[str] = None
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


class CuentaResponse(BaseModel):
    id: int
    nombre: str
    permite_carga: bool = False
    permite_conciliar: bool = False
    tipo_cuenta_id: Optional[int] = None
    tipo_cuenta_nombre: Optional[str] = None
    # Configuración del tipo de cuenta
    configuracion: Optional[ConfiguracionTipoResponse] = None


def _cuenta_to_response(c: Cuenta) -> dict:
    """Convierte una Cuenta a dict de respuesta con configuración."""
    return {
        "id": c.cuentaid,
        "nombre": c.cuenta,
        "permite_carga": c.permite_carga,
        "permite_conciliar": c.permite_conciliar,
        "tipo_cuenta_id": c.tipo_cuenta_id,
        "tipo_cuenta_nombre": c.tipo_cuenta_nombre,
        "configuracion": {
            "tipo_cuenta_id": c.tipo_cuenta_id,
            "tipo_cuenta_nombre": c.tipo_cuenta_nombre,
            "permite_crear_manual": c.permite_crear_manual,
            "permite_editar": c.permite_editar,
            "permite_modificar": c.permite_modificar,
            "permite_borrar": c.permite_borrar,
            "permite_clasificar": c.permite_clasificar,
            "requiere_descripcion": c.requiere_descripcion,
            "valor_minimo": float(c.valor_minimo) if c.valor_minimo else None,
            "responde_enter": c.responde_enter
        }
    }


@router.get("", response_model=List[CuentaResponse])
def listar_cuentas(repo: CuentaRepository = Depends(get_cuenta_repository)):
    cuentas = repo.obtener_todos()
    return [_cuenta_to_response(c) for c in cuentas]


@router.get("/{id}", response_model=CuentaResponse)
def obtener_cuenta(id: int, repo: CuentaRepository = Depends(get_cuenta_repository)):
    cuenta = repo.obtener_por_id(id)
    if not cuenta:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")
    return _cuenta_to_response(cuenta)


@router.post("", response_model=CuentaResponse)
def crear_cuenta(dto: CuentaDTO, repo: CuentaRepository = Depends(get_cuenta_repository)):
    nueva_cuenta = Cuenta(
        cuentaid=None,
        cuenta=dto.cuenta,
        permite_carga=dto.permite_carga,
        permite_conciliar=dto.permite_conciliar,
        tipo_cuenta_id=dto.tipo_cuenta_id
    )
    try:
        guardada = repo.guardar(nueva_cuenta)
        # Recargar para obtener datos del JOIN
        guardada = repo.obtener_por_id(guardada.cuentaid)
        return _cuenta_to_response(guardada)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/{id}", response_model=CuentaResponse)
def actualizar_cuenta(id: int, dto: CuentaDTO, repo: CuentaRepository = Depends(get_cuenta_repository)):
    existente = repo.obtener_por_id(id)
    if not existente:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    actualizada = Cuenta(
        cuentaid=id,
        cuenta=dto.cuenta,
        activa=existente.activa,
        permite_carga=dto.permite_carga,
        permite_conciliar=dto.permite_conciliar,
        tipo_cuenta_id=dto.tipo_cuenta_id
    )
    try:
        guardada = repo.guardar(actualizada)
        # Recargar para obtener datos del JOIN
        guardada = repo.obtener_por_id(guardada.cuentaid)
        return _cuenta_to_response(guardada)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{id}")
def eliminar_cuenta(id: int, repo: CuentaRepository = Depends(get_cuenta_repository)):
    existente = repo.obtener_por_id(id)
    if not existente:
        raise HTTPException(status_code=404, detail="Cuenta no encontrada")

    try:
        repo.eliminar(id)
        return {"mensaje": "Cuenta eliminada correctamente"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se puede eliminar la cuenta: {str(e)}")
