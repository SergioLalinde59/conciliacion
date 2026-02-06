from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException
from fastapi.responses import FileResponse
from typing import Dict, Any, Optional, List
from decimal import Decimal
import os
import json
import pdfplumber

from src.application.services.procesador_archivos_service import ProcesadorArchivosService
from src.infrastructure.api.dependencies import get_movimiento_repository, get_moneda_repository, get_tercero_repository, get_conciliacion_repository, get_movimiento_extracto_repository, get_cuenta_extractor_repository
from src.domain.ports.movimiento_repository import MovimientoRepository
from src.domain.ports.moneda_repository import MonedaRepository
from src.domain.ports.tercero_repository import TerceroRepository
from src.domain.ports.conciliacion_repository import ConciliacionRepository
from src.domain.ports.movimiento_extracto_repository import MovimientoExtractoRepository
from src.domain.ports.cuenta_extractor_repository import CuentaExtractorRepository

router = APIRouter(prefix="/api/archivos", tags=["archivos"])

def get_procesador_service(
    mov_repo: MovimientoRepository = Depends(get_movimiento_repository),
    moneda_repo: MonedaRepository = Depends(get_moneda_repository),
    tercero_repo: TerceroRepository = Depends(get_tercero_repository),
    conciliacion_repo: ConciliacionRepository = Depends(get_conciliacion_repository),
    movimiento_extracto_repo: MovimientoExtractoRepository = Depends(get_movimiento_extracto_repository),
    cuenta_extractor_repo: CuentaExtractorRepository = Depends(get_cuenta_extractor_repository)
) -> ProcesadorArchivosService:
    return ProcesadorArchivosService(mov_repo, moneda_repo, tercero_repo, conciliacion_repo, movimiento_extracto_repo, cuenta_extractor_repo)

@router.post("/cargar")
async def cargar_archivo(
    file: UploadFile = File(...),
    tipo_cuenta: str = Form(...),
    cuenta_id: int = Form(...),
    actualizar_descripciones: bool = Form(False),
    service: ProcesadorArchivosService = Depends(get_procesador_service)
) -> Dict[str, Any]:
    """
    Carga un archivo PDF (extracto) y procesa los movimientos.
    
    Args:
        file: El archivo PDF.
        tipo_cuenta: 'Ahorros', 'FondoRenta', 'MasterCardPesos', 'MasterCardUSD'.
        cuenta_id: ID de la cuenta en base de datos a asociar.
        actualizar_descripciones: Si es True, actualiza la descripción de movimientos existentes (fecha+valor).
    """
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    try:
        # file.file es un SpooledTemporaryFile compatible con pdfplumber
        resultado = service.procesar_archivo(file.file, file.filename, tipo_cuenta, cuenta_id, actualizar_descripciones)
        return resultado
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error procesando archivo: {str(e)}")

@router.post("/analizar")
async def analizar_archivo(
    file: UploadFile = File(...),
    tipo_cuenta: str = Form(...),
    cuenta_id: Optional[int] = Form(None),
    service: ProcesadorArchivosService = Depends(get_procesador_service)
) -> Dict[str, Any]:
    """
    Analiza un archivo PDF y retorna estadísticas preliminares sin guardar.
    """
    print(f"DEBUG ROUTER: analizar_archivo called. tipo_cuenta={tipo_cuenta}, cuenta_id={cuenta_id}, filename={file.filename}")
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Solo se permiten archivos PDF")

    try:
        resultado = service.analizar_archivo(file.file, file.filename, tipo_cuenta, cuenta_id)
        return resultado
    except ValueError as ve:
        raise HTTPException(status_code=400, detail=str(ve))

@router.get("/listar-directorios")
async def listar_directorios(tipo: str) -> List[str]:
    """
    Lista los archivos PDF disponibles en el directorio configurado para el tipo 'movimientos' o 'extractos'.
    """
    directory = ""
    if tipo == "movimientos":
        directory = os.getenv("DIRECTORIO_MOVIMIENTOS", "")
    elif tipo == "extractos":
        directory = os.getenv("DIRECTORIO_EXTRACTOS", "")
    else:
        raise HTTPException(status_code=400, detail="Tipo inválido. Use 'movimientos' o 'extractos'.")

    if not directory or not os.path.exists(directory):
        # Si no está configurado o no existe, retornamos lista vacía o error.
        # Retornaremos vacía para no romper el front si no está configurado.
        print(f"Directorio no encontrado o no configurado: {directory}")
        return []

    try:
        files = [f for f in os.listdir(directory) if f.lower().endswith('.pdf')]
        return files
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error leyendo directorio: {str(e)}")

