from typing import List, Optional
from decimal import Decimal
from src.domain.models.presupuesto_detalle import PresupuestoDetalle
from src.domain.ports.presupuesto_detalle_repository import PresupuestoDetalleRepository

# Subquery para obtener la versión actual de un presupuesto
_VERSION_ACTUAL_SQ = "(SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)"


class PostgresPresupuestoDetalleRepository(PresupuestoDetalleRepository):
    def __init__(self, connection):
        self.conn = connection

    def _row_to_entity(self, row) -> PresupuestoDetalle:
        if not row:
            return None
        return PresupuestoDetalle(
            id=row[0],
            presupuesto_id=row[1],
            centro_costo_id=row[2],
            concepto_id=row[3],
            tercero_id=row[4],
            mes=row[5],
            monto_presupuestado=row[6],
            monto_ajustado=row[7],
            tipo=row[8],
            notas=row[9],
            created_at=row[10],
            monto_base=row[11],
            version=row[12],
            centro_costo_nombre=row[13] if len(row) > 13 else None,
            concepto_nombre=row[14] if len(row) > 14 else None,
            tercero_nombre=row[15] if len(row) > 15 else None,
            direccion=row[16] if len(row) > 16 else 'egreso',
        )

    _BASE_SELECT = """
        SELECT pd.id, pd.presupuesto_id, pd.centro_costo_id, pd.concepto_id,
               pd.tercero_id, pd.mes, pd.monto_presupuestado, pd.monto_ajustado,
               pd.tipo, pd.notas, pd.created_at, pd.monto_base, pd.version,
               cc.centro_costo as centro_costo_nombre,
               con.concepto as concepto_nombre,
               t.tercero as tercero_nombre,
               pd.direccion
        FROM presupuesto_detalle pd
        LEFT JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
        LEFT JOIN conceptos con ON pd.concepto_id = con.conceptoid
        LEFT JOIN terceros t ON pd.tercero_id = t.terceroid
    """

    def guardar(self, detalle: PresupuestoDetalle) -> PresupuestoDetalle:
        cursor = self.conn.cursor()
        try:
            if detalle.id:
                cursor.execute(
                    """UPDATE presupuesto_detalle
                       SET centro_costo_id = %s, concepto_id = %s, tercero_id = %s,
                           mes = %s, monto_presupuestado = %s, monto_ajustado = %s,
                           monto_base = %s, tipo = %s, notas = %s
                       WHERE id = %s RETURNING id""",
                    (detalle.centro_costo_id, detalle.concepto_id, detalle.tercero_id,
                     detalle.mes, detalle.monto_presupuestado, detalle.monto_ajustado,
                     detalle.monto_base, detalle.tipo, detalle.notas, detalle.id)
                )
            else:
                cursor.execute(
                    """INSERT INTO presupuesto_detalle
                       (presupuesto_id, centro_costo_id, concepto_id, tercero_id,
                        mes, monto_presupuestado, monto_ajustado, monto_base, tipo, notas, version, direccion)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING id, created_at""",
                    (detalle.presupuesto_id, detalle.centro_costo_id, detalle.concepto_id,
                     detalle.tercero_id, detalle.mes, detalle.monto_presupuestado,
                     detalle.monto_ajustado, detalle.monto_base, detalle.tipo, detalle.notas,
                     detalle.version, detalle.direccion)
                )
                result = cursor.fetchone()
                detalle.id = result[0]
                detalle.created_at = result[1]
            self.conn.commit()
            return detalle
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def guardar_lote(self, detalles: List[PresupuestoDetalle]) -> int:
        if not detalles:
            return 0
        cursor = self.conn.cursor()
        try:
            query = """
                INSERT INTO presupuesto_detalle
                (presupuesto_id, centro_costo_id, concepto_id, tercero_id,
                 mes, monto_presupuestado, monto_ajustado, monto_base, tipo, notas, version, direccion)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (presupuesto_id, centro_costo_id, COALESCE(concepto_id, 0), COALESCE(tercero_id, 0), mes, version)
                DO UPDATE SET monto_presupuestado = EXCLUDED.monto_presupuestado,
                              monto_base = EXCLUDED.monto_base,
                              tipo = EXCLUDED.tipo,
                              direccion = EXCLUDED.direccion
            """
            params = [
                (d.presupuesto_id, d.centro_costo_id, d.concepto_id, d.tercero_id,
                 d.mes, d.monto_presupuestado, d.monto_ajustado, d.monto_base, d.tipo, d.notas,
                 d.version, d.direccion)
                for d in detalles
            ]
            cursor.executemany(query, params)
            count = cursor.rowcount
            self.conn.commit()
            return count
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def obtener_por_id(self, detalle_id: int) -> Optional[PresupuestoDetalle]:
        cursor = self.conn.cursor()
        cursor.execute(self._BASE_SELECT + " WHERE pd.id = %s", (detalle_id,))
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def obtener_por_presupuesto(
        self,
        presupuesto_id: int,
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None,
        tercero_id: Optional[int] = None,
        mes: Optional[int] = None,
        version: Optional[int] = None,
        direccion: Optional[str] = None
    ) -> List[PresupuestoDetalle]:
        cursor = self.conn.cursor()
        conditions = ["pd.presupuesto_id = %s"]
        params: list = [presupuesto_id]

        # Filtrar por versión: explícita o la actual
        if version is not None:
            conditions.append("pd.version = %s")
            params.append(version)
        else:
            conditions.append(f"pd.version = {_VERSION_ACTUAL_SQ}")

        if direccion:
            conditions.append("pd.direccion = %s")
            params.append(direccion)
        if centro_costo_id:
            conditions.append("pd.centro_costo_id = %s")
            params.append(centro_costo_id)
        if concepto_id:
            conditions.append("pd.concepto_id = %s")
            params.append(concepto_id)
        if tercero_id:
            conditions.append("pd.tercero_id = %s")
            params.append(tercero_id)
        if mes:
            conditions.append("pd.mes = %s")
            params.append(mes)

        query = self._BASE_SELECT + " WHERE " + " AND ".join(conditions)
        query += " ORDER BY cc.centro_costo, con.concepto, t.tercero, pd.mes"

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_entity(r) for r in rows]

    def eliminar(self, detalle_id: int) -> None:
        cursor = self.conn.cursor()
        try:
            cursor.execute("DELETE FROM presupuesto_detalle WHERE id = %s", (detalle_id,))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def eliminar_por_presupuesto(self, presupuesto_id: int) -> int:
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                "DELETE FROM presupuesto_detalle WHERE presupuesto_id = %s",
                (presupuesto_id,)
            )
            count = cursor.rowcount
            self.conn.commit()
            return count
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def eliminar_por_version(self, presupuesto_id: int, version: int) -> int:
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                "DELETE FROM presupuesto_detalle WHERE presupuesto_id = %s AND version = %s",
                (presupuesto_id, version)
            )
            count = cursor.rowcount
            self.conn.commit()
            return count
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    # --- Resúmenes agregados (siempre versión actual) ---

    def obtener_resumen_por_centro_costo(
        self, presupuesto_id: int, mes_inicio: int = 1, mes_fin: int = 12
    ) -> List[dict]:
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT pd.centro_costo_id, cc.centro_costo as nombre,
                   SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
            FROM presupuesto_detalle pd
            JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
            WHERE pd.presupuesto_id = %s AND pd.mes BETWEEN %s AND %s
                  AND pd.version = {_VERSION_ACTUAL_SQ}
            GROUP BY pd.centro_costo_id, cc.centro_costo
            ORDER BY presupuestado DESC
        """, (presupuesto_id, mes_inicio, mes_fin))
        rows = cursor.fetchall()
        cursor.close()
        return [{"id": r[0], "nombre": r[1], "presupuestado": float(r[2] or 0)} for r in rows]

    def obtener_resumen_por_concepto(
        self, presupuesto_id: int, centro_costo_id: int,
        mes_inicio: int = 1, mes_fin: int = 12
    ) -> List[dict]:
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT pd.concepto_id, COALESCE(con.concepto, 'Sin Concepto') as nombre,
                   SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
            FROM presupuesto_detalle pd
            LEFT JOIN conceptos con ON pd.concepto_id = con.conceptoid
            WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                  AND pd.mes BETWEEN %s AND %s
                  AND pd.version = {_VERSION_ACTUAL_SQ}
            GROUP BY pd.concepto_id, con.concepto
            ORDER BY presupuestado DESC
        """, (presupuesto_id, centro_costo_id, mes_inicio, mes_fin))
        rows = cursor.fetchall()
        cursor.close()
        return [{"id": r[0], "nombre": r[1], "presupuestado": float(r[2] or 0)} for r in rows]

    def obtener_resumen_por_tercero(
        self, presupuesto_id: int, centro_costo_id: int,
        concepto_id: Optional[int] = None,
        mes_inicio: int = 1, mes_fin: int = 12
    ) -> List[dict]:
        cursor = self.conn.cursor()
        conditions = [
            "pd.presupuesto_id = %s", "pd.centro_costo_id = %s",
            "pd.mes BETWEEN %s AND %s",
            f"pd.version = {_VERSION_ACTUAL_SQ}"
        ]
        params: list = [presupuesto_id, centro_costo_id, mes_inicio, mes_fin]
        if concepto_id:
            conditions.append("pd.concepto_id = %s")
            params.append(concepto_id)

        cursor.execute(f"""
            SELECT pd.tercero_id, COALESCE(t.tercero, 'Sin Tercero') as nombre,
                   SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
            FROM presupuesto_detalle pd
            LEFT JOIN terceros t ON pd.tercero_id = t.terceroid
            WHERE {' AND '.join(conditions)}
            GROUP BY pd.tercero_id, t.tercero
            ORDER BY presupuestado DESC
        """, tuple(params))
        rows = cursor.fetchall()
        cursor.close()
        return [{"id": r[0], "nombre": r[1], "presupuestado": float(r[2] or 0)} for r in rows]

    def obtener_resumen_mensual(self, presupuesto_id: int) -> List[dict]:
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT pd.mes,
                   SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
            FROM presupuesto_detalle pd
            WHERE pd.presupuesto_id = %s
                  AND pd.version = {_VERSION_ACTUAL_SQ}
            GROUP BY pd.mes
            ORDER BY pd.mes
        """, (presupuesto_id,))
        rows = cursor.fetchall()
        cursor.close()
        meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        return [{"mes": r[0], "mes_nombre": meses[r[0]], "presupuestado": float(r[1] or 0)} for r in rows]

    # --- Ajustes (solo versión actual) ---

    def aplicar_ajuste_global(self, presupuesto_id: int, porcentaje: Decimal) -> int:
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                UPDATE presupuesto_detalle
                SET monto_ajustado = ROUND(monto_presupuestado * (1 + %s / 100), 2)
                WHERE presupuesto_id = %s
                      AND version = (SELECT version_actual FROM presupuestos WHERE id = %s)
            """, (porcentaje, presupuesto_id, presupuesto_id))
            count = cursor.rowcount
            self.conn.commit()
            return count
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def aplicar_ajuste_centro_costo(
        self, presupuesto_id: int, centro_costo_id: int, porcentaje: Decimal
    ) -> int:
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                UPDATE presupuesto_detalle
                SET monto_ajustado = ROUND(monto_presupuestado * (1 + %s / 100), 2)
                WHERE presupuesto_id = %s AND centro_costo_id = %s
                      AND version = (SELECT version_actual FROM presupuestos WHERE id = %s)
            """, (porcentaje, presupuesto_id, centro_costo_id, presupuesto_id))
            count = cursor.rowcount
            self.conn.commit()
            return count
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def aplicar_ajuste_linea(self, detalle_id: int, monto: Decimal) -> PresupuestoDetalle:
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                UPDATE presupuesto_detalle SET monto_ajustado = %s WHERE id = %s RETURNING id
            """, (monto, detalle_id))
            if cursor.rowcount == 0:
                raise ValueError("Línea de presupuesto no encontrada")
            self.conn.commit()
            return self.obtener_por_id(detalle_id)
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    # --- Versiones ---

    def obtener_versiones(self, presupuesto_id: int) -> List[dict]:
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT pv.id, pv.version, pv.created_at, pv.notas,
                   pv.lineas_generadas, pv.total_presupuestado, pv.anio_fuente
            FROM presupuesto_versiones pv
            WHERE pv.presupuesto_id = %s
            ORDER BY pv.version DESC
        """, (presupuesto_id,))
        rows = cursor.fetchall()
        cursor.close()
        return [
            {
                "id": r[0], "version": r[1],
                "created_at": str(r[2]) if r[2] else None,
                "notas": r[3], "lineas_generadas": r[4],
                "total_presupuestado": float(r[5] or 0),
                "anio_fuente": r[6]
            }
            for r in rows
        ]

    def contar_reglas_sin_detalle(self, presupuesto_id: int, version: int) -> dict:
        """Cuenta reglas cuya combinación CC+Concepto no tiene filas en presupuesto_detalle.
        Solo incluye reglas con monto_fijo_mensual (las únicas que pueden generar filas sin historial).
        Excluye No Repetitivos (que por diseño tienen $0)."""
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                SELECT COUNT(*) as pendientes,
                       COALESCE(json_agg(json_build_object(
                           'regla_id', rp.id,
                           'centro_costo_nombre', cc.centro_costo,
                           'concepto_nombre', con.concepto,
                           'tipo_gasto', rp.tipo_gasto
                       )) FILTER (WHERE rp.id IS NOT NULL), '[]'::json) as detalle
                FROM reglas_presupuesto rp
                LEFT JOIN centro_costos cc ON rp.centro_costo_id = cc.centro_costo_id
                LEFT JOIN conceptos con ON rp.concepto_id = con.conceptoid
                WHERE rp.tipo_gasto NOT LIKE '%%No Repetitivo%%'
                  AND rp.monto_fijo_mensual IS NOT NULL
                  AND NOT EXISTS (
                      SELECT 1 FROM presupuesto_detalle pd
                      WHERE pd.presupuesto_id = %s
                        AND pd.version = %s
                        AND pd.centro_costo_id = rp.centro_costo_id
                        AND COALESCE(pd.concepto_id, 0) = COALESCE(rp.concepto_id, 0)
                  )
            """, (presupuesto_id, version))
            row = cursor.fetchone()
            import json
            detalle = row[1] if row[1] else []
            if isinstance(detalle, str):
                detalle = json.loads(detalle)
            return {"pendientes": row[0] or 0, "detalle": detalle}
        finally:
            cursor.close()

    def guardar_version(self, presupuesto_id: int, version: int,
                        lineas_generadas: int, total_presupuestado,
                        anio_fuente: int, notas: str = None) -> None:
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                INSERT INTO presupuesto_versiones
                (presupuesto_id, version, lineas_generadas, total_presupuestado, anio_fuente, notas)
                VALUES (%s, %s, %s, %s, %s, %s)
                ON CONFLICT (presupuesto_id, version) DO UPDATE SET
                    lineas_generadas = EXCLUDED.lineas_generadas,
                    total_presupuestado = EXCLUDED.total_presupuestado,
                    anio_fuente = EXCLUDED.anio_fuente
            """, (presupuesto_id, version, lineas_generadas, total_presupuestado, anio_fuente, notas))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    # --- Comparación entre versiones ---

    def comparar_versiones(
        self, presupuesto_id: int, version_a: int, version_b: int,
        nivel: str = 'centro_costo',
        centro_costo_id: Optional[int] = None,
        concepto_id: Optional[int] = None
    ) -> List[dict]:
        cursor = self.conn.cursor()

        if nivel == 'centro_costo':
            query = """
                WITH va AS (
                    SELECT pd.centro_costo_id as gid, cc.centro_costo as nombre,
                           SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as total
                    FROM presupuesto_detalle pd
                    JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
                    WHERE pd.presupuesto_id = %s AND pd.version = %s
                    GROUP BY pd.centro_costo_id, cc.centro_costo
                ),
                vb AS (
                    SELECT pd.centro_costo_id as gid, cc.centro_costo as nombre,
                           SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as total
                    FROM presupuesto_detalle pd
                    JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
                    WHERE pd.presupuesto_id = %s AND pd.version = %s
                    GROUP BY pd.centro_costo_id, cc.centro_costo
                )
                SELECT COALESCE(va.gid, vb.gid) as id,
                       COALESCE(va.nombre, vb.nombre) as nombre,
                       COALESCE(va.total, 0) as monto_version_a,
                       COALESCE(vb.total, 0) as monto_version_b,
                       COALESCE(vb.total, 0) - COALESCE(va.total, 0) as delta,
                       CASE WHEN COALESCE(va.total, 0) = 0 THEN NULL
                            ELSE ROUND(((COALESCE(vb.total, 0) - COALESCE(va.total, 0)) / ABS(va.total)) * 100, 1)
                       END as delta_pct
                FROM va
                FULL OUTER JOIN vb ON va.gid = vb.gid
                ORDER BY ABS(COALESCE(vb.total, 0) - COALESCE(va.total, 0)) DESC
            """
            params = [presupuesto_id, version_a, presupuesto_id, version_b]

        elif nivel == 'concepto':
            query = """
                WITH va AS (
                    SELECT COALESCE(pd.concepto_id, 0) as gid,
                           COALESCE(con.concepto, 'Sin concepto') as nombre,
                           SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as total
                    FROM presupuesto_detalle pd
                    LEFT JOIN conceptos con ON pd.concepto_id = con.conceptoid
                    WHERE pd.presupuesto_id = %s AND pd.version = %s
                          AND pd.centro_costo_id = %s
                    GROUP BY COALESCE(pd.concepto_id, 0), COALESCE(con.concepto, 'Sin concepto')
                ),
                vb AS (
                    SELECT COALESCE(pd.concepto_id, 0) as gid,
                           COALESCE(con.concepto, 'Sin concepto') as nombre,
                           SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as total
                    FROM presupuesto_detalle pd
                    LEFT JOIN conceptos con ON pd.concepto_id = con.conceptoid
                    WHERE pd.presupuesto_id = %s AND pd.version = %s
                          AND pd.centro_costo_id = %s
                    GROUP BY COALESCE(pd.concepto_id, 0), COALESCE(con.concepto, 'Sin concepto')
                )
                SELECT COALESCE(va.gid, vb.gid) as id,
                       COALESCE(va.nombre, vb.nombre) as nombre,
                       COALESCE(va.total, 0) as monto_version_a,
                       COALESCE(vb.total, 0) as monto_version_b,
                       COALESCE(vb.total, 0) - COALESCE(va.total, 0) as delta,
                       CASE WHEN COALESCE(va.total, 0) = 0 THEN NULL
                            ELSE ROUND(((COALESCE(vb.total, 0) - COALESCE(va.total, 0)) / ABS(va.total)) * 100, 1)
                       END as delta_pct
                FROM va
                FULL OUTER JOIN vb ON va.gid = vb.gid
                ORDER BY ABS(COALESCE(vb.total, 0) - COALESCE(va.total, 0)) DESC
            """
            params = [presupuesto_id, version_a, centro_costo_id,
                      presupuesto_id, version_b, centro_costo_id]

        elif nivel == 'tercero':
            concepto_filter_a = "AND pd.concepto_id = %s" if concepto_id else "AND pd.concepto_id IS NULL"
            concepto_filter_b = concepto_filter_a
            query = f"""
                WITH va AS (
                    SELECT COALESCE(pd.tercero_id, 0) as gid,
                           COALESCE(t.tercero, 'Sin tercero') as nombre,
                           SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as total
                    FROM presupuesto_detalle pd
                    LEFT JOIN terceros t ON pd.tercero_id = t.terceroid
                    WHERE pd.presupuesto_id = %s AND pd.version = %s
                          AND pd.centro_costo_id = %s {concepto_filter_a}
                    GROUP BY COALESCE(pd.tercero_id, 0), COALESCE(t.tercero, 'Sin tercero')
                ),
                vb AS (
                    SELECT COALESCE(pd.tercero_id, 0) as gid,
                           COALESCE(t.tercero, 'Sin tercero') as nombre,
                           SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as total
                    FROM presupuesto_detalle pd
                    LEFT JOIN terceros t ON pd.tercero_id = t.terceroid
                    WHERE pd.presupuesto_id = %s AND pd.version = %s
                          AND pd.centro_costo_id = %s {concepto_filter_b}
                    GROUP BY COALESCE(pd.tercero_id, 0), COALESCE(t.tercero, 'Sin tercero')
                )
                SELECT COALESCE(va.gid, vb.gid) as id,
                       COALESCE(va.nombre, vb.nombre) as nombre,
                       COALESCE(va.total, 0) as monto_version_a,
                       COALESCE(vb.total, 0) as monto_version_b,
                       COALESCE(vb.total, 0) - COALESCE(va.total, 0) as delta,
                       CASE WHEN COALESCE(va.total, 0) = 0 THEN NULL
                            ELSE ROUND(((COALESCE(vb.total, 0) - COALESCE(va.total, 0)) / ABS(va.total)) * 100, 1)
                       END as delta_pct
                FROM va
                FULL OUTER JOIN vb ON va.gid = vb.gid
                ORDER BY ABS(COALESCE(vb.total, 0) - COALESCE(va.total, 0)) DESC
            """
            params = [presupuesto_id, version_a, centro_costo_id]
            if concepto_id:
                params.append(concepto_id)
            params.extend([presupuesto_id, version_b, centro_costo_id])
            if concepto_id:
                params.append(concepto_id)
        else:
            cursor.close()
            return []

        cursor.execute(query, params)
        rows = cursor.fetchall()
        cursor.close()

        results = []
        for r in rows:
            rid = r[0]
            ma = float(r[2] or 0)
            mb = float(r[3] or 0)
            delta = float(r[4] or 0)
            delta_pct = float(r[5]) if r[5] is not None else None

            if ma == 0 and mb != 0:
                status = 'new'
            elif ma != 0 and mb == 0:
                status = 'removed'
            elif delta == 0:
                status = 'unchanged'
            else:
                status = 'changed'

            results.append({
                "id": rid if rid != 0 else None,
                "nombre": r[1],
                "monto_version_a": ma,
                "monto_version_b": mb,
                "delta": delta,
                "delta_pct": delta_pct,
                "status": status
            })
        return results
