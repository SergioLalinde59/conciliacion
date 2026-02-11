from typing import List, Optional
from decimal import Decimal
from src.domain.models.presupuesto_detalle import PresupuestoDetalle
from src.domain.ports.presupuesto_detalle_repository import PresupuestoDetalleRepository


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
            centro_costo_nombre=row[12] if len(row) > 12 else None,
            concepto_nombre=row[13] if len(row) > 13 else None,
            tercero_nombre=row[14] if len(row) > 14 else None
        )

    _BASE_SELECT = """
        SELECT pd.id, pd.presupuesto_id, pd.centro_costo_id, pd.concepto_id,
               pd.tercero_id, pd.mes, pd.monto_presupuestado, pd.monto_ajustado,
               pd.tipo, pd.notas, pd.created_at, pd.monto_base,
               cc.centro_costo as centro_costo_nombre,
               con.concepto as concepto_nombre,
               t.tercero as tercero_nombre
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
                        mes, monto_presupuestado, monto_ajustado, monto_base, tipo, notas)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING id, created_at""",
                    (detalle.presupuesto_id, detalle.centro_costo_id, detalle.concepto_id,
                     detalle.tercero_id, detalle.mes, detalle.monto_presupuestado,
                     detalle.monto_ajustado, detalle.monto_base, detalle.tipo, detalle.notas)
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
                 mes, monto_presupuestado, monto_ajustado, monto_base, tipo, notas)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (presupuesto_id, centro_costo_id, COALESCE(concepto_id, 0), COALESCE(tercero_id, 0), mes)
                DO UPDATE SET monto_presupuestado = EXCLUDED.monto_presupuestado,
                              monto_base = EXCLUDED.monto_base,
                              tipo = EXCLUDED.tipo
            """
            params = [
                (d.presupuesto_id, d.centro_costo_id, d.concepto_id, d.tercero_id,
                 d.mes, d.monto_presupuestado, d.monto_ajustado, d.monto_base, d.tipo, d.notas)
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
        mes: Optional[int] = None
    ) -> List[PresupuestoDetalle]:
        cursor = self.conn.cursor()
        conditions = ["pd.presupuesto_id = %s"]
        params = [presupuesto_id]

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

    # --- Resúmenes agregados ---

    def obtener_resumen_por_centro_costo(
        self, presupuesto_id: int, mes_inicio: int = 1, mes_fin: int = 12
    ) -> List[dict]:
        cursor = self.conn.cursor()
        cursor.execute("""
            SELECT pd.centro_costo_id, cc.centro_costo as nombre,
                   SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
            FROM presupuesto_detalle pd
            JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
            WHERE pd.presupuesto_id = %s AND pd.mes BETWEEN %s AND %s
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
        cursor.execute("""
            SELECT pd.concepto_id, COALESCE(con.concepto, 'Sin Concepto') as nombre,
                   SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
            FROM presupuesto_detalle pd
            LEFT JOIN conceptos con ON pd.concepto_id = con.conceptoid
            WHERE pd.presupuesto_id = %s AND pd.centro_costo_id = %s
                  AND pd.mes BETWEEN %s AND %s
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
        conditions = ["pd.presupuesto_id = %s", "pd.centro_costo_id = %s", "pd.mes BETWEEN %s AND %s"]
        params = [presupuesto_id, centro_costo_id, mes_inicio, mes_fin]
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
        cursor.execute("""
            SELECT pd.mes,
                   SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
            FROM presupuesto_detalle pd
            WHERE pd.presupuesto_id = %s
            GROUP BY pd.mes
            ORDER BY pd.mes
        """, (presupuesto_id,))
        rows = cursor.fetchall()
        cursor.close()
        meses = ["", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
                 "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
        return [{"mes": r[0], "mes_nombre": meses[r[0]], "presupuestado": float(r[1] or 0)} for r in rows]

    # --- Ajustes ---

    def aplicar_ajuste_global(self, presupuesto_id: int, porcentaje: Decimal) -> int:
        cursor = self.conn.cursor()
        try:
            cursor.execute("""
                UPDATE presupuesto_detalle
                SET monto_ajustado = ROUND(monto_presupuestado * (1 + %s / 100), 2)
                WHERE presupuesto_id = %s
            """, (porcentaje, presupuesto_id))
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
            """, (porcentaje, presupuesto_id, centro_costo_id))
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