@router.get("/ver-pdf")
async def ver_pdf(filename: str, tipo: str = "extractos"):
    """
    Sirve un archivo PDF del directorio configurado.
    """
    if tipo == "extractos":
        directory = os.getenv("DIRECTORIO_EXTRACTOS", "")
    elif tipo == "movimientos":
        directory = os.getenv("DIRECTORIO_MOVIMIENTOS", "")
    else:
        raise HTTPException(status_code=400, detail="Tipo inválido")

    if not directory or not os.path.exists(directory):
        raise HTTPException(status_code=404, detail="Directorio no configurado")

    filepath = os.path.join(directory, filename)

    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado")

    # content_disposition_type="inline" para mostrar en navegador, no descargar
    return FileResponse(filepath, media_type="application/pdf", headers={"Content-Disposition": "inline"})

@router.get("/buscar-pagina-resumen")
async def buscar_pagina_resumen(filename: str, moneda: str = "PESOS"):
    """
    Busca la página donde aparece 'Resumen Saldo Total' para la moneda especificada.

    Args:
        filename: Nombre del archivo PDF
        moneda: 'PESOS' o 'DOLARES'

    Returns:
        { "pagina": número_de_página } o { "pagina": 1 } si no encuentra
    """
    directory = os.getenv("DIRECTORIO_EXTRACTOS", "")
    if not directory or not os.path.exists(directory):
        return {"pagina": 1}

    filepath = os.path.join(directory, filename)
    if not os.path.exists(filepath):
        return {"pagina": 1}

    try:
        with pdfplumber.open(filepath) as pdf:
            # Buscar la sección de la moneda correcta
            moneda_texto = f"Moneda: {moneda.upper()}"
            en_seccion_correcta = False

            for page_num, page in enumerate(pdf.pages, start=1):
                texto = page.extract_text() or ""

                # Verificar si entramos en la sección de moneda correcta
                if moneda_texto in texto:
                    en_seccion_correcta = True

                # Si cambiamos a otra moneda, salimos de la sección
                if en_seccion_correcta:
                    if "Moneda: PESOS" in texto and moneda.upper() != "PESOS":
                        en_seccion_correcta = False
                    elif "Moneda: DOLARES" in texto and moneda.upper() != "DOLARES":
                        en_seccion_correcta = False

                # Buscar "Resumen Saldo Total" solo si estamos en la sección correcta
                if en_seccion_correcta and "Resumen Saldo Total" in texto:
                    return {"pagina": page_num}

            # Si no encontró, retornar página 1
            return {"pagina": 1}

    except Exception as e:
        print(f"Error buscando página de resumen: {e}")
        return {"pagina": 1}

