from typing import List, Optional
from src.domain.ports.presupuesto_comparacion_repository import PresupuestoComparacionRepository


class PostgresPresupuestoComparacionRepository(PresupuestoComparacionRepository):
    def __init__(self, connection):
        self.conn = connection

    def _calcular_semaforo(self, variacion_pct: float, verde_hasta: float, amarillo_hasta: float) -> str:
        """Semáforo direccional: sub-ejecución (negativo) siempre es verde"""
        if variacion_pct <= 0:
            return 'verde'
        if variacion_pct <= verde_hasta:
            return 'verde'
        if variacion_pct <= amarillo_hasta:
            return 'amarillo'
        return 'rojo'

    def _build_exclusion_clause(self, prefix: str, excluidos: Optional[List[int]], params: list) -> str:
        if not excluidos:
            return ""
        placeholders = ','.join(['%s'] * len(excluidos))
        params.extend(excluidos)
        return f" AND {prefix}.centro_costo_id NOT IN ({placeholders})"

    def comparar_por_centro_costo(
        self,
        presupuesto_id: int,
        anio: int,
        mes_inicio: int = 1,
        mes_fin: int = 12,
        centros_costos_excluidos: Optional[List[int]] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False
    ) -> List[dict]:
        cursor = self.conn.cursor()
        months_in_period = mes_fin - mes_inicio + 1

        # estacional_combos: siempre necesario
        params_estacional = [presupuesto_id]

        # ppto_conceptos
        params_ppto_conceptos = [presupuesto_id, mes_inicio, mes_fin]
        exclusion_ppto_conceptos = self._build_exclusion_clause("pd", centros_costos_excluidos, params_ppto_conceptos)

        # presupuesto_agg — ahora siempre usa filtro estándar (estacional ya es /12 por mes)
        params_pres = [presupuesto_id, mes_inicio, mes_fin]
        exclusion_pres = self._build_exclusion_clause("pd", centros_costos_excluidos, params_pres)

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

        query = f"""
            WITH estacional_combos AS (
                SELECT DISTINCT pd.centro_costo_id, pd.concepto_id
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
                  AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                  AND pd.tipo = 'Estacional'
            ),
            ppto_conceptos AS (
                SELECT DISTINCT pd.centro_costo_id, pd.concepto_id
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
                  AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                  {ppto_conceptos_mes_filter}
                {exclusion_ppto_conceptos}
            ),
            presupuesto_agg AS (
                SELECT pd.centro_costo_id, cc.centro_costo as nombre,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
                WHERE pd.presupuesto_id = %s
                      AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                      {pres_filter}
                {exclusion_pres}
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
                  AND md.Valor < 0
                  AND md.centro_costo_id IS NOT NULL
                  {real_month_filter}
                {exclusion_real}
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
                "semaforo": self._calcular_semaforo(float(row[5]), verde_hasta, amarillo_hasta),
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
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False
    ) -> List[dict]:
        cursor = self.conn.cursor()
        months_in_period = mes_fin - mes_inicio + 1

        # estacional_conceptos
        params_estacional = [presupuesto_id, centro_costo_id]

        # presupuesto_agg — filtro estándar (estacional ya es /12 por mes)
        params_pres = [presupuesto_id, centro_costo_id, mes_inicio, mes_fin]

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
            ),
            presupuesto_agg AS (
                SELECT pd.concepto_id, COALESCE(con.concepto, 'Sin Concepto') as nombre,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado,
                       BOOL_OR(pd.tipo = 'Estacional') as es_estacional
                FROM presupuesto_detalle pd
                LEFT JOIN conceptos con ON pd.concepto_id = con.conceptoid
                WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                      AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
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
                  AND md.Valor < 0
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
                "semaforo": self._calcular_semaforo(float(row[5]), verde_hasta, amarillo_hasta),
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
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False
    ) -> List[dict]:
        cursor = self.conn.cursor()
        months_in_period = mes_fin - mes_inicio + 1

        pres_concepto = "AND pd.concepto_id = %s" if concepto_id else ""
        real_concepto = "AND md.ConceptoID = %s" if concepto_id else ""

        # estacional_conceptos
        params_estacional = [presupuesto_id, centro_costo_id]

        # presupuesto_agg — filtro estándar (estacional ya es /12 por mes)
        params_pres = [presupuesto_id, centro_costo_id, mes_inicio, mes_fin]
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
            ),
            presupuesto_agg AS (
                SELECT pd.tercero_id, COALESCE(t.tercero, 'Sin Tercero') as nombre,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                LEFT JOIN terceros t ON pd.tercero_id = t.terceroid
                WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                      AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                      {pres_filter}
                      {pres_concepto}
                GROUP BY pd.tercero_id, t.tercero
            ),
            real_agg AS (
                SELECT m.terceroid as tercero_id,
                       COALESCE(t.tercero, 'Sin Tercero') as nombre,
                       {real_select}
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                LEFT JOIN terceros t ON m.terceroid = t.terceroid
                {real_join_estacional}
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND md.Valor < 0
                  {real_month_filter}
                  AND md.centro_costo_id = %s
                  {real_concepto}
                GROUP BY m.terceroid, t.tercero
            )
            SELECT
                COALESCE(p.tercero_id, r.tercero_id) as id,
                COALESCE(p.nombre, r.nombre) as nombre,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(r.ejecutado, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON COALESCE(p.tercero_id, 0) = COALESCE(r.tercero_id, 0)
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
                "semaforo": self._calcular_semaforo(float(row[5]), verde_hasta, amarillo_hasta)
            }
            for row in rows
        ]

    def comparar_resumen_mensual(
        self,
        presupuesto_id: int,
        anio: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None,
        tercero_id: Optional[int] = None,
        verde_hasta: float = 5.0,
        amarillo_hasta: float = 15.0,
        excluir_estacionales: bool = False
    ) -> List[dict]:
        cursor = self.conn.cursor()

        # estacional_combos (solo si excluir)
        params_estacional = [presupuesto_id] if excluir_estacionales else []

        params_pres = [presupuesto_id]
        exclusion_pres = self._build_exclusion_clause("pd", centros_costos_excluidos, params_pres)

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

        real_filters = ""
        if centro_costo_id:
            real_filters += " AND md.centro_costo_id = %s"
            params_real.append(centro_costo_id)
        if concepto_id:
            real_filters += " AND md.ConceptoID = %s"
            params_real.append(concepto_id)
        if tercero_id:
            real_filters += " AND m.terceroid = %s"
            params_real.append(tercero_id)

        estacional_exclusion_real = ""
        if excluir_estacionales:
            estacional_exclusion_real = """AND NOT EXISTS (
                      SELECT 1 FROM estacional_combos ec
                      WHERE ec.centro_costo_id = md.centro_costo_id
                        AND COALESCE(ec.concepto_id, 0) = COALESCE(md.ConceptoID, 0)
                  )"""

        estacional_cte = ""
        if excluir_estacionales:
            estacional_cte = """estacional_combos AS (
                SELECT DISTINCT pd.centro_costo_id, pd.concepto_id
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
                  AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                  AND pd.tipo = 'Estacional'
            ),"""

        query = f"""
            WITH {estacional_cte}
            presupuesto_agg AS (
                SELECT pd.mes,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
                      AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
                {exclusion_pres}
                {pres_filters}
                GROUP BY pd.mes
            ),
            real_agg AS (
                SELECT EXTRACT(MONTH FROM m.Fecha)::INT as mes,
                       SUM(ABS(md.Valor)) as ejecutado
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND md.Valor < 0
                  AND md.centro_costo_id IS NOT NULL
                {exclusion_real}
                {real_filters}
                {estacional_exclusion_real}
                GROUP BY EXTRACT(MONTH FROM m.Fecha)
            )
            SELECT
                COALESCE(p.mes, r.mes) as mes,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(r.ejecutado, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON p.mes = r.mes
            ORDER BY COALESCE(p.mes, r.mes)
        """

        all_params = params_estacional + params_pres + params_real
        cursor.execute(query, tuple(all_params))
        rows = cursor.fetchall()
        cursor.close()

        meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

        return [
            {
                "mes": row[0],
                "mes_nombre": meses[row[0]] if row[0] and 1 <= row[0] <= 12 else "?",
                "presupuestado": float(row[1]),
                "ejecutado": float(row[2]),
                "variacion": float(row[3]),
                "variacion_pct": float(row[4]),
                "semaforo": self._calcular_semaforo(float(row[4]), verde_hasta, amarillo_hasta)
            }
            for row in rows
        ]
