from typing import List, Dict, Any, Optional
from src.domain.models.movimiento import Movimiento
from src.domain.ports.movimiento_repository import MovimientoRepository
from src.domain.ports.moneda_repository import MonedaRepository
from src.domain.ports.cuenta_extractor_repository import CuentaExtractorRepository
import importlib
import traceback
from datetime import date
from src.infrastructure.extractors.utils import extraer_periodo_de_movimientos
from src.infrastructure.logging.config import logger

class CargarMovimientosService:
    """
    Servicio especializado en la carga mecánica de movimientos diarios (PDFs diarios, CSV, Excel).
    """
    def __init__(self, 
                 movimiento_repo: MovimientoRepository, 
                 moneda_repo: MonedaRepository,
                 cuenta_extractor_repo: Optional[CuentaExtractorRepository] = None):
        self.movimiento_repo = movimiento_repo
        self.moneda_repo = moneda_repo
        self.cuenta_extractor_repo = cuenta_extractor_repo
        self._monedas_cache = {}

    def _obtener_id_moneda(self, codigo_iso: str) -> int:
        """Resuelve el ID de moneda. Default: 1 (COP)."""
        if not codigo_iso or codigo_iso == 'COP':
            return 1
        
        if codigo_iso in self._monedas_cache:
            return self._monedas_cache[codigo_iso]
        
        todas = self.moneda_repo.obtener_todos()
        for m in todas:
            self._monedas_cache[m.isocode] = m.monedaid
            if m.isocode == codigo_iso:
                return m.monedaid
        return 1

    def _obtener_modulos_extractor_movimientos(self, cuenta_id: int) -> List[Any]:
        """Retorna LISTA de módulos extractores de movimientos configurados."""
        modulos_names = []
        if self.cuenta_extractor_repo and cuenta_id:
            db_modulos = self.cuenta_extractor_repo.obtener_modulos(cuenta_id, 'MOVIMIENTOS')
            if db_modulos:
                modulos_names = db_modulos

        if not modulos_names:
            EXTRACTORES_MOVIMIENTOS = {
                1: ['ahorros_movimientos'],
                3: ['fondorenta_movimientos'],
                6: ['mastercard_pesos_extracto_movimientos', 'mastercard_pesos_extracto_anterior_movimientos'],
                7: ['mastercard_usd_extracto_movimientos', 'mastercard_usd_extracto_anterior_movimientos']
            }
            modulos_names = EXTRACTORES_MOVIMIENTOS.get(cuenta_id, [])

        loaded_modules = []
        for nombre in modulos_names:
            try:
                module = importlib.import_module(f"src.infrastructure.extractors.bancolombia.{nombre}")
                loaded_modules.append(module)
            except Exception as e:
                print(f"Error importando extractor {nombre}: {e}")
        return loaded_modules

    def _extraer_movimientos(self, file_obj: Any, tipo_cuenta: str, cuenta_id: int = None) -> List[Dict[str, Any]]:
        """Extrae movimientos usando los extractores configurados."""
        modulos = self._obtener_modulos_extractor_movimientos(cuenta_id)
        
        if modulos:
            for module in modulos:
                try:
                    if hasattr(file_obj, 'seek'): file_obj.seek(0)
                    raw_movs = module.extraer_movimientos(file_obj)
                    if raw_movs:
                        for m in raw_movs:
                            if m.get('description'):
                                m['descripcion'] = m['description'].strip().title()
                            elif m.get('descripcion'):
                                m['descripcion'] = m['descripcion'].strip().title()
                        
                        if tipo_cuenta == 'MasterCardUSD':
                            raw_movs = [m for m in raw_movs if m.get('moneda') == 'USD']
                        elif tipo_cuenta == 'MasterCardPesos':
                            raw_movs = [m for m in raw_movs if m.get('moneda') == 'COP']
                        return raw_movs
                except Exception as e:
                    print(f"DEBUG: Extractor fallo: {e}")
                    continue
        return []

    def analizar_archivo(self, file_obj: Any, filename: str, tipo_cuenta: str, cuenta_id: Optional[int] = None) -> Dict[str, Any]:
        """Analiza el archivo previo a la carga (Previsualización)."""
        raw_movs = self._extraer_movimientos(file_obj, tipo_cuenta, cuenta_id)
        resultado_detalle = []
        stats = {"leidos": len(raw_movs), "duplicados": 0, "nuevos": 0, "actualizables": 0}
        
        for raw in raw_movs:
            try:
                es_usd = raw.get('moneda') == 'USD'
                valor_para_check = 0 if es_usd else raw['valor']
                usd_val = raw['valor'] if es_usd else None
                
                es_duplicado = self.movimiento_repo.existe_movimiento(
                    fecha=raw['fecha'], valor=valor_para_check,
                    referencia=raw.get('referencia', ''), cuenta_id=cuenta_id,
                    descripcion=raw['descripcion'], usd=usd_val
                )

                es_actualizable = False
                descripcion_actual = None

                if not es_duplicado and cuenta_id:
                    soft_match = self.movimiento_repo.obtener_exacto(
                        cuenta_id=cuenta_id, fecha=raw['fecha'],
                        valor=valor_para_check, referencia=None, descripcion=None
                    )
                    if soft_match:
                        es_actualizable = True
                        descripcion_actual = soft_match.descripcion

                if not es_duplicado and tipo_cuenta in ['MasterCardPesos', 'MasterCardUSD']:
                    posible_duplicado = self.movimiento_repo.existe_movimiento(
                        fecha=raw['fecha'], valor=valor_para_check,
                        referencia=raw.get('referencia', ''), cuenta_id=cuenta_id,
                        descripcion='', usd=usd_val
                    )
                    if posible_duplicado: es_duplicado = True

                if es_duplicado: stats["duplicados"] += 1
                elif es_actualizable: stats["actualizables"] += 1
                else: stats["nuevos"] += 1
                
                resultado_detalle.append({
                    "fecha": raw['fecha'], "descripcion": raw['descripcion'],
                    "referencia": raw.get('referencia', ''), "valor": raw['valor'],
                    "moneda": raw.get('moneda', 'COP'), "es_duplicado": es_duplicado,
                    "es_actualizable": es_actualizable, "descripcion_actual": descripcion_actual
                })
            except Exception as e:
                stats["nuevos"] += 1
                resultado_detalle.append({"fecha": "Error", "descripcion": str(e), "es_duplicado": False})
                
        resultado_detalle.sort(key=lambda x: x['fecha'] if x['fecha'] else '1900-01-01', reverse=True)
        resultado_detalle.sort(key=lambda x: 0 if not x['es_duplicado'] else 1)
        
        return {
            "estadisticas": stats, 
            "movimientos": resultado_detalle,
            "periodo": extraer_periodo_de_movimientos(resultado_detalle)
        }

    def procesar_archivo(self, file_obj: Any, filename: str, tipo_cuenta: str, cuenta_id: int, actualizar_descripciones: bool = False) -> Dict[str, Any]:
        """Carga formal de los movimientos a la base de datos."""
        raw_movs = self._extraer_movimientos(file_obj, tipo_cuenta, cuenta_id)
        insertados, actualizados, duplicados, errores = 0, 0, 0, 0
        detalle_errores = []

        # Financial stats por categoría
        ingresos_cargados = 0
        egresos_cargados = 0
        ingresos_duplicados = 0
        egresos_duplicados = 0
        ingresos_errores = 0
        egresos_errores = 0
        ingresos_cargados_usd = 0
        egresos_cargados_usd = 0
        ingresos_duplicados_usd = 0
        egresos_duplicados_usd = 0
        ingresos_errores_usd = 0
        egresos_errores_usd = 0
        
        for raw in raw_movs:
            try:
                es_usd = raw.get('moneda') == 'USD'
                valor_para_bd = 0 if es_usd else raw['valor']
                valor_para_check = 0 if es_usd else raw['valor']
                usd_val = raw['valor'] if es_usd else None
                moneda_id = 1 if es_usd else self._obtener_id_moneda(raw.get('moneda', 'COP'))
                valor = float(raw['valor'])

                existe = self.movimiento_repo.existe_movimiento(
                    fecha=raw['fecha'], valor=valor_para_check,
                    referencia=raw.get('referencia', ''), cuenta_id=cuenta_id,
                    descripcion=raw['descripcion'], usd=usd_val
                )
                
                if not existe and tipo_cuenta in ['MasterCardPesos', 'MasterCardUSD']:
                    existe = self.movimiento_repo.existe_movimiento(
                        fecha=raw['fecha'], valor=valor_para_check,
                        referencia=raw.get('referencia', ''), cuenta_id=cuenta_id,
                        descripcion='', usd=usd_val
                    )
                
                if existe:
                    duplicados += 1
                    if es_usd:
                        if valor > 0:
                            ingresos_duplicados_usd += valor
                        else:
                            egresos_duplicados_usd += valor
                    else:
                        if valor > 0:
                            ingresos_duplicados += valor
                        else:
                            egresos_duplicados += valor
                    continue
                
                if actualizar_descripciones:
                    soft_match = self.movimiento_repo.obtener_exacto(
                        cuenta_id=cuenta_id, fecha=raw['fecha'],
                        valor=valor_para_check, referencia=None, descripcion=None
                    )
                    if soft_match:
                        soft_match.descripcion = raw['descripcion']
                        if raw.get('referencia'): soft_match.referencia = raw['referencia']
                        self.movimiento_repo.guardar(soft_match)
                        actualizados += 1
                        # Los actualizados se cuentan como cargados para stats financieras
                        if es_usd:
                            if valor > 0:
                                ingresos_cargados_usd += valor
                            else:
                                egresos_cargados_usd += valor
                        else:
                            if valor > 0:
                                ingresos_cargados += valor
                            else:
                                egresos_cargados += valor
                        continue

                fecha_obj = date.fromisoformat(raw['fecha'])
                
                nuevo_mov = Movimiento(
                    fecha=fecha_obj, descripcion=raw['descripcion'],
                    referencia=raw.get('referencia', ''), valor=valor_para_bd,
                    moneda_id=moneda_id, cuenta_id=cuenta_id, usd=usd_val
                )
                self.movimiento_repo.guardar(nuevo_mov)
                insertados += 1
                if es_usd:
                    if valor > 0:
                        ingresos_cargados_usd += valor
                    else:
                        egresos_cargados_usd += valor
                else:
                    if valor > 0:
                        ingresos_cargados += valor
                    else:
                        egresos_cargados += valor
            except Exception as e:
                logger.error(f"ERROR procesando movimiento: {e}")
                logger.error(traceback.format_exc())
                errores += 1
                # Acumular stats de errores
                try:
                    valor_err = float(raw.get('valor', 0))
                    es_usd_err = raw.get('moneda') == 'USD'
                    if es_usd_err:
                        if valor_err > 0:
                            ingresos_errores_usd += valor_err
                        else:
                            egresos_errores_usd += valor_err
                    else:
                        if valor_err > 0:
                            ingresos_errores += valor_err
                        else:
                            egresos_errores += valor_err
                except:
                    pass
                detalle_errores.append({
                    "fecha": raw.get('fecha', '?'),
                    "descripcion": raw.get('descripcion', '?'),
                    "valor": str(raw.get('valor', '?')),
                    "error": str(e)
                })
                
        return {
            "archivo": filename, "total_extraidos": len(raw_movs),
            "nuevos_insertados": insertados, "actualizados": actualizados,
            "duplicados": duplicados, "errores": errores, "detalle_errores": detalle_errores,
            "periodo": extraer_periodo_de_movimientos(raw_movs),
            # Totales (para compatibilidad)
            "total_ingresos": ingresos_cargados + ingresos_duplicados + ingresos_errores,
            "total_egresos": egresos_cargados + egresos_duplicados + egresos_errores,
            "total_ingresos_usd": ingresos_cargados_usd + ingresos_duplicados_usd + ingresos_errores_usd,
            "total_egresos_usd": egresos_cargados_usd + egresos_duplicados_usd + egresos_errores_usd,
            # Desglose por categoría COP
            "ingresos_cargados": ingresos_cargados,
            "egresos_cargados": egresos_cargados,
            "ingresos_duplicados": ingresos_duplicados,
            "egresos_duplicados": egresos_duplicados,
            "ingresos_errores": ingresos_errores,
            "egresos_errores": egresos_errores,
            # Desglose por categoría USD
            "ingresos_cargados_usd": ingresos_cargados_usd,
            "egresos_cargados_usd": egresos_cargados_usd,
            "ingresos_duplicados_usd": ingresos_duplicados_usd,
            "egresos_duplicados_usd": egresos_duplicados_usd,
            "ingresos_errores_usd": ingresos_errores_usd,
            "egresos_errores_usd": egresos_errores_usd
        }
