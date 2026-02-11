from typing import List, Optional
from src.domain.models.regla_presupuesto import ReglaPresupuesto
from src.domain.ports.regla_presupuesto_repository import ReglaPresupuestoRepository


class PostgresReglaPresupuestoRepository(ReglaPresupuestoRepository):
    def __init__(self, connection):
        self.conn = connection

    def _row_to_entity(self, row) -> Optional[ReglaPresupuesto]:
        if not row:
            return None
        return ReglaPresupuesto(
            id=row[0],
            centro_costo_id=row[1],
            concepto_id=row[2],
            tipo_gasto=row[3],
            indicador_nombre=row[4],
            factor_ajuste=row[5],
            monto_fijo_mensual=row[6],
            notas=row[7],
            created_at=row[8],
            centro_costo_nombre=row[9] if len(row) > 9 else None,
            concepto_nombre=row[10] if len(row) > 10 else None
        )

    _BASE_SELECT = """
        SELECT r.id, r.centro_costo_id, r.concepto_id, r.tipo_gasto,
               r.indicador_nombre, r.factor_ajuste, r.monto_fijo_mensual,
               r.notas, r.created_at,
               cc.centro_costo as centro_costo_nombre,
               con.concepto as concepto_nombre
        FROM reglas_presupuesto r
        LEFT JOIN centro_costos cc ON r.centro_costo_id = cc.centro_costo_id
        LEFT JOIN conceptos con ON r.concepto_id = con.conceptoid
    """

    def guardar(self, regla: ReglaPresupuesto) -> ReglaPresupuesto:
        cursor = self.conn.cursor()
        try:
            if regla.id:
                cursor.execute(
                    """UPDATE reglas_presupuesto
                       SET centro_costo_id = %s, concepto_id = %s,
                           tipo_gasto = %s, indicador_nombre = %s,
                           factor_ajuste = %s, monto_fijo_mensual = %s,
                           notas = %s
                       WHERE id = %s RETURNING id""",
                    (regla.centro_costo_id, regla.concepto_id,
                     regla.tipo_gasto, regla.indicador_nombre,
                     regla.factor_ajuste, regla.monto_fijo_mensual,
                     regla.notas, regla.id)
                )
            else:
                cursor.execute(
                    """INSERT INTO reglas_presupuesto
                       (centro_costo_id, concepto_id, tipo_gasto,
                        indicador_nombre, factor_ajuste, monto_fijo_mensual, notas)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)
                       RETURNING id""",
                    (regla.centro_costo_id, regla.concepto_id,
                     regla.tipo_gasto, regla.indicador_nombre,
                     regla.factor_ajuste, regla.monto_fijo_mensual,
                     regla.notas)
                )
            result = cursor.fetchone()
            self.conn.commit()
            regla_id = regla.id if regla.id else result[0]
            return self.obtener_por_id(regla_id)
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def obtener_todos(self) -> List[ReglaPresupuesto]:
        cursor = self.conn.cursor()
        cursor.execute(self._BASE_SELECT + " ORDER BY r.centro_costo_id NULLS FIRST, r.concepto_id NULLS FIRST")
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_entity(r) for r in rows]

    def obtener_por_id(self, id: int) -> Optional[ReglaPresupuesto]:
        cursor = self.conn.cursor()
        cursor.execute(self._BASE_SELECT + " WHERE r.id = %s", (id,))
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def eliminar(self, id: int) -> None:
        cursor = self.conn.cursor()
        try:
            cursor.execute("DELETE FROM reglas_presupuesto WHERE id = %s", (id,))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def guardar_lote(self, reglas: List[ReglaPresupuesto]) -> dict:
        cursor = self.conn.cursor()
        creadas = 0
        omitidas = 0
        try:
            for regla in reglas:
                # Verificar si ya existe una regla con mismo CC+Concepto
                if regla.concepto_id is not None:
                    cursor.execute(
                        "SELECT id FROM reglas_presupuesto WHERE centro_costo_id = %s AND concepto_id = %s",
                        (regla.centro_costo_id, regla.concepto_id)
                    )
                else:
                    cursor.execute(
                        "SELECT id FROM reglas_presupuesto WHERE centro_costo_id = %s AND concepto_id IS NULL",
                        (regla.centro_costo_id,)
                    )
                if cursor.fetchone():
                    omitidas += 1
                    continue
                cursor.execute(
                    """INSERT INTO reglas_presupuesto
                       (centro_costo_id, concepto_id, tipo_gasto,
                        indicador_nombre, factor_ajuste, monto_fijo_mensual, notas)
                       VALUES (%s, %s, %s, %s, %s, %s, %s)""",
                    (regla.centro_costo_id, regla.concepto_id,
                     regla.tipo_gasto, regla.indicador_nombre,
                     regla.factor_ajuste, regla.monto_fijo_mensual,
                     regla.notas)
                )
                creadas += 1
            self.conn.commit()
            return {"creadas": creadas, "omitidas": omitidas}
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()
