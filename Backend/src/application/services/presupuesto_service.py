from typing import List, Optional, Dict
from decimal import Decimal
import logging

from src.domain.models.presupuesto import Presupuesto
from src.domain.models.presupuesto_detalle import PresupuestoDetalle
from src.domain.models.generacion_result import GeneracionResult
from src.domain.models.regla_presupuesto import ReglaPresupuesto
from src.domain.ports.presupuesto_repository import PresupuestoRepository
from src.domain.ports.presupuesto_detalle_repository import PresupuestoDetalleRepository
from src.domain.ports.presupuesto_generacion_repository import PresupuestoGeneracionRepository
from src.domain.ports.presupuesto_comparacion_repository import PresupuestoComparacionRepository
from src.domain.ports.tipo_gasto_repository import TipoGastoRepository
from src.domain.ports.indicador_economico_repository import IndicadorEconomicoRepository
from src.domain.ports.regla_presupuesto_repository import ReglaPresupuestoRepository
from src.domain.services.presupuesto_generacion_service import PresupuestoGeneracionDomainService

logger = logging.getLogger(__name__)


class PresupuestoService:
    """Servicio de aplicación para orquestar operaciones de presupuesto"""

    def __init__(
        self,
        presupuesto_repo: PresupuestoRepository,
        detalle_repo: PresupuestoDetalleRepository,
        generacion_repo: PresupuestoGeneracionRepository,
        comparacion_repo: PresupuestoComparacionRepository,
        tipo_gasto_repo: TipoGastoRepository,
        indicador_repo: IndicadorEconomicoRepository,
        regla_repo: ReglaPresupuestoRepository,
        generacion_service: PresupuestoGeneracionDomainService
    ):
        self._presupuesto_repo = presupuesto_repo
        self._detalle_repo = detalle_repo
        self._generacion_repo = generacion_repo
        self._comparacion_repo = comparacion_repo
        self._tipo_gasto_repo = tipo_gasto_repo
        self._indicador_repo = indicador_repo
        self._regla_repo = regla_repo
        self._generacion_service = generacion_service

    def crear_presupuesto(
        self, anio: int, nombre: str,
        semaforo_verde_hasta: float, semaforo_amarillo_hasta: float,
        umbral_minimo_mensual: float = 0.0, umbral_minimo_anual: float = 0.0,
        umbral_no_repetitivo: int = 4,
        notas: Optional[str] = None
    ) -> Presupuesto:
        """Crea un nuevo presupuesto en estado borrador"""
        presupuesto = Presupuesto(
            anio=anio, nombre=nombre, notas=notas,
            semaforo_verde_hasta=semaforo_verde_hasta,
            semaforo_amarillo_hasta=semaforo_amarillo_hasta,
            umbral_minimo_mensual=umbral_minimo_mensual,
            umbral_minimo_anual=umbral_minimo_anual,
            umbral_no_repetitivo=umbral_no_repetitivo
        )
        return self._presupuesto_repo.guardar(presupuesto)

    def _enriquecer_reglas_auto(
        self,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]],
        reglas: list,
        tipos_gasto: list,
        umbral: int
    ) -> list:
        """Enriquece la lista de reglas con auto-clasificaciones para combos sin regla CC-específica."""
        combos = self._generacion_repo.obtener_combinaciones_gasto(
            anio_fuente, centros_costos_excluidos
        )
        tipos_map = {t.tipo: t for t in tipos_gasto}

        auto_reglas = []
        for combo in combos:
            regla = self._generacion_service.resolver_regla(
                combo["centro_costo_id"], combo["concepto_id"], reglas
            )
            if regla.centro_costo_id is not None:
                continue  # Ya tiene regla CC-específica

            tipo = self._generacion_service.auto_clasificar_tipo_gasto(
                combo["concepto_nombre"],
                combo["centro_costo_nombre"],
                combo["meses_activos"],
                umbral
            )
            tipo_obj = tipos_map.get(tipo)
            # Sentinel: si el tipo no tiene indicador_default (ej: Fijo), usar IPC Colombia
            # para que la regla sintética pase validación. El domain service detectará
            # fijos sin monto_fijo como "fijos_sin_monto" pendientes de input del usuario.
            indicador = (tipo_obj.indicador_default
                         if tipo_obj and tipo_obj.indicador_default
                         else 'IPC Colombia')

            auto_reglas.append(ReglaPresupuesto(
                centro_costo_id=combo["centro_costo_id"],
                concepto_id=combo["concepto_id"],
                tipo_gasto=tipo,
                indicador_nombre=indicador,
                factor_ajuste=Decimal('0')
            ))

        return list(reglas) + auto_reglas

    def _obtener_datos_generacion(
        self, presupuesto_id: int, anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        umbral: Optional[int] = None
    ):
        """Obtiene datos necesarios para generación/previsualización"""
        presupuesto = self._presupuesto_repo.obtener_por_id(presupuesto_id)
        if not presupuesto:
            raise ValueError("Presupuesto no encontrado")
        if not presupuesto.puede_editar:
            raise ValueError("Solo se pueden generar líneas en presupuestos en estado borrador")

        umbral_efectivo = umbral if umbral is not None else presupuesto.umbral_no_repetitivo

        # Obtener datos fuente
        detalles = self._generacion_repo.generar_base_desde_anio(
            anio_fuente=anio_fuente,
            centros_costos_excluidos=centros_costos_excluidos
        )
        if not detalles:
            raise ValueError(f"No se encontraron datos para el año {anio_fuente}")

        # Obtener reglas e indicadores
        reglas = self._regla_repo.obtener_todos()
        indicadores_list = self._indicador_repo.obtener_por_anio(presupuesto.anio)
        if not indicadores_list:
            raise ValueError(
                f"No hay indicadores económicos configurados para {presupuesto.anio}. "
                "Configure indicadores antes de generar."
            )
        indicadores: Dict[str, Decimal] = {
            i.indicador: i.valor_porcentaje for i in indicadores_list
        }

        # Tipos excluidos
        tipos_gasto = self._tipo_gasto_repo.obtener_todos()
        tipos_excluidos = [t.tipo for t in tipos_gasto if t.excluir_presupuesto]

        # Auto-clasificación: enriquecer reglas con detección inteligente
        reglas = self._enriquecer_reglas_auto(
            anio_fuente, centros_costos_excluidos, reglas, tipos_gasto, umbral_efectivo
        )

        return presupuesto, detalles, reglas, indicadores, tipos_excluidos, umbral_efectivo

    def previsualizar_generacion(
        self,
        presupuesto_id: int,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        umbral: Optional[int] = None
    ) -> GeneracionResult:
        """Vista previa de generación sin persistir"""
        presupuesto, detalles, reglas, indicadores, tipos_excluidos, umbral_efectivo = \
            self._obtener_datos_generacion(presupuesto_id, anio_fuente, centros_costos_excluidos, umbral)

        # Asignar presupuesto_id temporalmente
        for d in detalles:
            d.presupuesto_id = presupuesto_id

        result = self._generacion_service.clasificar_y_aumentar(
            lineas_raw=detalles,
            reglas=reglas,
            indicadores=indicadores,
            tipos_excluidos=tipos_excluidos,
            umbral=umbral_efectivo
        )

        # Agregar info de indicadores al resumen
        indicadores_info = {
            i.indicador: {"nombre": i.indicador, "valor": float(i.valor_porcentaje)}
            for i in self._indicador_repo.obtener_por_anio(presupuesto.anio)
        }
        result.resumen["indicadores"] = indicadores_info

        return result

    def generar_desde_anio_anterior(
        self,
        presupuesto_id: int,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        umbral: Optional[int] = None,
        no_repetitivos_incluidos: Optional[List[dict]] = None,
        montos_fijos: Optional[List[dict]] = None
    ) -> dict:
        """Genera líneas de presupuesto con clasificación inteligente y aumentos"""
        presupuesto, detalles, reglas, indicadores, tipos_excluidos, umbral_efectivo = \
            self._obtener_datos_generacion(presupuesto_id, anio_fuente, centros_costos_excluidos, umbral)

        # Asignar presupuesto_id
        for d in detalles:
            d.presupuesto_id = presupuesto_id

        result = self._generacion_service.clasificar_y_aumentar(
            lineas_raw=detalles,
            reglas=reglas,
            indicadores=indicadores,
            tipos_excluidos=tipos_excluidos,
            umbral=umbral_efectivo
        )

        # Incluir no repetitivos seleccionados manualmente
        incluidos_extra = 0
        if no_repetitivos_incluidos:
            for item in no_repetitivos_incluidos:
                for nr_linea in detalles:
                    if (nr_linea.centro_costo_id == item.get('centro_costo_id') and
                        nr_linea.concepto_id == item.get('concepto_id') and
                        nr_linea.tercero_id == item.get('tercero_id') and
                        nr_linea.mes == item.get('mes')):
                        regla = self._generacion_service.resolver_regla(
                            nr_linea.centro_costo_id, nr_linea.concepto_id, reglas
                        )
                        self._generacion_service._aplicar_aumento(nr_linea, regla, indicadores)
                        result.regulares.append(nr_linea)
                        incluidos_extra += 1
                        break

        # Incluir gastos fijos con montos proporcionados por el usuario
        fijos_incluidos = 0
        # Indexar montos_fijos por (cc, concepto, tercero) para aplicar a todos los meses
        montos_fijos_map: Dict[tuple, Decimal] = {}
        if montos_fijos:
            for item in montos_fijos:
                key = (item.get('centro_costo_id'), item.get('concepto_id'), item.get('tercero_id'))
                monto = item.get('monto_fijo')
                if monto is not None and monto > 0:
                    montos_fijos_map[key] = Decimal(str(monto))

        for fijo_info in result.fijos_sin_monto:
            key = (fijo_info['centro_costo_id'], fijo_info['concepto_id'], fijo_info['tercero_id'])
            monto_fijo = montos_fijos_map.get(key)

            # Buscar la línea original en detalles
            for linea in detalles:
                if (linea.centro_costo_id == fijo_info['centro_costo_id'] and
                    linea.concepto_id == fijo_info['concepto_id'] and
                    linea.tercero_id == fijo_info['tercero_id'] and
                    linea.mes == fijo_info['mes']):
                    linea.monto_base = linea.monto_presupuestado
                    linea.monto_presupuestado = monto_fijo if monto_fijo else linea.monto_presupuestado
                    linea.tipo = 'Fijo'
                    result.regulares.append(linea)
                    fijos_incluidos += 1
                    break

        # Persistir
        logger.info(f"Generando presupuesto {presupuesto_id} desde año {anio_fuente}")
        count = self._detalle_repo.guardar_lote(result.regulares)
        logger.info(f"Se generaron {count} líneas de presupuesto desde año {anio_fuente}")

        return {
            "lineas_generadas": count,
            "lineas_excluidas": len(result.no_repetitivos),
            "incluidos_manualmente": incluidos_extra,
            "fijos_incluidos": fijos_incluidos,
            "resumen": result.resumen
        }

    def aplicar_ajuste_global(self, presupuesto_id: int, porcentaje: Decimal) -> int:
        """Aplica un ajuste porcentual a todas las líneas"""
        presupuesto = self._presupuesto_repo.obtener_por_id(presupuesto_id)
        if not presupuesto:
            raise ValueError("Presupuesto no encontrado")
        if not presupuesto.puede_editar:
            raise ValueError("Solo se pueden ajustar presupuestos en estado borrador")

        count = self._detalle_repo.aplicar_ajuste_global(presupuesto_id, porcentaje)
        logger.info(f"Ajuste global de {porcentaje}% aplicado a {count} líneas del presupuesto {presupuesto_id}")
        return count

    def aplicar_ajuste_por_centro_costo(
        self, presupuesto_id: int, centro_costo_id: int, porcentaje: Decimal
    ) -> int:
        """Aplica un ajuste porcentual a las líneas de un centro de costo"""
        presupuesto = self._presupuesto_repo.obtener_por_id(presupuesto_id)
        if not presupuesto:
            raise ValueError("Presupuesto no encontrado")
        if not presupuesto.puede_editar:
            raise ValueError("Solo se pueden ajustar presupuestos en estado borrador")

        count = self._detalle_repo.aplicar_ajuste_centro_costo(presupuesto_id, centro_costo_id, porcentaje)
        logger.info(f"Ajuste de {porcentaje}% al CC {centro_costo_id}: {count} líneas afectadas")
        return count

    def aplicar_ajuste_linea(self, detalle_id: int, monto: Decimal) -> PresupuestoDetalle:
        """Ajusta el monto de una línea específica"""
        return self._detalle_repo.aplicar_ajuste_linea(detalle_id, monto)

    def activar_presupuesto(self, presupuesto_id: int) -> Presupuesto:
        """Activa un presupuesto. Solo uno puede estar activo por año."""
        presupuesto = self._presupuesto_repo.obtener_por_id(presupuesto_id)
        if not presupuesto:
            raise ValueError("Presupuesto no encontrado")
        presupuesto.activar()
        return self._presupuesto_repo.cambiar_estado(presupuesto_id, 'activo')

    def cerrar_presupuesto(self, presupuesto_id: int) -> Presupuesto:
        """Cierra un presupuesto activo"""
        presupuesto = self._presupuesto_repo.obtener_por_id(presupuesto_id)
        if not presupuesto:
            raise ValueError("Presupuesto no encontrado")
        presupuesto.cerrar()
        return self._presupuesto_repo.cambiar_estado(presupuesto_id, 'cerrado')

    def obtener_clasificacion_preview(
        self,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None
    ) -> List[dict]:
        """Preview de clasificación: muestra cada combo CC/Concepto con regla explícita o auto-clasificación."""
        combos = self._generacion_repo.obtener_combinaciones_gasto(
            anio_fuente, centros_costos_excluidos
        )
        if not combos:
            return []

        reglas = self._regla_repo.obtener_todos()
        tipos_gasto = self._tipo_gasto_repo.obtener_todos()
        tipos_map = {t.tipo: t for t in tipos_gasto}

        result = []
        for combo in combos:
            regla = self._generacion_service.resolver_regla(
                combo["centro_costo_id"],
                combo["concepto_id"],
                reglas
            )

            # Nivel de match de la regla explícita
            if regla.centro_costo_id is not None and regla.concepto_id is not None:
                nivel_match = "CC+Concepto"
            elif regla.centro_costo_id is not None and regla.concepto_id is None:
                nivel_match = "CC"
            elif regla.id is not None:
                nivel_match = "Global"
            else:
                nivel_match = "Default"

            tipo_gasto = regla.tipo_gasto
            indicador_nombre = regla.indicador_nombre
            factor_ajuste = float(regla.factor_ajuste)

            # Auto-clasificar cuando no hay regla CC-específica (Global o Default)
            if regla.centro_costo_id is None:
                tipo = self._generacion_service.auto_clasificar_tipo_gasto(
                    combo["concepto_nombre"],
                    combo["centro_costo_nombre"],
                    combo["meses_activos"],
                )
                tipo_obj = tipos_map.get(tipo)
                tipo_gasto = tipo
                indicador_nombre = (tipo_obj.indicador_default
                                    if tipo_obj and tipo_obj.indicador_default
                                    else None)
                factor_ajuste = 0.0
                nivel_match = "Auto"

            monto_fijo = (float(regla.monto_fijo_mensual)
                          if regla.monto_fijo_mensual is not None else None)

            result.append({
                **combo,
                "regla_id": regla.id,
                "nivel_match": nivel_match,
                "tipo_gasto": tipo_gasto,
                "indicador_nombre": indicador_nombre,
                "factor_ajuste": factor_ajuste,
                "monto_fijo_mensual": monto_fijo,
            })

        return result

    def comparar_presupuesto_vs_real(
        self,
        presupuesto_id: int,
        nivel: str,
        mes_inicio: int = 1,
        mes_fin: int = 12,
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None,
        centros_costos_excluidos: Optional[List[int]] = None
    ) -> List[dict]:
        """Compara presupuesto vs ejecución real al nivel solicitado"""
        presupuesto = self._presupuesto_repo.obtener_por_id(presupuesto_id)
        if not presupuesto:
            raise ValueError("Presupuesto no encontrado")

        anio = presupuesto.anio
        verde = presupuesto.semaforo_verde_hasta
        amarillo = presupuesto.semaforo_amarillo_hasta

        if nivel == 'centro_costo':
            return self._comparacion_repo.comparar_por_centro_costo(
                presupuesto_id, anio, mes_inicio, mes_fin, centros_costos_excluidos,
                verde_hasta=verde, amarillo_hasta=amarillo
            )
        elif nivel == 'concepto':
            if not centro_costo_id:
                raise ValueError("centro_costo_id es requerido para nivel concepto")
            return self._comparacion_repo.comparar_por_concepto(
                presupuesto_id, anio, centro_costo_id, mes_inicio, mes_fin, centros_costos_excluidos,
                verde_hasta=verde, amarillo_hasta=amarillo
            )
        elif nivel == 'tercero':
            if not centro_costo_id:
                raise ValueError("centro_costo_id es requerido para nivel tercero")
            return self._comparacion_repo.comparar_por_tercero(
                presupuesto_id, anio, centro_costo_id, concepto_id, mes_inicio, mes_fin, centros_costos_excluidos,
                verde_hasta=verde, amarillo_hasta=amarillo
            )
        else:
            raise ValueError(f"Nivel inválido: {nivel}. Debe ser centro_costo, concepto o tercero")
