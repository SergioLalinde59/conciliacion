from typing import List, Dict, Tuple, Optional
from decimal import Decimal
from src.domain.models.presupuesto_detalle import PresupuestoDetalle
from src.domain.models.regla_presupuesto import ReglaPresupuesto
from src.domain.models.indicador_economico import IndicadorEconomico
from src.domain.models.generacion_result import GeneracionResult

# --- Patrones de palabras clave para auto-clasificación ---
_KW_SALARIAL = [
    'salario', 'sueldo', 'nómina', 'nomina', 'seguridad social',
]
_KW_FIJO_CONCEPTO = [
    'administración', 'administracion',
    'prepagada',
    'sura', 'seguro',
    'netflix', 'spotify', 'youtube', 'prime',
    'adobe', 'coursera', 'github', 'openai', 'gemini',
    'cuota de manejo', 'cuota manejo',
    'tigo', 'claro', 'movistar',
    'celular e internet',
    'diezmo',
    'corpaul',
    'suscripci',
    '4xmil', '4x1000',
]
_KW_FIJO_CC = ['suscripciones', 'donaciones', 'bancolombia']
_KW_ESTACIONAL_CONCEPTO = [
    'predial', 'soat', 'tecno mecánica', 'tecno mecanica', 'impuesto',
]
_KW_ESTACIONAL_CC = ['impuestos']


