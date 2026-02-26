from typing import List, Optional, Tuple
from decimal import Decimal
from datetime import date
import os
from src.domain.models.movimiento import Movimiento
from src.domain.ports.movimiento_repository import MovimientoRepository
from src.domain.ports.reglas_repository import ReglasRepository
from src.domain.ports.tercero_repository import TerceroRepository
from src.domain.ports.tercero_descripcion_repository import TerceroDescripcionRepository
from src.domain.ports.centro_costo_repository import CentroCostoRepository
from src.domain.ports.concepto_repository import ConceptoRepository
from src.domain.ports.cuenta_repository import CuentaRepository
from src.domain.ports.matching_alias_repository import MatchingAliasRepository
from src.domain.utils.text_similarity import normalizar_acentos, calcular_similitud_texto, calcular_similitud_palabras, calcular_similitud_hibrida


class ClasificacionService:
    """
    Servicio de Aplicación para clasificar movimientos automáticamente.
    Combina Reglas Estáticas y Aprendizaje Histórico.
    """
    
    def __init__(self,
                 movimiento_repo: MovimientoRepository,
                 reglas_repo: ReglasRepository,
                 tercero_repo: TerceroRepository,
                 tercero_descripcion_repo: TerceroDescripcionRepository = None,
                 concepto_repo: ConceptoRepository = None,
                 centro_costo_repo: CentroCostoRepository = None,
                 cuenta_repo: CuentaRepository = None,
                 matching_alias_repo: MatchingAliasRepository = None):
        self.movimiento_repo = movimiento_repo
        self.reglas_repo = reglas_repo
        self.tercero_repo = tercero_repo
        self.tercero_descripcion_repo = tercero_descripcion_repo
        self.concepto_repo = concepto_repo
        self.centro_costo_repo = centro_costo_repo
        self.cuenta_repo = cuenta_repo
        self.matching_alias_repo = matching_alias_repo
        # Caché de pesos por cuenta (lazy-loaded)
        self._cache_pesos_cuenta: Optional[dict] = None
        # Caché de aliases por cuenta (lazy-loaded)
        self._cache_aliases_cuenta: Optional[dict] = None

    def _obtener_pesos_cuenta(self, cuenta_id: int) -> dict:
        """Obtiene los pesos de clasificación para una cuenta (lazy-loaded cache)."""
        if self._cache_pesos_cuenta is None:
            self._cache_pesos_cuenta = {}
            if self.cuenta_repo:
                try:
                    cuentas = self.cuenta_repo.obtener_todas_con_tipo()
                    for c in cuentas:
                        self._cache_pesos_cuenta[c.cuentaid] = c.obtener_pesos_clasificacion()
                except Exception as e:
                    print(f"   ⚠️ Error cargando pesos de cuenta: {e}")

        # Valores por defecto si no se encuentra
        return self._cache_pesos_cuenta.get(cuenta_id, {
            'peso_referencia': 100,
            'peso_descripcion': 50,
            'peso_valor': 30,
            'longitud_min_referencia': 8
        })

    def _obtener_aliases_cuenta(self, cuenta_id: int) -> List:
        """Obtiene los aliases de normalización para una cuenta (lazy-loaded cache)."""
        if self._cache_aliases_cuenta is None:
            self._cache_aliases_cuenta = {}

        if cuenta_id not in self._cache_aliases_cuenta:
            if self.matching_alias_repo:
                try:
                    aliases = self.matching_alias_repo.obtener_por_cuenta(cuenta_id)
                    self._cache_aliases_cuenta[cuenta_id] = aliases
                except Exception as e:
                    print(f"   ⚠️ Error cargando aliases de cuenta {cuenta_id}: {e}")
                    self._cache_aliases_cuenta[cuenta_id] = []
            else:
                self._cache_aliases_cuenta[cuenta_id] = []

        return self._cache_aliases_cuenta.get(cuenta_id, [])

    def _aplicar_aliases(self, descripcion: str, cuenta_id: int) -> str:
        """
        Aplica las reglas de normalización (aliases) a una descripción.

        Args:
            descripcion: Texto original de la descripción
            cuenta_id: ID de la cuenta para obtener sus aliases

        Returns:
            Descripción normalizada según las reglas de la cuenta
        """
        if not descripcion:
            return ""

        aliases = self._obtener_aliases_cuenta(cuenta_id)
        if not aliases:
            return descripcion.upper().strip()

        desc_norm = descripcion.upper().strip()
        # Versión sin acentos para comparación
        desc_sin_acentos = normalizar_acentos(desc_norm)

        for alias in aliases:
            # Normalizar patrón sin acentos para comparación
            patron_sin_acentos = normalizar_acentos(alias.patron)
            if patron_sin_acentos in desc_sin_acentos:
                # Reemplazar en la versión sin acentos
                desc_sin_acentos = desc_sin_acentos.replace(patron_sin_acentos, alias.reemplazo)
                desc_norm = desc_sin_acentos  # Usar versión sin acentos como resultado

        return desc_norm

    def clasificar_movimiento(self, movimiento: Movimiento) -> Tuple[bool, str]:
        """
        Intenta clasificar un movimiento.
        Retorna (exito, razon).
        Modifica el objeto movimiento en sitio si tiene éxito.
        """
        # Si ya está clasificado, no hacer nada
        if not movimiento.necesita_clasificacion:
             return False, "Ya clasificado"

        # 1. Estrategia: Reglas Estáticas (Alta prioridad)
        # ------------------------------------------------
        
        # Obtener y ordenar reglas: 
        # Las reglas con cuenta_id específica deben evaluarse PRIMERO que las globales (None)
        reglas = self.reglas_repo.obtener_todos()
        # Ordenar: x.cuenta_id is not None (True=1, False=0) descendente -> Primero las que tienen cuenta
        reglas.sort(key=lambda x: x.cuenta_id is not None, reverse=True)
        
        for regla in reglas:
            # 1.1 Filtro por Cuenta (Si la regla especifica cuenta, debe coincidir)
            if regla.cuenta_id is not None:
                if movimiento.cuenta_id != regla.cuenta_id:
                    continue # No aplica esta regla para esta cuenta
            
            # 1.2 Coincidencia de Patrón
            coincide = False
            texto_upper = (movimiento.descripcion or "").upper()
            patron_upper = regla.patron.upper()
            
            if regla.tipo_match == 'contiene':
                if patron_upper in texto_upper: coincide = True
            elif regla.tipo_match == 'inicio':
                if texto_upper.startswith(patron_upper): coincide = True
            elif regla.tipo_match == 'exacto':
                if texto_upper == patron_upper: coincide = True
                
            if coincide:
                modificado = False
                if regla.tercero_id and not movimiento.tercero_id:
                    # Tercero se asigna solo a detalles, no al encabezado
                    if len(movimiento.detalles) == 1:
                        movimiento.detalles[0].tercero_id = regla.tercero_id
                    modificado = True
                if regla.centro_costo_id and not movimiento.centro_costo_id:
                    movimiento.centro_costo_id = regla.centro_costo_id
                    modificado = True
                if regla.concepto_id and not movimiento.concepto_id:
                    movimiento.concepto_id = regla.concepto_id
                    modificado = True
                
                if modificado:
                    tipo_regla = "Cuenta Específica" if regla.cuenta_id else "Global"
                    return True, f"Regla estática [{tipo_regla}]: '{regla.patron}'"

        # 2. Estrategia: Histórico por Referencia
        # ---------------------------------------
        if movimiento.referencia:
            # Buscar movimientos previos con la misma referencia que ya estén clasificados
            similares = self.movimiento_repo.buscar_por_referencia(movimiento.referencia)
            
            # Filtrar el propio movimiento si ya existe y quedarse con los que tengan clasificación
            candidatos = [
                m for m in similares 
                if m.id != movimiento.id 
                and not m.necesita_clasificacion # que tenga grupo y concepto
            ]
            
            if candidatos:
                # Tomar el más reciente
                mejor_candidato = candidatos[0] # Asumimos que repo devuelve ordenados, sino ordenar
                
                # Tercero se asigna solo a detalles, no al encabezado
                if len(movimiento.detalles) == 1:
                    movimiento.detalles[0].tercero_id = mejor_candidato.tercero_id
                movimiento.centro_costo_id = mejor_candidato.centro_costo_id
                movimiento.concepto_id = mejor_candidato.concepto_id
                return True, f"Histórico por Referencia ({movimiento.referencia})"
        
        # 3. Estrategia: Catálogo Externo por Referencia (>8 dígitos)
        # -------------------------------------------------------
        # Nueva ubicación (antes en Pipeline): Si está en catálogo oficial, es match seguro.
        if (movimiento.referencia and len(movimiento.referencia) > 8 
            and movimiento.referencia.isdigit() and self.tercero_descripcion_repo):
            
            td = self.tercero_descripcion_repo.buscar_por_referencia(movimiento.referencia)
            if td:
                # Tercero se asigna solo a detalles, no al encabezado
                if len(movimiento.detalles) == 1:
                    movimiento.detalles[0].tercero_id = td.terceroid
                return True, f"Referencia Catálogo Exacta: {movimiento.referencia}"

        return False, "Sin coincidencias"

    def auto_clasificar_pendientes(self) -> dict:
        """
        Busca todos los pendientes y trata de clasificarlos.
        Guarda los cambios inmediatamente.
        """
        pendientes = self.movimiento_repo.buscar_pendientes_clasificacion()
        resumen = {'total': len(pendientes), 'clasificados': 0, 'detalles': []}
        
        for mov in pendientes:
            exito, razon = self.clasificar_movimiento(mov)
            if exito:
                self.movimiento_repo.guardar(mov)
                resumen['clasificados'] += 1
                resumen['detalles'].append(f"ID {mov.id}: {razon}")
        
        return resumen

    def obtener_sugerencia_clasificacion(self, movimiento_id: int) -> dict:
        """
        [PIPELINE UNIFICADO]
        Calcula una sugerencia de clasificación usando múltiples estrategias simultáneas
        y un sistema de ranking/scoring unificado.

        Score Final = (SimilitudTexto * 0.7) + (SimilitudValor * 0.3)
        """
        movimiento = self.movimiento_repo.obtener_por_id(movimiento_id)
        if not movimiento:
            raise ValueError(f"Movimiento {movimiento_id} no encontrado")

        # Quality gate thresholds (configurable via env vars)
        UMBRAL_MINIMO_HISTORIAL = float(os.getenv('CLASIFICACION_UMBRAL_MINIMO_HISTORIAL', '40'))
        UMBRAL_AUTO_SUGGEST = float(os.getenv('CLASIFICACION_UMBRAL_AUTO_SUGGEST', '50'))
        UMBRAL_CONSISTENCIA_MIN = float(os.getenv('CLASIFICACION_UMBRAL_CONSISTENCIA_MINIMO', '30'))
        BONUS_TERCERO_EXISTENTE = int(os.getenv('CLASIFICACION_BONUS_TERCERO_EXISTENTE_MAX', '5'))
        MIN_TEXT_SIM_SUGGEST = float(os.getenv('CLASIFICACION_MIN_TEXT_SIMILARITY_SUGGEST', '20'))

        # Initialize suggestion with CURRENT movement values (preserve existing classification)
        sugerencia = {
            'tercero_id': movimiento.tercero_id, 
            'centro_costo_id': movimiento.centro_costo_id, 
            'concepto_id': movimiento.concepto_id,
            'razon': None,
            'tipo_match': None
        }
        
        # Mapa de candidatos unificado: {id: {'mov': obj, 'origen': set(), 'score_cobertura': 0}}
        candidatos_map = {}
        
        print(f"\n🚀 INICIANDO PIPELINE DE CLASIFICACIÓN para ID {movimiento_id}")
        print(f"   Descripción: '{movimiento.descripcion}'")
        print(f"   Valor: {movimiento.valor}")
        print(f"   Tercero actual: {movimiento.tercero_id}")

        # Obtener pesos de clasificación para esta cuenta
        pesos_cuenta = self._obtener_pesos_cuenta(movimiento.cuenta_id)
        print(f"   Pesos cuenta {movimiento.cuenta_id}: ref={pesos_cuenta['peso_referencia']}, desc={pesos_cuenta['peso_descripcion']}, val={pesos_cuenta['peso_valor']}")

        referencia_no_existe = False
        match_referencia_encontrado = False  # Inicializar ANTES de usar
        referencia_define_tercero = pesos_cuenta.get('referencia_define_tercero', False)

        # ============================================
        # 0.1. ESTRATEGIA: CONTEXTO PARA TERCERO EXISTENTE
        # ============================================
        # Si el movimiento YA tiene un tercero_id asignado, buscar su historial
        # para mostrar en el contexto (esto ayuda aunque la descripción no coincida)
        if movimiento.tercero_id and not match_referencia_encontrado:
            print(f"   📋 Movimiento ya tiene TerceroID {movimiento.tercero_id}, buscando historial...")
            cands_tercero_existente, _ = self.movimiento_repo.buscar_avanzado(
                tercero_id=movimiento.tercero_id, 
                limit=20
            )
            for m in cands_tercero_existente:
                if m.id != movimiento.id:
                    if m.id not in candidatos_map:
                        candidatos_map[m.id] = {'mov': m, 'origen': {'tercero_existente'}, 'score_cobertura': 0}
                    else:
                        candidatos_map[m.id]['origen'].add('tercero_existente')

        # ============================================
        # 0. ESTRATEGIA: REFERENCIA → TERCERO (SIEMPRE si hay referencia válida)
        # ============================================
        # Si el movimiento tiene referencia válida, SIEMPRE buscar tercero por referencia.
        # referencia_define_tercero controla si se omiten las estrategias de texto posteriores.

        longitud_min_ref = pesos_cuenta.get('longitud_min_referencia', 8)
        tiene_referencia_valida = bool(
            movimiento.referencia
            and len(movimiento.referencia.strip()) >= longitud_min_ref
        )

        if tiene_referencia_valida:
            print(f"   🔑 Buscando por referencia: '{movimiento.referencia}' (referencia_define_tercero={referencia_define_tercero})")

            # Buscar movimientos con la MISMA referencia
            cands_misma_ref, _ = self.movimiento_repo.buscar_avanzado(
                referencia=movimiento.referencia.strip(),
                limit=20
            )

            movs_con_misma_ref = [m for m in cands_misma_ref if m.id != movimiento.id and m.tercero_id]

            if movs_con_misma_ref:
                # Solo omitir estrategias de texto si referencia_define_tercero está activo
                if referencia_define_tercero:
                    match_referencia_encontrado = True

                # Tomar el tercero del primer movimiento clasificado con esa referencia
                primer_clasificado = movs_con_misma_ref[0]
                sugerencia['tercero_id'] = primer_clasificado.tercero_id
                sugerencia['razon'] = f"Referencia: {movimiento.referencia}"
                sugerencia['tipo_match'] = 'referencia_exacta'

                for m in movs_con_misma_ref:
                    if m.id not in candidatos_map:
                        candidatos_map[m.id] = {'mov': m, 'origen': {'misma_referencia'}, 'score_cobertura': 0}
                    else:
                        candidatos_map[m.id]['origen'].add('misma_referencia')

                print(f"   📌 Encontrados {len(movs_con_misma_ref)} movimientos con misma referencia")
            else:
                # Si no hay historial pero sí catálogo de terceros, intentar buscar ahí
                tiene_referencia_numerica = movimiento.referencia.isdigit()
                if tiene_referencia_numerica and self.tercero_descripcion_repo:
                    td = self.tercero_descripcion_repo.buscar_por_referencia(movimiento.referencia)
                    if td:
                        print(f"   ✅ Referencia encontrada en catálogo: {movimiento.referencia} -> TerceroID {td.terceroid}")
                        sugerencia['tercero_id'] = td.terceroid
                        sugerencia['razon'] = f"Referencia: {movimiento.referencia}"
                        sugerencia['tipo_match'] = 'referencia_exacta'
                        if referencia_define_tercero:
                            match_referencia_encontrado = True
                    else:
                        print(f"   ⚠️ Referencia {movimiento.referencia} sin historial ni en catálogo")
                        referencia_no_existe = True
                else:
                    print(f"   ⚠️ Referencia {movimiento.referencia} sin historial previo")
                    if referencia_define_tercero:
                        referencia_no_existe = True

        # ============================================
        # 1. ESTRATEGIA: PATRONES DE DESCRIPCIÓN (Catálogo Terceros)
        # ============================================
        # Busca aliases/descripciones en el catálogo de terceros usando patrones de la descripción.
        # Se ejecuta SIEMPRE que no haya match previo (con o sin referencia).
        # Si la referencia es nueva, NO sugerir tercero por texto (la referencia identifica un tercero nuevo).

        if not match_referencia_encontrado and not referencia_no_existe and not sugerencia['tercero_id'] and self.tercero_descripcion_repo:
            descripcion = movimiento.descripcion or ""
            palabras_ignorar = {'y', 'de', 'la', 'el', 'en', 'a', 'por', 'para', 'con', 'cop', 'usd'}
            palabras = descripcion.split()
            # FIX: Permitimos palabras de 2 letras (ej: TC)
            significativas = [p for p in palabras if p.lower() not in palabras_ignorar and len(p) >= 2]
            
            patrones = []
            if len(significativas) >= 5: patrones.append(" ".join(significativas[:5]))
            if len(significativas) >= 3: patrones.append(" ".join(significativas[:3]))
            if len(significativas) >= 2: patrones.append(" ".join(significativas[:2]))
            
            for patron in patrones:
                if len(patron) < 3: continue
                matches = self.tercero_descripcion_repo.buscar_por_descripcion(patron)
                if matches:
                    mejor = matches[0]
                    # Si encontramos, lo usamos para sugerencia directa
                    if not sugerencia['tercero_id']:
                        sugerencia['tercero_id'] = mejor.terceroid
                        sugerencia['razon'] = f"Patrón Descripción: {mejor.descripcion}"
                        sugerencia['tipo_match'] = 'descripcion_tercero'
                        print(f"   ✅ Match directo por patrón: {mejor.descripcion}")
                    break

        # ============================================
        # 1.5. ESTRATEGIA: MATCH DIRECTO POR NOMBRE DE TERCERO
        # ============================================
        # Busca terceros cuyo nombre aparece como palabra en la descripción.
        # Útil para movimientos nuevos sin historial previo (ej: "Presto Las Vegas" → tercero "Presto")
        # Si la referencia es nueva, NO sugerir (el tercero probablemente no existe aún).
        if not match_referencia_encontrado and not referencia_no_existe and not sugerencia['tercero_id']:
            descripcion_match = movimiento.descripcion or ""
            if len(descripcion_match.strip()) >= 4:
                terceros_match = self.tercero_repo.buscar_en_texto(descripcion_match)
                if terceros_match:
                    mejor = terceros_match[0]  # El más largo (más específico)
                    sugerencia['tercero_id'] = mejor.terceroid
                    sugerencia['razon'] = f"Nombre de tercero: {mejor.tercero}"
                    sugerencia['tipo_match'] = 'nombre_tercero'
                    print(f"   ✅ Match directo por nombre de tercero: {mejor.tercero} (ID {mejor.terceroid})")

        # ============================================
        # 2. ESTRATEGIA: BÚSQUEDA EXHAUSTIVA (MULTI-WORD)
        # ============================================
        # Esta estrategia SIEMPRE corre para llenar el contexto
        
        descripcion = movimiento.descripcion or ""
        
        if not match_referencia_encontrado:
            palabras_ignorar = {'y', 'de', 'la', 'el', 'en', 'a', 'por', 'para', 'con', 'cop', 'usd', 'pago', 'transferencia'}
            palabras = descripcion.split()
            
            # FIX: Permitir palabras de 2 caracteres en búsqueda (e.g. 'TC')
            # Antes era len(p) > 2, ahora len(p) >= 2
            palabras_clave = sorted(list(set([p for p in palabras if p.lower() not in palabras_ignorar and len(p) >= 2])))
            
            print(f"   🔎 Buscando candidatos con palabras: {palabras_clave}")
            
            for palabra in palabras_clave:
                # Buscar en repo (Aumentado límite para evitar perder matches por palabras comunes como MASTER)
                # FIX: Limit aumentado de 30 a 100
                cands, _ = self.movimiento_repo.buscar_avanzado(descripcion_contiene=palabra, limit=100)
                
                for m in cands:
                    if m.id == movimiento.id or not m.tercero_id:
                        continue
                        
                    if m.id not in candidatos_map:
                        candidatos_map[m.id] = {'mov': m, 'origen': {'texto'}, 'score_cobertura': 0}
                    
                    if 'texto' not in candidatos_map[m.id]['origen']:
                        candidatos_map[m.id]['origen'].add('texto')
                    
                    candidatos_map[m.id]['score_cobertura'] += 1

        # ============================================
        # 3. CASOS ESPECIALES (FONDO RENTA / TRASLADO)
        # ============================================
        # Solo aplica si NO hubo match por referencia exacta
        if not match_referencia_encontrado:
            tipo_cuenta_nombre = (pesos_cuenta.get('tipo_cuenta_nombre') or '').lower()
            es_fondo_renta = 'fondo' in tipo_cuenta_nombre or 'renta' in tipo_cuenta_nombre

            if es_fondo_renta:
                 # Traer historial de la misma cuenta (los ultimos 20)
                 cands, _ = self.movimiento_repo.buscar_avanzado(cuenta_id=movimiento.cuenta_id, limit=20)
                 for m in cands:
                    if m.id != movimiento.id and m.tercero_id:
                        if m.id not in candidatos_map:
                            candidatos_map[m.id] = {'mov': m, 'origen': {'cuenta'}, 'score_cobertura': 0}
                        candidatos_map[m.id]['origen'].add('cuenta')
        
        # ============================================
        # 4. EVALUACIÓN Y RANKING UNIFICADO (con pesos dinámicos por tipo_cuenta)
        # ============================================
        resultados_scoring = []

        # Usar pesos dinámicos de la cuenta
        peso_ref = pesos_cuenta['peso_referencia']
        peso_desc = pesos_cuenta['peso_descripcion']
        peso_val = pesos_cuenta['peso_valor']
        longitud_min_ref = pesos_cuenta.get('longitud_min_referencia', 8)

        # Referencia del movimiento actual (para comparar)
        ref_actual = (movimiento.referencia or "").strip()
        tiene_ref_valida = len(ref_actual) >= longitud_min_ref

        # Si el movimiento NO tiene referencia válida, redistribuir peso entre desc y valor
        if not tiene_ref_valida and peso_ref > 0:
            print(f"   ℹ️ Movimiento sin referencia válida (len={len(ref_actual)} < {longitud_min_ref}), redistribuyendo peso de referencia")
            suma_desc_val = peso_desc + peso_val
            if suma_desc_val > 0:
                # Redistribuir proporcionalmente
                peso_desc = peso_desc + (peso_ref * peso_desc / suma_desc_val)
                peso_val = peso_val + (peso_ref * peso_val / suma_desc_val)
            peso_ref = 0

        suma_pesos = peso_ref + peso_desc + peso_val

        # Normalizar pesos (0-1)
        if suma_pesos > 0:
            peso_ref_norm = peso_ref / suma_pesos
            peso_texto_norm = peso_desc / suma_pesos
            peso_valor_norm = peso_val / suma_pesos
        else:
            peso_ref_norm = 0.0
            peso_texto_norm = 0.7
            peso_valor_norm = 0.3

        print(f"   📊 Pesos normalizados: ref={peso_ref_norm:.1%}, desc={peso_texto_norm:.1%}, val={peso_valor_norm:.1%}")

        # Margen valor
        margen_pct = Decimal(os.getenv('SIMILAR_RECORDS_VALUE_MARGIN_PERCENT', '20')) / Decimal('100')
        valor_abs = abs(movimiento.valor) if movimiento.valor else Decimal(0)
        valor_min = valor_abs * (1 - margen_pct)
        valor_max = valor_abs * (1 + margen_pct)

        # Descripción normalizada del movimiento actual (constante para todo el scoring)
        desc_norm = self._aplicar_aliases(descripcion, movimiento.cuenta_id)

        for mid, data in candidatos_map.items():
            cand = data['mov']

            # 1. Match Referencia (solo si cumple longitud mínima)
            match_ref = 0
            ref_cand = (cand.referencia or "").strip()
            if (len(ref_actual) >= longitud_min_ref and
                len(ref_cand) >= longitud_min_ref and
                ref_actual == ref_cand):
                match_ref = 100  # Referencia exacta

            # 2. Similitud Texto (Híbrida) - CON NORMALIZACIÓN
            # Aplicar aliases de normalización antes de comparar
            cand_desc_norm = self._aplicar_aliases(cand.descripcion or "", movimiento.cuenta_id)
            sim_texto = calcular_similitud_hibrida(desc_norm, cand_desc_norm)

            # 3. Similitud Valor
            score_valor = 0
            cand_valor_abs = abs(cand.valor) if cand.valor else Decimal(0)

            if cand.valor == movimiento.valor:
                score_valor = 100  # Match exacto
            elif (cand.valor is not None and movimiento.valor is not None
                  and (cand.valor < 0) == (movimiento.valor < 0)  # Mismo signo
                  and valor_min <= cand_valor_abs <= valor_max):
                score_valor = 80  # Diferencia ≤20% (match cercano)

            # Bonus por cobertura de palabras (Search Density) — solo de búsqueda por palabras
            bonus_cobertura = min(data['score_cobertura'] * 2, 10)

            # Bonus separado y menor para tercero_existente (contexto, no evidencia textual)
            if 'tercero_existente' in data['origen']:
                bonus_cobertura = min(bonus_cobertura + BONUS_TERCERO_EXISTENTE, 10)

            # SCORE FINAL
            # Si hay match de referencia exacta → 100 puntos (no hay que buscar más)
            # La referencia es el número de cuenta del tercero en el banco
            if match_ref == 100:
                score_final = 100.0
            else:
                # Solo aplica fórmula de pesos cuando NO hay match de referencia
                score_final = (sim_texto * peso_texto_norm) + (score_valor * peso_valor_norm) + bonus_cobertura

            resultados_scoring.append({
                'movimiento': cand,
                'score_final': score_final,
                'match_ref': match_ref,
                'sim_texto': sim_texto,
                'score_valor': score_valor,
                'origen': list(data['origen'])
            })
            
        # Ordenar por: 1) Score desc, 2) Fecha desc, 3) Valor por cercanía al actual
        valor_referencia = abs(movimiento.valor or 0)
        fecha_min = date(1900, 1, 1)
        resultados_scoring.sort(
            key=lambda x: (
                -x['score_final'],  # Negativo para DESC (mayor score primero)
                -(x['movimiento'].fecha if x['movimiento'].fecha else fecha_min).toordinal(),  # Negativo para DESC (más reciente primero)
                abs(abs(x['movimiento'].valor or 0) - valor_referencia)  # ASC por cercanía al valor actual
            )
        )
        
        # Logging Top 5
        print(f"\n   🏆 TOP 5 CANDIDATOS (Ranking Unificado):")
        for i, res in enumerate(resultados_scoring[:5]):
            m = res['movimiento']
            print(f"      {i+1}. [{res['score_final']:.1f} pts] ID {m.id} - '{m.descripcion}'")
            print(f"         Ref: {res['match_ref']} | Txt: {res['sim_texto']:.1f}% | Val: {res['score_valor']} | Origen: {res['origen']}")
            
        # Candidatos evaluados para uso interno de las estrategias.
        # El contexto final para el frontend se construye al final, después de todas las reglas.
        candidatos_evaluados = [
            {'movimiento': r['movimiento'], 'score': round(r['score_final'], 1)}
            for r in resultados_scoring[:10]
            if r['score_final'] >= UMBRAL_MINIMO_HISTORIAL
        ][:5]

        # ============================================
        # 4.5. REGLA: DETECCIÓN DE DESCRIPCIÓN GENÉRICA
        # ============================================
        # REGLA DE NEGOCIO: Una descripción es "genérica" cuando el historial demuestra
        # que MÚLTIPLES terceros distintos la comparten. Ejemplos reales:
        #   - "Transferencias A Nequi" → usada por Luz Marina, Andrea Latorre, Maria Paula...
        #   - "Transferencia Cta Suc Virtual" → usada por Materiales Construcentro, Lina María, Pasteur...
        #
        # En estos casos la descripción por sí sola NO identifica al tercero.
        # Sugerir cualquiera de ellos sería engañoso (ej: "Alta confianza" cuando hay 66%
        # de probabilidad de error).
        #
        # DETECCIÓN: Entre los candidatos con alta similitud de texto (≥ umbral configurable),
        # si hay 2 o más terceros distintos → la descripción es genérica.
        #
        # EFECTO:
        #   - NO se sugiere ningún tercero (se limpian sugerencias previas de texto)
        #   - NO se muestra barra de sugerencia (sin razón, sin confianza)
        #   - SÍ se muestra el Historial Relacionado para decisión manual del usuario
        #   - Se retorna flag 'descripcion_generica' al frontend para mensaje informativo
        #
        # EXCEPCIÓN: Solo se respeta la sugerencia previa si vino de REFERENCIA EXACTA
        # (match_referencia_encontrado = True), porque la referencia es un identificador
        # inequívoco. Las estrategias de texto (patrón catálogo, nombre tercero) NO son
        # confiables cuando la descripción es genérica y se limpian.

        descripcion_generica = False

        if not match_referencia_encontrado and not referencia_no_existe and resultados_scoring:
            UMBRAL_SIM_GENERICA = float(os.getenv('CLASIFICACION_UMBRAL_SIM_TEXTO_GENERICA', '90'))
            candidatos_alta_sim = [r for r in resultados_scoring if r['sim_texto'] >= UMBRAL_SIM_GENERICA]

            if candidatos_alta_sim:
                terceros_distintos = set(
                    r['movimiento'].tercero_id for r in candidatos_alta_sim
                    if r['movimiento'].tercero_id
                )
                if len(terceros_distintos) >= 2:
                    descripcion_generica = True
                    print(f"   ⚠️ DESCRIPCIÓN GENÉRICA detectada: {len(terceros_distintos)} terceros distintos con sim_texto ≥ {UMBRAL_SIM_GENERICA}%")
                    print(f"      Terceros IDs: {terceros_distintos}")

                    # Limpiar sugerencia previa si vino de estrategias de TEXTO
                    # (patrón catálogo, nombre tercero, historial). Solo se respeta referencia_exacta.
                    if sugerencia['tipo_match'] and sugerencia['tipo_match'] != 'referencia_exacta':
                        print(f"   🧹 Limpiando sugerencia previa (tipo: {sugerencia['tipo_match']}) por descripción genérica")
                        sugerencia['tercero_id'] = None
                        sugerencia['centro_costo_id'] = None
                        sugerencia['concepto_id'] = None
                        sugerencia['razon'] = None
                        sugerencia['tipo_match'] = None

        # ============================================
        # 5. INFERIR SUGERENCIAS DESDE EL GANADOR
        # ============================================
        # Si la referencia es nueva, no inferir tercero del historial (es un tercero nuevo).
        # Si la descripción es genérica, no inferir (múltiples terceros posibles).
        if not sugerencia['tercero_id'] and not referencia_no_existe and not descripcion_generica and candidatos_evaluados:
            ganador = resultados_scoring[0]
            
            # Umbral de confianza: score global + similitud de texto mínima
            if ganador['score_final'] >= UMBRAL_AUTO_SUGGEST and ganador['sim_texto'] >= MIN_TEXT_SIM_SUGGEST:
                mejor_match = ganador['movimiento']
                sugerencia['tercero_id'] = mejor_match.tercero_id
                
                # Si tambien coincide en valor (o es muy similar), sugerir clasificacion completa
                if ganador['score_valor'] >= 50:
                    sugerencia['centro_costo_id'] = mejor_match.centro_costo_id
                    sugerencia['concepto_id'] = mejor_match.concepto_id
                    sugerencia['razon'] = f"Similaridad Histórica: {ganador['sim_texto']:.1f}% (Valor coincidente)"
                    sugerencia['tipo_match'] = 'historico_valor'
                else:
                    sugerencia['razon'] = f"Similaridad Texto: {ganador['sim_texto']:.1f}%"
                    sugerencia['tipo_match'] = 'historico_texto'
        
        # ============================================
        # 6. SUGERIR TERCERO SI TODOS SON IGUALES (Consistencia)
        # ============================================
        # Si la referencia es nueva, no sugerir por consistencia (es un tercero nuevo).
        # Si la descripción es genérica, no sugerir (múltiples terceros posibles).
        if not sugerencia['tercero_id'] and not referencia_no_existe and not descripcion_generica and candidatos_evaluados:
            # Solo candidatos con score significativo participan en la regla de consistencia
            candidatos_significativos = [c for c in candidatos_evaluados if c['score'] >= UMBRAL_CONSISTENCIA_MIN]
            if candidatos_significativos:
                terceros_unicos = set(c['movimiento'].tercero_id for c in candidatos_significativos if c['movimiento'].tercero_id)
                if len(terceros_unicos) == 1:
                    tercero_comun_id = terceros_unicos.pop()
                    sugerencia['tercero_id'] = tercero_comun_id
                    count = len(candidatos_significativos)
                    sugerencia['razon'] = f"Historial consistente ({count}/{count})"
                    sugerencia['tipo_match'] = 'frecuencia_tercero'

        # ============================================
        # 7. INFERIR CC/CONCEPTO DEL HISTORIAL DEL TERCERO
        # ============================================
        # Si ya tenemos tercero pero no CC/Concepto, buscar en el historial de ese tercero
        if sugerencia['tercero_id'] and (not sugerencia['centro_costo_id'] or not sugerencia['concepto_id']):
            # Filtrar candidatos que tengan el mismo tercero sugerido Y score significativo
            candidatos_tercero = [
                c['movimiento'] for c in candidatos_evaluados
                if c['movimiento'].tercero_id == sugerencia['tercero_id']
                and c['score'] >= UMBRAL_CONSISTENCIA_MIN
            ]

            if candidatos_tercero:
                # Umbral configurable (default 60% = 3/5)
                umbral_cc_concepto = float(os.getenv('CLASIFICACION_UMBRAL_CC_CONCEPTO', '0.6'))

                # Contar CC y Conceptos más frecuentes
                from collections import Counter
                cc_counter = Counter(m.centro_costo_id for m in candidatos_tercero if m.centro_costo_id)
                concepto_counter = Counter(m.concepto_id for m in candidatos_tercero if m.concepto_id)

                # Si hay CC consistente (>= umbral del historial del tercero)
                if cc_counter and not sugerencia['centro_costo_id']:
                    cc_mas_frecuente, cc_count = cc_counter.most_common(1)[0]
                    if cc_count >= len(candidatos_tercero) * umbral_cc_concepto:
                        sugerencia['centro_costo_id'] = cc_mas_frecuente
                        print(f"   ✅ CC inferido del tercero: {cc_mas_frecuente} ({cc_count}/{len(candidatos_tercero)} >= {umbral_cc_concepto:.0%})")

                # Si hay Concepto consistente (>= umbral del historial del tercero)
                if concepto_counter and not sugerencia['concepto_id']:
                    concepto_mas_frecuente, concepto_count = concepto_counter.most_common(1)[0]
                    if concepto_count >= len(candidatos_tercero) * umbral_cc_concepto:
                        sugerencia['concepto_id'] = concepto_mas_frecuente
                        print(f"   ✅ Concepto inferido del tercero: {concepto_mas_frecuente} ({concepto_count}/{len(candidatos_tercero)} >= {umbral_cc_concepto:.0%})")

                # Actualizar razón si se infirieron
                if sugerencia['centro_costo_id'] and sugerencia['concepto_id']:
                    if sugerencia['razon']:
                        sugerencia['razon'] += " + CC/Concepto del tercero"
                    else:
                        sugerencia['razon'] = "CC/Concepto inferidos del historial del tercero"

        # Completar información de nombres para el frontend
        if sugerencia['tercero_id']:
            t = self.tercero_repo.obtener_por_id(sugerencia['tercero_id'])
            sugerencia['tercero_nombre'] = t.tercero if t else None

        # ============================================
        # 7.5. HISTORIAL POR TERCERO SUGERIDO
        # ============================================
        # Si ya tenemos tercero pero el contexto está vacío (ej: referencia encontrada en
        # catálogo pero sin historial con esa referencia exacta), buscar historial del tercero.
        if sugerencia['tercero_id'] and not candidatos_evaluados:
            tercero_id_sugerido = sugerencia['tercero_id']
            cands_tercero, _ = self.movimiento_repo.buscar_avanzado(
                tercero_id=tercero_id_sugerido,
                solo_clasificados=True,
                limit=20
            )
            cands_tercero = [m for m in cands_tercero if m.id != movimiento.id]

            if cands_tercero:
                # Redistribuir peso de referencia entre texto y valor
                # (el tercero ya fue identificado, la referencia no aporta al scoring)
                _peso_desc = pesos_cuenta['peso_descripcion']
                _peso_val = pesos_cuenta['peso_valor']
                _peso_ref = pesos_cuenta['peso_referencia']
                _suma_dv = _peso_desc + _peso_val
                if _peso_ref > 0 and _suma_dv > 0:
                    _peso_desc += _peso_ref * _peso_desc / _suma_dv
                    _peso_val += _peso_ref * _peso_val / _suma_dv
                _suma = _peso_desc + _peso_val
                _peso_txt_n = _peso_desc / _suma if _suma > 0 else 0.7
                _peso_val_n = _peso_val / _suma if _suma > 0 else 0.3

                print(f"   📋 Historial por tercero sugerido {tercero_id_sugerido}: {len(cands_tercero)} movimientos")
                for cand in cands_tercero:
                    cand_desc_norm = self._aplicar_aliases(cand.descripcion or "", movimiento.cuenta_id)
                    sim_texto = calcular_similitud_hibrida(desc_norm, cand_desc_norm)

                    score_valor = 0
                    cand_valor_abs = abs(cand.valor) if cand.valor else Decimal(0)
                    if cand.valor == movimiento.valor:
                        score_valor = 100
                    elif (cand.valor is not None and movimiento.valor is not None
                          and (cand.valor < 0) == (movimiento.valor < 0)
                          and valor_min <= cand_valor_abs <= valor_max):
                        score_valor = 80

                    score_final = (sim_texto * _peso_txt_n) + (score_valor * _peso_val_n)

                    resultados_scoring.append({
                        'movimiento': cand, 'score_final': score_final,
                        'match_ref': 0, 'sim_texto': sim_texto,
                        'score_valor': score_valor, 'origen': ['tercero_sugerido']
                    })

                resultados_scoring.sort(
                    key=lambda x: (-x['score_final'], -(x['movimiento'].fecha if x['movimiento'].fecha else fecha_min).toordinal())
                )
                candidatos_evaluados = [
                    {'movimiento': r['movimiento'], 'score': round(r['score_final'], 1)}
                    for r in resultados_scoring[:10]
                    if r['score_final'] >= UMBRAL_MINIMO_HISTORIAL
                ][:5]

        # ============================================
        # 8. CONSTRUIR CONTEXTO FINAL (Historial Relacionado)
        # ============================================
        # Se construye al final, después de todas las reglas, para decidir en un solo lugar
        # qué se muestra al usuario:
        #   - referencia_no_existe → sin historial (el tercero es nuevo, el historial es ruido)
        #   - descripcion_generica → sin historial (múltiples terceros, el historial confunde)
        #   - caso normal → top 5 candidatos evaluados
        if referencia_no_existe or descripcion_generica:
            contexto_con_score = []
        else:
            contexto_con_score = candidatos_evaluados

        # Calcular nivel de confianza para el frontend
        # Descripción genérica → sin confianza (no hay sugerencia que calificar)
        confianza = None
        if not descripcion_generica and sugerencia['razon']:
            if sugerencia['tipo_match'] == 'referencia_exacta':
                confianza = 'alta'
            elif contexto_con_score:
                best_score = max(c['score'] for c in contexto_con_score)
                if best_score >= 80:
                    confianza = 'alta'
                elif best_score >= 50:
                    confianza = 'media'
                else:
                    confianza = 'baja'
            else:
                confianza = 'baja'

        return {
            'movimiento_id': movimiento.id,
            'sugerencia': sugerencia,
            'contexto': contexto_con_score,
            'referencia_no_existe': referencia_no_existe,
            'referencia': movimiento.referencia if referencia_no_existe else None,
            'descripcion_generica': descripcion_generica,
            'confianza': confianza
        }

    def obtener_contexto_por_tercero(self, movimiento_id: int, tercero_id: int) -> dict:
        """
        Dado un movimiento y un tercero_id seleccionado manualmente, busca el historial
        clasificado de ese tercero y lo puntúa relativo al movimiento actual.
        También infiere CC/Concepto por frecuencia.

        Versión ligera de obtener_sugerencia_clasificacion, usada cuando el usuario
        selecciona un tercero manualmente en un movimiento con descripción genérica.
        """
        from collections import Counter

        movimiento = self.movimiento_repo.obtener_por_id(movimiento_id)
        if not movimiento:
            raise ValueError(f"Movimiento {movimiento_id} no encontrado")

        UMBRAL_MINIMO_HISTORIAL = float(os.getenv('CLASIFICACION_UMBRAL_MINIMO_HISTORIAL', '40'))
        UMBRAL_CONSISTENCIA_MIN = float(os.getenv('CLASIFICACION_UMBRAL_CONSISTENCIA_MINIMO', '30'))

        # Buscar historial clasificado de este tercero
        candidatos, _ = self.movimiento_repo.buscar_avanzado(
            tercero_id=tercero_id,
            solo_clasificados=True,
            limit=20
        )

        # Obtener pesos dinámicos de la cuenta
        pesos_cuenta = self._obtener_pesos_cuenta(movimiento.cuenta_id)
        peso_desc = pesos_cuenta['peso_descripcion']
        peso_val = pesos_cuenta['peso_valor']
        longitud_min_ref = pesos_cuenta.get('longitud_min_referencia', 8)

        # Redistribuir peso de referencia (no aplica aquí, tercero ya definido)
        peso_ref = pesos_cuenta['peso_referencia']
        suma_desc_val = peso_desc + peso_val
        if suma_desc_val > 0 and peso_ref > 0:
            peso_desc = peso_desc + (peso_ref * peso_desc / suma_desc_val)
            peso_val = peso_val + (peso_ref * peso_val / suma_desc_val)

        suma_pesos = peso_desc + peso_val
        if suma_pesos > 0:
            peso_texto_norm = peso_desc / suma_pesos
            peso_valor_norm = peso_val / suma_pesos
        else:
            peso_texto_norm = 0.7
            peso_valor_norm = 0.3

        # Margen de valor
        margen_pct = Decimal(os.getenv('SIMILAR_RECORDS_VALUE_MARGIN_PERCENT', '20')) / Decimal('100')
        valor_abs = abs(movimiento.valor) if movimiento.valor else Decimal(0)
        valor_min = valor_abs * (1 - margen_pct)
        valor_max = valor_abs * (1 + margen_pct)

        # Descripción normalizada del movimiento actual
        descripcion = movimiento.descripcion or ""
        desc_norm = self._aplicar_aliases(descripcion, movimiento.cuenta_id)

        # Referencia del movimiento actual
        ref_actual = (movimiento.referencia or "").strip()

        resultados_scoring = []
        for cand in candidatos:
            if cand.id == movimiento_id:
                continue

            # Match referencia
            match_ref = 0
            ref_cand = (cand.referencia or "").strip()
            if (len(ref_actual) >= longitud_min_ref and
                len(ref_cand) >= longitud_min_ref and
                ref_actual == ref_cand):
                match_ref = 100

            # Similitud texto
            cand_desc_norm = self._aplicar_aliases(cand.descripcion or "", movimiento.cuenta_id)
            sim_texto = calcular_similitud_hibrida(desc_norm, cand_desc_norm)

            # Similitud valor
            score_valor = 0
            cand_valor_abs = abs(cand.valor) if cand.valor else Decimal(0)
            if cand.valor == movimiento.valor:
                score_valor = 100
            elif (cand.valor is not None and movimiento.valor is not None
                  and (cand.valor < 0) == (movimiento.valor < 0)
                  and valor_min <= cand_valor_abs <= valor_max):
                score_valor = 80

            # Score final
            if match_ref == 100:
                score_final = 100.0
            else:
                score_final = (sim_texto * peso_texto_norm) + (score_valor * peso_valor_norm)

            resultados_scoring.append({
                'movimiento': cand,
                'score_final': score_final,
            })

        # Ordenar por score desc, fecha desc, valor por cercanía
        valor_referencia = abs(movimiento.valor or 0)
        fecha_min = date(1900, 1, 1)
        resultados_scoring.sort(
            key=lambda x: (
                -x['score_final'],
                -(x['movimiento'].fecha if x['movimiento'].fecha else fecha_min).toordinal(),
                abs(abs(x['movimiento'].valor or 0) - valor_referencia)
            )
        )

        # Top 5 sobre umbral
        contexto_con_score = [
            {'movimiento': r['movimiento'], 'score': round(r['score_final'], 1)}
            for r in resultados_scoring[:10]
            if r['score_final'] >= UMBRAL_MINIMO_HISTORIAL
        ][:5]

        # Inferir CC/Concepto por frecuencia
        sugerencia = {
            'tercero_id': tercero_id,
            'centro_costo_id': None,
            'concepto_id': None,
            'razon': 'Historial del tercero seleccionado' if contexto_con_score else None,
            'tipo_match': 'tercero_manual'
        }

        candidatos_tercero = [
            r['movimiento'] for r in resultados_scoring
            if r['movimiento'].tercero_id == tercero_id
            and r['score_final'] >= UMBRAL_CONSISTENCIA_MIN
        ]

        if candidatos_tercero:
            umbral_cc_concepto = float(os.getenv('CLASIFICACION_UMBRAL_CC_CONCEPTO', '0.6'))

            cc_counter = Counter(m.centro_costo_id for m in candidatos_tercero if m.centro_costo_id)
            concepto_counter = Counter(m.concepto_id for m in candidatos_tercero if m.concepto_id)

            if cc_counter:
                cc_mas_frecuente, cc_count = cc_counter.most_common(1)[0]
                if cc_count >= len(candidatos_tercero) * umbral_cc_concepto:
                    sugerencia['centro_costo_id'] = cc_mas_frecuente

            if concepto_counter:
                concepto_mas_frecuente, concepto_count = concepto_counter.most_common(1)[0]
                if concepto_count >= len(candidatos_tercero) * umbral_cc_concepto:
                    sugerencia['concepto_id'] = concepto_mas_frecuente

        # Calcular confianza
        confianza = None
        if contexto_con_score:
            best_score = max(c['score'] for c in contexto_con_score)
            if best_score >= 80:
                confianza = 'alta'
            elif best_score >= 50:
                confianza = 'media'
            else:
                confianza = 'baja'

        return {
            'movimiento_id': movimiento.id,
            'sugerencia': sugerencia,
            'contexto': contexto_con_score,
            'referencia_no_existe': False,
            'referencia': None,
            'descripcion_generica': False,
            'confianza': confianza
        }

    def aplicar_regla_lote(self, patron: str, tercero_id: int, centro_costo_id: int, concepto_id: int) -> int:
        """
        Aplica una clasificación a todos los movimientos pendientes que coinciden con un patrón.
        """
        # Delegar al repositorio para eficiencia (UPDATE masivo)
        return self.movimiento_repo.actualizar_clasificacion_lote(patron, tercero_id, centro_costo_id, concepto_id)

    def obtener_movimientos_similares_pendientes(self, movimiento_id: int) -> List[dict]:
        """
        Encuentra todos los movimientos PENDIENTES similares a un movimiento dado.
        Usa el mismo algoritmo de similitud de texto del fallback.
        Retorna lista con movimientos y su porcentaje de similitud.
        """
        # Obtener el movimiento de referencia
        movimiento = self.movimiento_repo.obtener_por_id(movimiento_id)
        if not movimiento:
            raise ValueError(f"Movimiento {movimiento_id} no encontrado")
        
        # Extraer múltiples palabras significativas (mismo algoritmo mejorado que fallback)
        descripcion = movimiento.descripcion or ""
        palabras_ignorar = {'y', 'de', 'la', 'el', 'en', 'a', 'por', 'para', 'con', 'cop', 'usd'}
        palabras = descripcion.split()
        
        # FIX: Permitir palabras de >= 2 letras
        palabras_significativas = [p for p in palabras if p.lower() not in palabras_ignorar and len(p) >= 2]
        
        # Obtener todas las palabras significativas sin límite
        palabras_busqueda = palabras_significativas
        
        if not palabras_busqueda:
            return []
        
        # Buscar movimientos que contengan al menos una de las palabras clave
        candidatos_map = {}  # {id: {'mov': mov, 'score': int}}
        
        for palabra in palabras_busqueda:
            if len(palabra) >= 2: # FIX: Ajustar validación para permitir 2 letras
                movs_palabra, _ = self.movimiento_repo.buscar_avanzado(
                    descripcion_contiene=palabra,
                    solo_pendientes=True,  # Solo pendientes
                    limit=50
                )
                # Agregar y contar coincidencias (score de cobertura)
                for m in movs_palabra:
                    if m.id not in candidatos_map:
                        candidatos_map[m.id] = {'mov': m, 'score': 0}
                    candidatos_map[m.id]['score'] += 1
        
        # Convertir a lista y ordenar por score de cobertura (ranking)
        candidates_ranked = sorted(
            candidatos_map.values(), 
            key=lambda x: x['score'], 
            reverse=True
        )
        
        # Quedarnos con los top 100 candidatos por cobertura
        movs_similares = [c['mov'] for c in candidates_ranked[:100]]
        
        # Obtener umbral de similitud desde variable de entorno
        umbral_similitud = float(os.getenv('SIMILAR_RECORDS_TEXT_SIMILARITY_THRESHOLD', '70'))
        descripcion_actual = movimiento.descripcion or ""

        # Normalizar la descripción actual usando aliases de la cuenta
        desc_actual_norm = self._aplicar_aliases(descripcion_actual, movimiento.cuenta_id)

        # Calcular similitud híbrida para cada candidato
        candidatos_similitud = []
        for m in movs_similares:
            if m.id != movimiento.id:  # Excluir el movimiento de referencia
                # Normalizar descripción del candidato y calcular similitud híbrida
                desc_cand_norm = self._aplicar_aliases(m.descripcion or "", movimiento.cuenta_id)
                similitud = calcular_similitud_hibrida(desc_actual_norm, desc_cand_norm)
                if similitud >= umbral_similitud:
                    candidatos_similitud.append({
                        'movimiento': m,
                        'similitud': round(similitud, 1)
                    })
        
        # Ordenar por similitud descendente
        candidatos_similitud.sort(key=lambda x: x['similitud'], reverse=True)
        
        return candidatos_similitud
