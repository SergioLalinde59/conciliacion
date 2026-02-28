from typing import List, Optional
from src.domain.ports.presupuesto_comparacion_repository import PresupuestoComparacionRepository


class PostgresPresupuestoComparacionRepository(PresupuestoComparacionRepository):
    def __init__(self, connection):
        self.conn = connection

    def _calcular_semaforo(self, variacion_pct: float, verde_hasta: float, amarillo_hasta: float, invertir: bool = False) -> str:
        """Semáforo direccional.
        Para egresos (invertir=False): sub-ejecución (negativo) = verde, sobre-ejecución = rojo.
        Para ingresos (invertir=True): sub-ejecución (negativo) = rojo, sobre-ejecución = verde.
        """
        if invertir:
            # Ingresos: ingresó menos de lo esperado = malo
            if variacion_pct >= 0:
                return 'verde'
            abs_pct = abs(variacion_pct)
            if abs_pct <= verde_hasta:
                return 'verde'
            if abs_pct <= amarillo_hasta:
                return 'amarillo'
            return 'rojo'
        else:
            # Egresos: gastó menos de lo esperado = bueno
            if variacion_pct <= 0:
                return 'verde'
            if variacion_pct <= verde_hasta:
                return 'verde'
            if variacion_pct <= amarillo_hasta:
                return 'amarillo'
            return 'rojo'

    @staticmethod
    def _valor_filter(direccion: str) -> str:
        """Retorna el filtro SQL de valor según dirección."""
        return "md.Valor > 0" if direccion == 'ingreso' else "md.Valor < 0"

    def _build_exclusion_clause(self, prefix: str, excluidos: Optional[List[int]], params: list) -> str:
        if not excluidos:
            return ""
        placeholders = ','.join(['%s'] * len(excluidos))
        params.extend(excluidos)
        return f" AND {prefix}.centro_costo_id NOT IN ({placeholders})"

    def _build_inclusion_clause(self, prefix: str, incluidos: Optional[List[int]], params: list) -> str:
        if not incluidos:
            return ""
        placeholders = ','.join(['%s'] * len(incluidos))
        params.extend(incluidos)
        return f" AND {prefix}.centro_costo_id IN ({placeholders})"

    def comparar_por_centro_costo(
        self,
        presupuesto_id: int,
        anio: int,
        mes_inicio: int = 1,
        mes_fin: int = 12,
        centros_costos_excluidos: Optional[List[int]] = None,
        centros_costos_incluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False,
        direccion: str = 'egreso'
    ) -> List[dict]:
        cursor = self.conn.cursor()
        months_in_period = mes_fin - mes_inicio + 1
        valor_filter = self._valor_filter(direccion)
        invertir_semaforo = (direccion == 'ingreso')

        # estacional_combos: siempre necesario
        params_estacional = [presupuesto_id, direccion]

        # ppto_conceptos
        params_ppto_conceptos = [presupuesto_id, direccion, mes_inicio, mes_fin]
        exclusion_ppto_conceptos = self._build_exclusion_clause("pd", centros_costos_excluidos, params_ppto_conceptos)
        inclusion_ppto_conceptos = self._build_inclusion_clause("pd", centros_costos_incluidos, params_ppto_conceptos)

        # presupuesto_agg — ahora siempre usa filtro estándar (estacional ya es /12 por mes)
        params_pres = [presupuesto_id, direccion, mes_inicio, mes_fin]
        exclusion_pres = self._build_exclusion_clause("pd", centros_costos_excluidos, params_pres)
        inclusion_pres = self._build_inclusion_clause("pd", centros_costos_incluidos, params_pres)

        if excluir_estacionales:
            ppto_conceptos_mes_filter = "AND pd.mes BETWEEN %s AND %s AND pd.tipo != 'Estacional'"
            pres_filter = "AND pd.tipo != 'Estacional' AND pd.mes BETWEEN %s AND %s"
            # Ejecutado: excluir estacionales, filtro estándar
            real_join_estacional = ""
            real_val = "ABS(md.Valor)"
            real_select = f"""SUM({real_val}) as ejecutado,
                       SUM(CASE WHEN pc.centro_costo_id IS NOT NULL THEN {real_val} ELSE 0 END) as ejecutado_con_ppto,
                       SUM(CASE WHEN pc.centro_costo_id IS NULL THEN {real_val} ELSE 0 END) as ejecutado_sin_ppto"""
            real_month_filter = """AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND NOT EXISTS (
                      SELECT 1 FROM estacional_combos ec2
                      WHERE ec2.centro_costo_id = md.centro_costo_id
                        AND COALESCE(ec2.concepto_id, 0) = COALESCE(md.ConceptoID, 0)
                  )"""
            params_real = [anio, mes_inicio, mes_fin]
        else:
            ppto_conceptos_mes_filter = "AND pd.mes BETWEEN %s AND %s"
            pres_filter = "AND pd.mes BETWEEN %s AND %s"
            # Ejecutado: estacionales amortizados (YTD / 12 * meses_periodo)
            real_join_estacional = """LEFT JOIN estacional_combos ec
                    ON ec.centro_costo_id = md.centro_costo_id
                    AND COALESCE(ec.concepto_id, 0) = COALESCE(md.ConceptoID, 0)"""
            amort = "CASE WHEN ec.centro_costo_id IS NOT NULL THEN ABS(md.Valor) / 12.0 * %s ELSE ABS(md.Valor) END"
            real_select = f"""SUM({amort}) as ejecutado,
                       SUM(CASE WHEN pc.centro_costo_id IS NOT NULL THEN {amort} ELSE 0 END) as ejecutado_con_ppto,
                       SUM(CASE WHEN pc.centro_costo_id IS NULL THEN {amort} ELSE 0 END) as ejecutado_sin_ppto"""
            real_month_filter = """AND (
                      (ec.centro_costo_id IS NULL AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s)
                      OR
                      (ec.centro_costo_id IS NOT NULL AND EXTRACT(MONTH FROM m.Fecha) BETWEEN 1 AND %s)
                  )"""
            params_real = [months_in_period, months_in_period, months_in_period, anio, mes_inicio, mes_fin, mes_fin]

        exclusion_real = self._build_exclusion_clause("md", centros_costos_excluidos, params_real)
        inclusion_real = self._build_inclusion_clause("md", centros_costos_incluidos, params_real)

        query = f"""
            WITH estacional_combos AS (
                SELECT DISTINCT pd.centro_costo_id, pd.concepto_id
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
                  AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                  AND pd.tipo = 'Estacional'
                  AND pd.direccion = %s
            ),
            ppto_conceptos AS (
                SELECT DISTINCT pd.centro_costo_id, pd.concepto_id
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
                  AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                  AND pd.direccion = %s
                  {ppto_conceptos_mes_filter}
                {exclusion_ppto_conceptos}
                {inclusion_ppto_conceptos}
            ),
            presupuesto_agg AS (
                SELECT pd.centro_costo_id, cc.centro_costo as nombre,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
                WHERE pd.presupuesto_id = %s
                      AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                      AND pd.direccion = %s
                      {pres_filter}
                {exclusion_pres}
                {inclusion_pres}
                GROUP BY pd.centro_costo_id, cc.centro_costo
            ),
            real_agg AS (
                SELECT md.centro_costo_id, cc.centro_costo as nombre,
                       {real_select}
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                JOIN centro_costos cc ON md.centro_costo_id = cc.centro_costo_id
                LEFT JOIN ppto_conceptos pc
                    ON md.centro_costo_id = pc.centro_costo_id
                    AND COALESCE(md.ConceptoID, 0) = COALESCE(pc.concepto_id, 0)
                {real_join_estacional}
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND {valor_filter}
                  AND md.centro_costo_id IS NOT NULL
                  {real_month_filter}
                {exclusion_real}
                {inclusion_real}
                GROUP BY md.centro_costo_id, cc.centro_costo
            )
            SELECT
                COALESCE(p.centro_costo_id, r.centro_costo_id) as id,
                COALESCE(p.nombre, r.nombre) as nombre,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(r.ejecutado_con_ppto, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado_con_ppto, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct,
                COALESCE(r.ejecutado_con_ppto, 0) as ejecutado_con_ppto,
                COALESCE(r.ejecutado_sin_ppto, 0) as ejecutado_sin_ppto
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON p.centro_costo_id = r.centro_costo_id
            ORDER BY COALESCE(r.ejecutado, 0) DESC
        """

        all_params = params_estacional + params_ppto_conceptos + params_pres + params_real
        cursor.execute(query, tuple(all_params))
        rows = cursor.fetchall()
        cursor.close()

        return [
            {
                "id": row[0],
                "nombre": row[1],
                "presupuestado": float(row[2]),
                "ejecutado": float(row[3]),
                "variacion": float(row[4]),
                "variacion_pct": float(row[5]),
                "semaforo": self._calcular_semaforo(float(row[5]), verde_hasta, amarillo_hasta, invertir_semaforo),
                "ejecutado_con_ppto": float(row[6]),
                "ejecutado_sin_ppto": float(row[7]),
            }
            for row in rows
        ]

    def comparar_por_concepto(
        self,
        presupuesto_id: int,
        anio: int,
        centro_costo_id: int,
        mes_inicio: int = 1,
        mes_fin: int = 12,
        centros_costos_excluidos: Optional[List[int]] = None,
        centros_costos_incluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False,
        direccion: str = 'egreso'
    ) -> List[dict]:
        cursor = self.conn.cursor()
        months_in_period = mes_fin - mes_inicio + 1
        valor_filter = self._valor_filter(direccion)
        invertir_semaforo = (direccion == 'ingreso')

        # estacional_conceptos
        params_estacional = [presupuesto_id, centro_costo_id, direccion]

        # presupuesto_agg — filtro estándar (estacional ya es /12 por mes)
        params_pres = [presupuesto_id, centro_costo_id, direccion, mes_inicio, mes_fin]

        if excluir_estacionales:
            pres_filter = "AND pd.tipo != 'Estacional' AND pd.mes BETWEEN %s AND %s"
            # Ejecutado: excluir estacionales
            real_join_estacional = ""
            real_select = "SUM(ABS(md.Valor)) as ejecutado"
            real_month_filter = """AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND NOT EXISTS (
                      SELECT 1 FROM estacional_conceptos ec2
                      WHERE COALESCE(ec2.concepto_id, 0) = COALESCE(md.ConceptoID, 0)
                  )"""
            params_real = [anio, mes_inicio, mes_fin, centro_costo_id]
        else:
            pres_filter = "AND pd.mes BETWEEN %s AND %s"
            # Ejecutado: estacionales amortizados (YTD / 12 * meses_periodo)
            real_join_estacional = """LEFT JOIN estacional_conceptos ec
                    ON COALESCE(ec.concepto_id, 0) = COALESCE(md.ConceptoID, 0)"""
            amort = "CASE WHEN ec.es_est = 1 THEN ABS(md.Valor) / 12.0 * %s ELSE ABS(md.Valor) END"
            real_select = f"SUM({amort}) as ejecutado"
            real_month_filter = """AND (
                      (ec.es_est IS NULL AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s)
                      OR
                      (ec.es_est IS NOT NULL AND EXTRACT(MONTH FROM m.Fecha) BETWEEN 1 AND %s)
                  )"""
            params_real = [months_in_period, anio, mes_inicio, mes_fin, mes_fin, centro_costo_id]

        query = f"""
            WITH estacional_conceptos AS (
                SELECT DISTINCT pd.concepto_id, 1 as es_est
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                  AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                  AND pd.tipo = 'Estacional'
                  AND pd.direccion = %s
            ),
            presupuesto_agg AS (
                SELECT pd.concepto_id, COALESCE(con.concepto, 'Sin Concepto') as nombre,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado,
                       BOOL_OR(pd.tipo = 'Estacional') as es_estacional
                FROM presupuesto_detalle pd
                LEFT JOIN conceptos con ON pd.concepto_id = con.conceptoid
                WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                      AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                      AND pd.direccion = %s
                      {pres_filter}
                GROUP BY pd.concepto_id, con.concepto
            ),
            real_agg AS (
                SELECT md.ConceptoID as concepto_id,
                       COALESCE(con.concepto, 'Sin Concepto') as nombre,
                       {real_select}
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                LEFT JOIN conceptos con ON md.ConceptoID = con.conceptoid
                {real_join_estacional}
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND {valor_filter}
                  {real_month_filter}
                  AND md.centro_costo_id = %s
                GROUP BY md.ConceptoID, con.concepto
            )
            SELECT
                COALESCE(p.concepto_id, r.concepto_id) as id,
                COALESCE(p.nombre, r.nombre) as nombre,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(r.ejecutado, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct,
                COALESCE(p.es_estacional, false) as es_estacional
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON COALESCE(p.concepto_id, 0) = COALESCE(r.concepto_id, 0)
            ORDER BY COALESCE(r.ejecutado, 0) DESC
        """

        all_params = params_estacional + params_pres + params_real
        cursor.execute(query, tuple(all_params))
        rows = cursor.fetchall()
        cursor.close()

        return [
            {
                "id": row[0],
                "nombre": row[1],
                "presupuestado": float(row[2]),
                "ejecutado": float(row[3]),
                "variacion": float(row[4]),
                "variacion_pct": float(row[5]),
                "semaforo": self._calcular_semaforo(float(row[5]), verde_hasta, amarillo_hasta, invertir_semaforo),
                "es_estacional": bool(row[6])
            }
            for row in rows
        ]

    def comparar_por_tercero(
        self,
        presupuesto_id: int,
        anio: int,
        centro_costo_id: int,
        concepto_id: Optional[int] = None,
        mes_inicio: int = 1,
        mes_fin: int = 12,
        centros_costos_excluidos: Optional[List[int]] = None,
        centros_costos_incluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False,
        direccion: str = 'egreso'
    ) -> List[dict]:
        cursor = self.conn.cursor()
        months_in_period = mes_fin - mes_inicio + 1
        valor_filter = self._valor_filter(direccion)
        invertir_semaforo = (direccion == 'ingreso')

        pres_concepto = "AND pd.concepto_id = %s" if concepto_id else ""
        real_concepto = "AND md.ConceptoID = %s" if concepto_id else ""

        # estacional_conceptos
        params_estacional = [presupuesto_id, centro_costo_id, direccion]

        # presupuesto_total — filtro estándar (estacional ya es /12 por mes)
        params_pres = [presupuesto_id, centro_costo_id, direccion, mes_inicio, mes_fin]
        if concepto_id:
            params_pres.append(concepto_id)

        if excluir_estacionales:
            pres_filter = "AND pd.tipo != 'Estacional' AND pd.mes BETWEEN %s AND %s"
            real_join_estacional = ""
            real_select = "SUM(ABS(md.Valor)) as ejecutado"
            real_month_filter = """AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND NOT EXISTS (
                      SELECT 1 FROM estacional_conceptos ec2
                      WHERE COALESCE(ec2.concepto_id, 0) = COALESCE(md.ConceptoID, 0)
                  )"""
            params_real = [anio, mes_inicio, mes_fin, centro_costo_id]
        else:
            pres_filter = "AND pd.mes BETWEEN %s AND %s"
            # Ejecutado: estacionales amortizados (YTD / 12 * meses_periodo)
            real_join_estacional = """LEFT JOIN estacional_conceptos ec
                    ON COALESCE(ec.concepto_id, 0) = COALESCE(md.ConceptoID, 0)"""
            amort = "CASE WHEN ec.es_est = 1 THEN ABS(md.Valor) / 12.0 * %s ELSE ABS(md.Valor) END"
            real_select = f"SUM({amort}) as ejecutado"
            real_month_filter = """AND (
                      (ec.es_est IS NULL AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s)
                      OR
                      (ec.es_est IS NOT NULL AND EXTRACT(MONTH FROM m.Fecha) BETWEEN 1 AND %s)
                  )"""
            params_real = [months_in_period, anio, mes_inicio, mes_fin, mes_fin, centro_costo_id]

        if concepto_id:
            params_real.append(concepto_id)

        query = f"""
            WITH estacional_conceptos AS (
                SELECT DISTINCT pd.concepto_id, 1 as es_est
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                  AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                  AND pd.tipo = 'Estacional'
                  AND pd.direccion = %s
            ),
            presupuesto_total AS (
                SELECT COALESCE(SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)), 0) as total_ppto
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                      AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                      AND pd.direccion = %s
                      {pres_filter}
                      {pres_concepto}
            ),
            real_agg AS (
                SELECT md.TerceroID as tercero_id,
                       COALESCE(t.tercero, 'Sin Tercero') as nombre,
                       {real_select}
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                LEFT JOIN terceros t ON md.TerceroID = t.terceroid
                {real_join_estacional}
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND {valor_filter}
                  {real_month_filter}
                  AND md.centro_costo_id = %s
                  {real_concepto}
                GROUP BY md.TerceroID, t.tercero
            ),
            real_total AS (
                SELECT COALESCE(SUM(ejecutado), 0) as total FROM real_agg
            )
            SELECT
                r.tercero_id as id,
                r.nombre,
                CASE WHEN rt.total > 0 AND pt.total_ppto > 0
                     THEN ROUND((pt.total_ppto * r.ejecutado / rt.total)::numeric, 2)
                     ELSE 0
                END as presupuestado,
                r.ejecutado,
                r.ejecutado - CASE WHEN rt.total > 0 AND pt.total_ppto > 0
                                   THEN pt.total_ppto * r.ejecutado / rt.total
                                   ELSE 0
                              END as variacion,
                CASE WHEN pt.total_ppto > 0 AND rt.total > 0
                     THEN ROUND(((rt.total - pt.total_ppto) / pt.total_ppto * 100)::numeric, 1)
                     ELSE 0
                END as variacion_pct
            FROM real_agg r
            CROSS JOIN presupuesto_total pt
            CROSS JOIN real_total rt
            WHERE rt.total > 0
            UNION ALL
            SELECT
                NULL::integer as id,
                'Sin Tercero' as nombre,
                pt.total_ppto as presupuestado,
                0::numeric as ejecutado,
                -pt.total_ppto as variacion,
                CASE WHEN pt.total_ppto > 0 THEN -100.0 ELSE 0 END as variacion_pct
            FROM presupuesto_total pt
            CROSS JOIN real_total rt
            WHERE rt.total = 0 AND pt.total_ppto > 0
            ORDER BY 4 DESC
        """

        all_params = params_estacional + params_pres + params_real
        cursor.execute(query, tuple(all_params))
        rows = cursor.fetchall()
        cursor.close()

        return [
            {
                "id": row[0],
                "nombre": row[1],
                "presupuestado": float(row[2]),
                "ejecutado": float(row[3]),
                "variacion": float(row[4]),
                "variacion_pct": float(row[5]),
                "semaforo": self._calcular_semaforo(float(row[5]), verde_hasta, amarillo_hasta, invertir_semaforo)
            }
            for row in rows
        ]

    def comparar_resumen_mensual(
        self,
        presupuesto_id: int,
        anio: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        centros_costos_incluidos: Optional[List[int]] = None,
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None,
        tercero_id: Optional[int] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False,
        direccion: str = 'egreso'
    ) -> List[dict]:
        cursor = self.conn.cursor()
        valor_filter = self._valor_filter(direccion)
        invertir_semaforo = (direccion == 'ingreso')

        # estacional_combos (solo si excluir)
        params_estacional = [presupuesto_id, direccion] if excluir_estacionales else []

        params_pres = [presupuesto_id, direccion]
        exclusion_pres = self._build_exclusion_clause("pd", centros_costos_excluidos, params_pres)
        inclusion_pres = self._build_inclusion_clause("pd", centros_costos_incluidos, params_pres)

        pres_filters = ""
        if excluir_estacionales:
            pres_filters += " AND pd.tipo != 'Estacional'"
        if centro_costo_id:
            pres_filters += " AND pd.centro_costo_id = %s"
            params_pres.append(centro_costo_id)
        if concepto_id:
            pres_filters += " AND pd.concepto_id = %s"
            params_pres.append(concepto_id)
        if tercero_id:
            pres_filters += " AND pd.tercero_id = %s"
            params_pres.append(tercero_id)

        params_real = [anio]
        exclusion_real = self._build_exclusion_clause("md", centros_costos_excluidos, params_real)
        inclusion_real = self._build_inclusion_clause("md", centros_costos_incluidos, params_real)

        real_filters = ""
        if centro_costo_id:
            real_filters += " AND md.centro_costo_id = %s"
            params_real.append(centro_costo_id)
        if concepto_id:
            real_filters += " AND md.ConceptoID = %s"
            params_real.append(concepto_id)
        if tercero_id:
            real_filters += " AND md.TerceroID = %s"
            params_real.append(tercero_id)

        # Anterior (year - 1)
        params_anterior = [anio - 1]
        exclusion_anterior = self._build_exclusion_clause("md", centros_costos_excluidos, params_anterior)
        inclusion_anterior = self._build_inclusion_clause("md", centros_costos_incluidos, params_anterior)

        anterior_filters = ""
        if centro_costo_id:
            anterior_filters += " AND md.centro_costo_id = %s"
            params_anterior.append(centro_costo_id)
        if concepto_id:
            anterior_filters += " AND md.ConceptoID = %s"
            params_anterior.append(concepto_id)
        if tercero_id:
            anterior_filters += " AND md.TerceroID = %s"
            params_anterior.append(tercero_id)

        estacional_exclusion_real = ""
        estacional_exclusion_anterior = ""
        if excluir_estacionales:
            estacional_exclusion_real = """AND NOT EXISTS (
                      SELECT 1 FROM estacional_combos ec
                      WHERE ec.centro_costo_id = md.centro_costo_id
                        AND COALESCE(ec.concepto_id, 0) = COALESCE(md.ConceptoID, 0)
                  )"""
            estacional_exclusion_anterior = estacional_exclusion_real

        estacional_cte = ""
        if excluir_estacionales:
            estacional_cte = """estacional_combos AS (
                SELECT DISTINCT pd.centro_costo_id, pd.concepto_id
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
                  AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                  AND pd.tipo = 'Estacional'
                  AND pd.direccion = %s
            ),"""

        query = f"""
            WITH {estacional_cte}
            presupuesto_agg AS (
                SELECT pd.mes,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
                      AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                      AND pd.direccion = %s
                {exclusion_pres}
                {inclusion_pres}
                {pres_filters}
                GROUP BY pd.mes
            ),
            real_agg AS (
                SELECT EXTRACT(MONTH FROM m.Fecha)::INT as mes,
                       SUM(ABS(md.Valor)) as ejecutado
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND {valor_filter}
                  AND md.centro_costo_id IS NOT NULL
                {exclusion_real}
                {inclusion_real}
                {real_filters}
                {estacional_exclusion_real}
                GROUP BY EXTRACT(MONTH FROM m.Fecha)
            ),
            anterior_agg AS (
                SELECT EXTRACT(MONTH FROM m.Fecha)::INT as mes,
                       SUM(ABS(md.Valor)) as ejecutado_anterior
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND {valor_filter}
                  AND md.centro_costo_id IS NOT NULL
                {exclusion_anterior}
                {inclusion_anterior}
                {anterior_filters}
                {estacional_exclusion_anterior}
                GROUP BY EXTRACT(MONTH FROM m.Fecha)
            )
            SELECT
                COALESCE(p.mes, r.mes, a.mes) as mes,
                COALESCE(a.ejecutado_anterior, 0) as ejecutado_anterior,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(r.ejecutado, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON p.mes = r.mes
            FULL OUTER JOIN anterior_agg a ON COALESCE(p.mes, r.mes) = a.mes
            ORDER BY COALESCE(p.mes, r.mes, a.mes)
        """

        all_params = params_estacional + params_pres + params_real + params_anterior
        cursor.execute(query, tuple(all_params))
        rows = cursor.fetchall()
        cursor.close()

        meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

        return [
            {
                "mes": row[0],
                "mes_nombre": meses[row[0]] if row[0] and 1 <= row[0] <= 12 else "?",
                "ejecutado_anterior": float(row[1]),
                "presupuestado": float(row[2]),
                "ejecutado": float(row[3]),
                "variacion": float(row[4]),
                "variacion_pct": float(row[5]),
                "semaforo": self._calcular_semaforo(float(row[5]), verde_hasta, amarillo_hasta, invertir_semaforo)
            }
            for row in rows
        ]

    def obtener_gastos_sin_presupuesto(
        self,
        presupuesto_id: int,
        anio: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        centros_costos_incluidos: Optional[List[int]] = None,
        direccion: str = 'egreso'
    ) -> List[dict]:
        """Movimientos del año actual sin filas en presupuesto_detalle, con info de regla existente."""
        cursor = self.conn.cursor()
        valor_filter = self._valor_filter(direccion)

        params = [direccion, anio, presupuesto_id, presupuesto_id, direccion]
        exclusion = self._build_exclusion_clause("md", centros_costos_excluidos, params)
        inclusion = self._build_inclusion_clause("md", centros_costos_incluidos, params)

        query = f"""
            SELECT
                md.centro_costo_id,
                md.ConceptoID as concepto_id,
                cc.centro_costo as centro_costo_nombre,
                con.concepto as concepto_nombre,
                SUM(ABS(md.Valor)) as monto_acumulado,
                COUNT(DISTINCT EXTRACT(MONTH FROM m.Fecha)::INT) as meses_con_gasto,
                rp.id as regla_id,
                rp.tipo_gasto as regla_tipo_gasto
            FROM movimientos_encabezado m
            JOIN movimientos_detalle md ON m.Id = md.movimiento_id
            LEFT JOIN centro_costos cc ON md.centro_costo_id = cc.centro_costo_id
            LEFT JOIN conceptos con ON md.ConceptoID = con.conceptoid
            LEFT JOIN reglas_presupuesto rp
                ON rp.centro_costo_id = md.centro_costo_id
                AND COALESCE(rp.concepto_id, 0) = COALESCE(md.ConceptoID, 0)
                AND rp.direccion = %s
            WHERE EXTRACT(YEAR FROM m.Fecha) = %s
              AND {valor_filter}
              AND md.centro_costo_id IS NOT NULL
              AND NOT EXISTS (
                  SELECT 1 FROM presupuesto_detalle pd
                  WHERE pd.presupuesto_id = %s
                    AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = %s)
                    AND pd.direccion = %s
                    AND pd.centro_costo_id = md.centro_costo_id
                    AND COALESCE(pd.concepto_id, 0) = COALESCE(md.ConceptoID, 0)
              )
              {exclusion}
              {inclusion}
            GROUP BY md.centro_costo_id, md.ConceptoID, cc.centro_costo, con.concepto,
                     rp.id, rp.tipo_gasto
            ORDER BY SUM(ABS(md.Valor)) DESC
        """

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()

        return [
            {
                "centro_costo_id": row[0],
                "concepto_id": row[1],
                "centro_costo_nombre": row[2],
                "concepto_nombre": row[3],
                "monto_acumulado": float(row[4]),
                "meses_con_gasto": row[5],
                "tiene_regla": row[6] is not None,
                "regla_tipo_gasto": row[7],
            }
            for row in rows
        ]