@router.post("/procesar-local")
async def procesar_archivo_local(
    filename: str = Form(...),
    tipo: str = Form(...), # 'movimientos' o 'extractos'
    tipo_cuenta: str = Form(...),
    cuenta_id: Optional[int] = Form(None),
    actualizar_descripciones: bool = Form(False),
    year: Optional[int] = Form(None),
    month: Optional[int] = Form(None),
    accion: str = Form("analizar"), # 'analizar' o 'cargar'
    # Optional overrides
    saldo_anterior: Optional[Decimal] = Form(None),
    entradas: Optional[Decimal] = Form(None),
    salidas: Optional[Decimal] = Form(None),
    saldo_final: Optional[Decimal] = Form(None),
    rendimientos: Optional[Decimal] = Form(None),
    retenciones: Optional[Decimal] = Form(None),
    # Movimientos confirmados por el usuario (JSON string)
    movimientos_json: Optional[str] = Form(None),
    service: ProcesadorArchivosService = Depends(get_procesador_service)
) -> Dict[str, Any]:
    """
    Procesa un archivo local (del servidor) como si fuera un upload.
    accion: 'analizar' o 'cargar'
    """
    directory = ""
    if tipo == "movimientos":
        directory = os.getenv("DIRECTORIO_MOVIMIENTOS", "")
    elif tipo == "extractos":
        directory = os.getenv("DIRECTORIO_EXTRACTOS", "")
    else:
        raise HTTPException(status_code=400, detail="Tipo inválido")

    if not directory:
        raise HTTPException(status_code=500, detail="Directorio base no configurado")
        
    filepath = os.path.join(directory, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Archivo no encontrado en el servidor")

    try:
        with open(filepath, 'rb') as f:
            if accion == "analizar":
                if tipo == "movimientos":
                    return service.analizar_archivo(f, filename, tipo_cuenta, cuenta_id)
                elif tipo == "extractos":
                    return service.analizar_extracto(f, filename, tipo_cuenta, cuenta_id)
            elif accion == "cargar":
                if tipo == "movimientos":
                    return service.procesar_archivo(f, filename, tipo_cuenta, cuenta_id, actualizar_descripciones)
                elif tipo == "extractos":
                    # Prepare overrides
                    overrides = {}
                    if saldo_anterior is not None: overrides['saldo_anterior'] = saldo_anterior
                    if entradas is not None: overrides['entradas'] = entradas
                    if salidas is not None: overrides['salidas'] = salidas
                    if saldo_final is not None: overrides['saldo_final'] = saldo_final
                    if rendimientos is not None: overrides['rendimientos'] = rendimientos
                    if retenciones is not None: overrides['retenciones'] = retenciones

                    # Parsear movimientos confirmados
                    movimientos_confirmados = None
                    if movimientos_json:
                        try:
                            movimientos_confirmados = json.loads(movimientos_json)
                        except json.JSONDecodeError as je:
                            print(f"Error parseando movimientos_json: {je}")

                    return await service.procesar_extracto(f, filename, tipo_cuenta, cuenta_id, year, month, overrides=overrides, movimientos_confirmados=movimientos_confirmados)

    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error procesando archivo local: {str(e)}")
        
        
    # Re-route logic for extractos if needed
    if tipo not in ["movimientos", "extractos"]:
         raise HTTPException(status_code=400, detail="Tipo desconocido")

    return {"status": "ok"}

@router.get("/extractos-cuenta/{cuenta_id}")
async def obtener_extractos_cuenta(
    cuenta_id: int,
    limit: int = 100,
    extracto_repo: MovimientoExtractoRepository = Depends(get_movimiento_extracto_repository)
) -> Dict[str, Any]:
    """
    Obtiene los registros actuales de movimientos_extracto para una cuenta.
    Útil para mostrar qué registros existen antes de cargar nuevos.
    """
    try:
        total = extracto_repo.contar_por_cuenta(cuenta_id)
        registros = extracto_repo.obtener_por_cuenta(cuenta_id, limit)

        return {
            "total": total,
            "mostrados": len(registros),
            "registros": [
                {
                    "id": r.id,
                    "cuenta_id": r.cuenta_id,
                    "fecha": r.fecha.isoformat() if r.fecha else None,
                    "descripcion": r.descripcion,
                    "referencia": r.referencia,
                    "valor": float(r.valor) if r.valor else 0,
                    "usd": float(r.usd) if r.usd else None,
                    "year": r.year,
                    "month": r.month
                }
                for r in registros
            ]
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error consultando extractos: {str(e)}")

@router.get("/extractos-todas-cuentas")
async def obtener_extractos_todas_cuentas(
    limit_por_cuenta: int = 50,
    extracto_repo: MovimientoExtractoRepository = Depends(get_movimiento_extracto_repository)
) -> Dict[str, Any]:
    """
    Obtiene los registros de movimientos_extracto para todas las cuentas.
    Agrupa por cuenta_id para filtrado en frontend.
    """
    from src.infrastructure.api.dependencies import get_cuenta_repository, get_db_connection
    from src.infrastructure.database.postgres_cuenta_repository import PostgresCuentaRepository

    try:
        # Obtener todas las cuentas que permiten carga
        conn = extracto_repo.conn
        cuenta_repo = PostgresCuentaRepository(conn)
        cuentas = cuenta_repo.listar_todas()
        cuentas_carga = [c for c in cuentas if c.permite_carga]

        resultado = {}
        for cuenta in cuentas_carga:
            total = extracto_repo.contar_por_cuenta(cuenta.id)
            registros = extracto_repo.obtener_por_cuenta(cuenta.id, limit_por_cuenta)

            # Calcular ingresos y egresos
            ingresos = sum(float(r.valor) for r in registros if r.valor and float(r.valor) > 0)
            egresos = sum(float(r.valor) for r in registros if r.valor and float(r.valor) < 0)
            ingresos_usd = sum(float(r.usd) for r in registros if r.usd and float(r.usd) > 0)
            egresos_usd = sum(float(r.usd) for r in registros if r.usd and float(r.usd) < 0)

            resultado[cuenta.id] = {
                "cuenta_nombre": cuenta.nombre,
                "total": total,
                "ingresos": ingresos,
                "egresos": abs(egresos),
                "ingresos_usd": ingresos_usd if ingresos_usd else None,
                "egresos_usd": abs(egresos_usd) if egresos_usd else None,
                "registros": [
                    {
                        "id": r.id,
                        "cuenta_id": r.cuenta_id,
                        "fecha": r.fecha.isoformat() if r.fecha else None,
                        "descripcion": r.descripcion,
                        "referencia": r.referencia,
                        "valor": float(r.valor) if r.valor else 0,
                        "usd": float(r.usd) if r.usd else None,
                        "year": r.year,
                        "month": r.month
                    }
                    for r in registros
                ]
            }

        return resultado
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error consultando extractos: {str(e)}")

