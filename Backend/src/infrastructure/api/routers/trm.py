from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from datetime import date

from src.application.services.trm_application_service import TrmApplicationService
from src.infrastructure.api.dependencies import get_trm_application_service

router = APIRouter(prefix="/api/trm", tags=["trm"])


class AplicarTrmRequest(BaseModel):
    cuenta_id: int
    fecha_pago: date
    fecha_inicio: date
    fecha_fin: date


@router.get("/consultar")
def consultar_trm(
    fecha: date,
    service: TrmApplicationService = Depends(get_trm_application_service)
):
    """Consulta la TRM para una fecha (cache + API externa datos.gov.co)."""
    trm = service.obtener_trm(fecha)
    if not trm:
        raise HTTPException(status_code=404, detail=f"No se encontró TRM para {fecha}")
    return {
        "fecha": str(trm.fecha),
        "valor": float(trm.valor),
        "fuente": trm.fuente
    }


@router.post("/aplicar")
def aplicar_trm(
    request: AplicarTrmRequest,
    service: TrmApplicationService = Depends(get_trm_application_service)
):
    """
    Aplica la TRM de la fecha de pago a los movimientos USD
    de una cuenta en el periodo dado.

    Actualiza encabezado.valor, encabezado.trm y detalle.Valor a COP.
    """
    try:
        resultado = service.aplicar_trm_a_cuenta(
            cuenta_id=request.cuenta_id,
            fecha_pago=request.fecha_pago,
            fecha_inicio=request.fecha_inicio,
            fecha_fin=request.fecha_fin
        )
        return resultado
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error aplicando TRM: {str(e)}")
