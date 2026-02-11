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
        amarillo_hasta: float = 15.0
    ) -> List[dict]:
        cursor = self.conn.cursor()

        # Construir parámetros para las 3 CTEs
        params_pres = [presupuesto_id, mes_inicio, mes_fin]
        exclusion_pres = self._build_exclusion_clause("pd", centros_costos_excluidos, params_pres)

        params_real = [anio, mes_inicio, mes_fin]
        exclusion_real = self._build_exclusion_clause("md", centros_costos_excluidos, params_real)

        params_ant = [anio - 1, mes_inicio, mes_fin]
        exclusion_ant = self._build_exclusion_clause("md", centros_costos_excluidos, params_ant)

        query = f"""
            WITH presupuesto_agg AS (
                SELECT pd.centro_costo_id, cc.centro_costo as nombre,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
                WHERE pd.presupuesto_id = %s AND pd.mes BETWEEN %s AND %s
                {exclusion_pres}
                GROUP BY pd.centro_costo_id, cc.centro_costo
            ),
            real_agg AS (
                SELECT md.centro_costo_id, cc.centro_costo as nombre,
                       SUM(ABS(md.Valor)) as ejecutado
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                JOIN centro_costos cc ON md.centro_costo_id = cc.centro_costo_id
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND md.Valor < 0
                  AND md.centro_costo_id IS NOT NULL
                {exclusion_real}
                GROUP BY md.centro_costo_id, cc.centro_costo
            ),
            anterior_agg AS (
                SELECT md.centro_costo_id, cc.centro_costo as nombre,
                       SUM(ABS(md.Valor)) as ejecutado_anterior
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                JOIN centro_costos cc ON md.centro_costo_id = cc.centro_costo_id
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND md.Valor < 0
                  AND md.centro_costo_id IS NOT NULL
                {exclusion_ant}
                GROUP BY md.centro_costo_id, cc.centro_costo
            )
            SELECT
                COALESCE(p.centro_costo_id, r.centro_costo_id, a.centro_costo_id) as id,
                COALESCE(p.nombre, r.nombre, a.nombre) as nombre,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(a.ejecutado_anterior, 0) as ejecutado_anterior,
                COALESCE(r.ejecutado, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON p.centro_costo_id = r.centro_costo_id
            FULL OUTER JOIN anterior_agg a ON COALESCE(p.centro_costo_id, r.centro_costo_id) = a.centro_costo_id
            ORDER BY COALESCE(r.ejecutado, 0) DESC
        """

        all_params = params_pres + params_real + params_ant
        cursor.execute(query, tuple(all_params))
        rows = cursor.fetchall()
        cursor.close()

        return [
            {
                "id": row[0],
                "nombre": row[1],
                "presupuestado": float(row[2]),
                "ejecutado": float(row[3]),
                "ejecutado_anterior": float(row[4]),
                "variacion": float(row[5]),
                "variacion_pct": float(row[6]),
                "semaforo": self._calcular_semaforo(float(row[6]), verde_hasta, amarillo_hasta)
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
        amarillo_hasta: float = 15.0
    ) -> List[dict]:
        cursor = self.conn.cursor()

        query = """
            WITH presupuesto_agg AS (
                SELECT pd.concepto_id, COALESCE(con.concepto, 'Sin Concepto') as nombre,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                LEFT JOIN conceptos con ON pd.concepto_id = con.conceptoid
                WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                      AND pd.mes BETWEEN %s AND %s
                GROUP BY pd.concepto_id, con.concepto
            ),
            real_agg AS (
                SELECT md.ConceptoID as concepto_id,
                       COALESCE(con.concepto, 'Sin Concepto') as nombre,
                       SUM(ABS(md.Valor)) as ejecutado
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                LEFT JOIN conceptos con ON md.ConceptoID = con.conceptoid
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND md.Valor < 0
                  AND md.centro_costo_id = %s
                GROUP BY md.ConceptoID, con.concepto
            ),
            anterior_agg AS (
                SELECT md.ConceptoID as concepto_id,
                       COALESCE(con.concepto, 'Sin Concepto') as nombre,
                       SUM(ABS(md.Valor)) as ejecutado_anterior
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                LEFT JOIN conceptos con ON md.ConceptoID = con.conceptoid
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND md.Valor < 0
                  AND md.centro_costo_id = %s
                GROUP BY md.ConceptoID, con.concepto
            )
            SELECT
                COALESCE(p.concepto_id, r.concepto_id, a.concepto_id) as id,
                COALESCE(p.nombre, r.nombre, a.nombre) as nombre,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(a.ejecutado_anterior, 0) as ejecutado_anterior,
                COALESCE(r.ejecutado, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON COALESCE(p.concepto_id, 0) = COALESCE(r.concepto_id, 0)
            FULL OUTER JOIN anterior_agg a ON COALESCE(p.concepto_id, r.concepto_id, 0) = COALESCE(a.concepto_id, 0)
            ORDER BY COALESCE(r.ejecutado, 0) DESC
        """

        cursor.execute(query, (
            presupuesto_id, centro_costo_id, mes_inicio, mes_fin,
            anio, mes_inicio, mes_fin, centro_costo_id,
            anio - 1, mes_inicio, mes_fin, centro_costo_id
        ))
        rows = cursor.fetchall()
        cursor.close()

        return [
            {
                "id": row[0],
                "nombre": row[1],
                "presupuestado": float(row[2]),
                "ejecutado": float(row[3]),
                "ejecutado_anterior": float(row[4]),
                "variacion": float(row[5]),
                "variacion_pct": float(row[6]),
                "semaforo": self._calcular_semaforo(float(row[6]), verde_hasta, amarillo_hasta)
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
        amarillo_hasta: float = 15.0
    ) -> List[dict]:
        cursor = self.conn.cursor()

        # Condiciones extra para concepto
        pres_concepto = "AND pd.concepto_id = %s" if concepto_id else ""
        real_concepto = "AND md.ConceptoID = %s" if concepto_id else ""
        ant_concepto = "AND md.ConceptoID = %s" if concepto_id else ""

        query = f"""
            WITH presupuesto_agg AS (
                SELECT pd.tercero_id, COALESCE(t.tercero, 'Sin Tercero') as nombre,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                LEFT JOIN terceros t ON pd.tercero_id = t.terceroid
                WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                      AND pd.mes BETWEEN %s AND %s
                      {pres_concepto}
                GROUP BY pd.tercero_id, t.tercero
            ),
            real_agg AS (
                SELECT m.terceroid as tercero_id,
                       COALESCE(t.tercero, 'Sin Tercero') as nombre,
                       SUM(ABS(md.Valor)) as ejecutado
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                LEFT JOIN terceros t ON m.terceroid = t.terceroid
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND md.Valor < 0
                  AND md.centro_costo_id = %s
                  {real_concepto}
                GROUP BY m.terceroid, t.tercero
            ),
            anterior_agg AS (
                SELECT m.terceroid as tercero_id,
                       COALESCE(t.tercero, 'Sin Tercero') as nombre,
                       SUM(ABS(md.Valor)) as ejecutado_anterior
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                LEFT JOIN terceros t ON m.terceroid = t.terceroid
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
                  AND md.Valor < 0
                  AND md.centro_costo_id = %s
                  {ant_concepto}
                GROUP BY m.terceroid, t.tercero
            )
            SELECT
                COALESCE(p.tercero_id, r.tercero_id, a.tercero_id) as id,
                COALESCE(p.nombre, r.nombre, a.nombre) as nombre,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(a.ejecutado_anterior, 0) as ejecutado_anterior,
                COALESCE(r.ejecutado, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON COALESCE(p.tercero_id, 0) = COALESCE(r.tercero_id, 0)
            FULL OUTER JOIN anterior_agg a ON COALESCE(p.tercero_id, r.tercero_id, 0) = COALESCE(a.tercero_id, 0)
            ORDER BY COALESCE(r.ejecutado, 0) DESC
        """

        params = [presupuesto_id, centro_costo_id, mes_inicio, mes_fin]
        if concepto_id:
            params.append(concepto_id)
        params.extend([anio, mes_inicio, mes_fin, centro_costo_id])
        if concepto_id:
            params.append(concepto_id)
        params.extend([anio - 1, mes_inicio, mes_fin, centro_costo_id])
        if concepto_id:
            params.append(concepto_id)

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()

        return [
            {
                "id": row[0],
                "nombre": row[1],
                "presupuestado": float(row[2]),
                "ejecutado": float(row[3]),
                "ejecutado_anterior": float(row[4]),
                "variacion": float(row[5]),
                "variacion_pct": float(row[6]),
                "semaforo": self._calcular_semaforo(float(row[6]), verde_hasta, amarillo_hasta)
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
        amarillo_hasta: float = 15.0
    ) -> List[dict]:
        cursor = self.conn.cursor()

        params_pres = [presupuesto_id]
        exclusion_pres = self._build_exclusion_clause("pd", centros_costos_excluidos, params_pres)

        # Filtros opcionales para presupuesto
        pres_filters = ""
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

        # Filtros opcionales para real
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

        # Año anterior
        params_ant = [anio - 1]
        exclusion_ant = self._build_exclusion_clause("md", centros_costos_excluidos, params_ant)

        ant_filters = ""
        if centro_costo_id:
            ant_filters += " AND md.centro_costo_id = %s"
            params_ant.append(centro_costo_id)
        if concepto_id:
            ant_filters += " AND md.ConceptoID = %s"
            params_ant.append(concepto_id)
        if tercero_id:
            ant_filters += " AND m.terceroid = %s"
            params_ant.append(tercero_id)

        query = f"""
            WITH presupuesto_agg AS (
                SELECT pd.mes,
                       SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
                FROM presupuesto_detalle pd
                WHERE pd.presupuesto_id = %s
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
                GROUP BY EXTRACT(MONTH FROM m.Fecha)
            ),
            anterior_agg AS (
                SELECT EXTRACT(MONTH FROM m.Fecha)::INT as mes,
                       SUM(ABS(md.Valor)) as ejecutado_anterior
                FROM movimientos_encabezado m
                JOIN movimientos_detalle md ON m.Id = md.movimiento_id
                WHERE EXTRACT(YEAR FROM m.Fecha) = %s
                  AND md.Valor < 0
                  AND md.centro_costo_id IS NOT NULL
                {exclusion_ant}
                {ant_filters}
                GROUP BY EXTRACT(MONTH FROM m.Fecha)
            )
            SELECT
                COALESCE(p.mes, r.mes, a.mes) as mes,
                COALESCE(p.presupuestado, 0) as presupuestado,
                COALESCE(r.ejecutado, 0) as ejecutado,
                COALESCE(a.ejecutado_anterior, 0) as ejecutado_anterior,
                COALESCE(r.ejecutado, 0) - COALESCE(p.presupuestado, 0) as variacion,
                CASE WHEN COALESCE(p.presupuestado, 0) = 0 THEN 0
                     ELSE ROUND(((COALESCE(r.ejecutado, 0) - p.presupuestado) / p.presupuestado * 100)::numeric, 1)
                END as variacion_pct
            FROM presupuesto_agg p
            FULL OUTER JOIN real_agg r ON p.mes = r.mes
            FULL OUTER JOIN anterior_agg a ON COALESCE(p.mes, r.mes) = a.mes
            ORDER BY COALESCE(p.mes, r.mes, a.mes)
        """

        all_params = params_pres + params_real + params_ant
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
                "ejecutado_anterior": float(row[3]),
                "variacion": float(row[4]),
                "variacion_pct": float(row[5]),
                "semaforo": self._calcular_semaforo(float(row[5]), verde_hasta, amarillo_hasta)
            }
            for row in rows
        ]