class PresupuestoGeneracionDomainService:
    """Servicio de dominio puro para generación inteligente de presupuesto.
    Sin dependencias de infraestructura."""

    def detectar_no_repetitivos(
        self, lineas: List[PresupuestoDetalle], umbral: int = 4
    ) -> Tuple[List[PresupuestoDetalle], List[PresupuestoDetalle]]:
        """Separa líneas en repetitivas y no repetitivas basándose en meses activos.

        Returns:
            (repetitivas, no_repetitivas)
        """
        # Agrupar por (CC, Concepto, Tercero) y contar meses distintos
        combos: Dict[tuple, set] = {}
        for linea in lineas:
            key = (linea.centro_costo_id, linea.concepto_id, linea.tercero_id)
            combos.setdefault(key, set()).add(linea.mes)

        no_rep_keys = {k for k, meses in combos.items() if len(meses) <= umbral}

        repetitivas = []
        no_repetitivas = []
        for linea in lineas:
            key = (linea.centro_costo_id, linea.concepto_id, linea.tercero_id)
            if key in no_rep_keys:
                no_repetitivas.append(linea)
            else:
                repetitivas.append(linea)

        return repetitivas, no_repetitivas

    def auto_clasificar_tipo_gasto(
        self,
        concepto_nombre: str,
        cc_nombre: str,
        meses_activos: int,
        umbral_no_repetitivo: int = 4
    ) -> str:
        """Auto-clasifica el tipo de gasto basándose en patrones del nombre y frecuencia.

        Jerarquía de detección:
        1. Salarial (keywords en concepto)
        2. Fijo (keywords en concepto o CC)
        3. Estacional (keywords + pocos meses)
        4. No Repetitivo (≤ umbral meses sin keyword específico)
        5. Variable (default)
        """
        concepto = (concepto_nombre or '').lower().strip()
        cc = (cc_nombre or '').lower().strip()

        # 1. Salarial
        if any(kw in concepto for kw in _KW_SALARIAL):
            return 'Salarial'

        # 2. Fijo por concepto
        if any(kw in concepto for kw in _KW_FIJO_CONCEPTO):
            return 'Fijo'

        # 3. Fijo por centro de costo
        if any(kw in cc for kw in _KW_FIJO_CC):
            return 'Fijo'

        # 4. Estacional (keywords + pocos meses)
        if meses_activos <= 4 and (
            any(kw in concepto for kw in _KW_ESTACIONAL_CONCEPTO) or
            any(kw in cc for kw in _KW_ESTACIONAL_CC)
        ):
            return 'Estacional'

        # 5. No Repetitivo
        if meses_activos <= umbral_no_repetitivo:
            return 'No Repetitivo'

        # 6. Default
        return 'Variable'

    def resolver_regla(
        self,
        cc_id: int,
        concepto_id: Optional[int],
        reglas: List[ReglaPresupuesto]
    ) -> ReglaPresupuesto:
        """Resuelve la regla aplicable según jerarquía:
        1. CC + Concepto exactos
        2. CC solo (concepto=NULL)
        3. Global (ambos NULL)
        4. Default sintético
        """
        mejor = None
        mejor_prioridad = -1

        for regla in reglas:
            # Match CC+Concepto exacto → prioridad 3
            if regla.centro_costo_id == cc_id and regla.concepto_id == concepto_id:
                if mejor_prioridad < 3:
                    mejor = regla
                    mejor_prioridad = 3

            # Match CC solo → prioridad 2
            elif regla.centro_costo_id == cc_id and regla.concepto_id is None:
                if mejor_prioridad < 2:
                    mejor = regla
                    mejor_prioridad = 2

            # Match global → prioridad 1
            elif regla.centro_costo_id is None and regla.concepto_id is None:
                if mejor_prioridad < 1:
                    mejor = regla
                    mejor_prioridad = 1

        if mejor:
            return mejor

        # Default sintético
        return ReglaPresupuesto(
            tipo_gasto='Variable',
            indicador_nombre='IPC Colombia',
            factor_ajuste=Decimal('0')
        )

    def clasificar_y_aumentar(
        self,
        lineas_raw: List[PresupuestoDetalle],
        reglas: List[ReglaPresupuesto],
        indicadores: Dict[str, Decimal],
        tipos_excluidos: List[str],
        umbral: int = 4
    ) -> GeneracionResult:
        """Proceso completo de generación inteligente.

        Args:
            lineas_raw: Líneas base del año fuente
            reglas: Lista de reglas de presupuesto configuradas
            indicadores: Dict {indicador: valor_porcentaje} del año destino
            tipos_excluidos: Lista de códigos de tipo_gasto que se excluyen
            umbral: Meses mínimos para considerar repetitivo
        """
        if not indicadores:
            raise ValueError("No hay indicadores económicos configurados para el año destino")

        # Paso 1: Detectar no repetitivos por frecuencia
        repetitivas, no_rep_auto = self.detectar_no_repetitivos(lineas_raw, umbral)

        # Paso 2: Clasificar y aplicar reglas
        regulares = []
        no_repetitivos_info = []
        fijos_sin_monto_info = []
        resumen_tipos = {}
        resumen_indicadores = {}
        total_base = Decimal('0')
        total_presupuestado = Decimal('0')

        def _es_fijo_sin_monto(regla: ReglaPresupuesto) -> bool:
            """Fijo auto-clasificado (sintético) sin monto fijo configurado."""
            return (regla.tipo_gasto == 'Fijo'
                    and regla.monto_fijo_mensual is None
                    and regla.id is None)

        def _procesar_linea(linea: PresupuestoDetalle, regla: ReglaPresupuesto) -> None:
            """Aplica aumento y acumula resumen."""
            nonlocal total_base, total_presupuestado
            self._aplicar_aumento(linea, regla, indicadores)
            resumen_tipos[regla.tipo_gasto] = resumen_tipos.get(regla.tipo_gasto, 0) + 1
            ind_key = 'Monto Fijo' if regla.monto_fijo_mensual is not None else regla.indicador_nombre
            resumen_indicadores[ind_key] = resumen_indicadores.get(ind_key, 0) + 1
            total_base += linea.monto_base if linea.monto_base else Decimal('0')
            total_presupuestado += linea.monto_presupuestado
            regulares.append(linea)

        # Procesar repetitivas (posibles candidatas)
        for linea in repetitivas:
            regla = self.resolver_regla(linea.centro_costo_id, linea.concepto_id, reglas)

            # Si la regla fuerza exclusión
            if regla.tipo_gasto in tipos_excluidos:
                no_repetitivos_info.append(self._linea_to_no_rep_info(
                    linea, regla, "Excluido por regla"
                ))
                continue

            # Fijo auto-clasificado sin monto → pendiente de input del usuario
            if _es_fijo_sin_monto(regla):
                fijos_sin_monto_info.append(self._linea_to_fijo_info(linea, regla))
                continue

            _procesar_linea(linea, regla)

        # Procesar no repetitivas auto-detectadas
        for linea in no_rep_auto:
            regla = self.resolver_regla(linea.centro_costo_id, linea.concepto_id, reglas)

            # Si tiene regla explícita (no default) y no es tipo excluido → override, incluir
            if regla.id is not None and regla.tipo_gasto not in tipos_excluidos:
                _procesar_linea(linea, regla)
            else:
                no_repetitivos_info.append(self._linea_to_no_rep_info(
                    linea, regla, "Auto-detectado (≤{} meses)".format(umbral)
                ))

        # Calcular resumen
        pct_aumento = (
            float((total_presupuestado - total_base) / total_base * 100)
            if total_base > 0 else 0
        )

        resumen = {
            "total_lineas": len(regulares),
            "total_excluidas": len(no_repetitivos_info),
            "total_fijos_sin_monto": len(fijos_sin_monto_info),
            "total_base": float(total_base),
            "total_presupuestado": float(total_presupuestado),
            "pct_aumento_promedio": round(pct_aumento, 2),
            "por_tipo": resumen_tipos,
            "por_indicador": resumen_indicadores,
        }

        return GeneracionResult(
            regulares=regulares,
            no_repetitivos=no_repetitivos_info,
            fijos_sin_monto=fijos_sin_monto_info,
            resumen=resumen
        )

    def _aplicar_aumento(
        self,
        linea: PresupuestoDetalle,
        regla: ReglaPresupuesto,
        indicadores: Dict[str, Decimal]
    ) -> None:
        """Aplica aumento a una línea in-place."""
        monto_base = linea.monto_presupuestado
        linea.monto_base = monto_base

        if regla.monto_fijo_mensual is not None:
            # Monto fijo: usar directamente, sin fórmula
            linea.monto_presupuestado = regla.monto_fijo_mensual
            linea.tipo = regla.tipo_gasto
            return

        indicador_pct = indicadores.get(regla.indicador_nombre, Decimal('0'))
        factor = regla.factor_ajuste
        total_pct = indicador_pct + factor

        linea.monto_presupuestado = (monto_base * (1 + total_pct / 100)).quantize(Decimal('0.01'))
        linea.tipo = regla.tipo_gasto

    def _linea_to_fijo_info(
        self, linea: PresupuestoDetalle, regla: ReglaPresupuesto
    ) -> dict:
        """Convierte una línea fija sin monto a dict para input del usuario."""
        return {
            "centro_costo_id": linea.centro_costo_id,
            "concepto_id": linea.concepto_id,
            "tercero_id": linea.tercero_id,
            "mes": linea.mes,
            "monto_base": float(linea.monto_presupuestado),
            "tipo_detectado": regla.tipo_gasto,
            "centro_costo_nombre": linea.centro_costo_nombre,
            "concepto_nombre": linea.concepto_nombre,
            "tercero_nombre": linea.tercero_nombre,
        }

    def _linea_to_no_rep_info(
        self, linea: PresupuestoDetalle, regla: ReglaPresupuesto, razon: str
    ) -> dict:
        """Convierte una línea excluida a dict de info para revisión."""
        return {
            "centro_costo_id": linea.centro_costo_id,
            "concepto_id": linea.concepto_id,
            "tercero_id": linea.tercero_id,
            "mes": linea.mes,
            "monto": float(linea.monto_presupuestado),
            "tipo_detectado": regla.tipo_gasto,
            "razon": razon,
            "centro_costo_nombre": linea.centro_costo_nombre,
            "concepto_nombre": linea.concepto_nombre,
            "tercero_nombre": linea.tercero_nombre,
        }
