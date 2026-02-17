from typing import List, Optional
from src.domain.models.presupuesto import Presupuesto
from src.domain.ports.presupuesto_repository import PresupuestoRepository

_COLUMNS = "id, anio, nombre, estado, notas, semaforo_verde_hasta, semaforo_amarillo_hasta, created_at, umbral_minimo_mensual, umbral_minimo_anual, umbral_no_repetitivo, umbral_estacional, umbral_pareto, version_actual, cifras_en_millones"


class PostgresPresupuestoRepository(PresupuestoRepository):
    def __init__(self, connection):
        self.conn = connection

    def _row_to_entity(self, row) -> Presupuesto:
        if not row:
            return None
        return Presupuesto(
            id=row[0],
            anio=row[1],
            nombre=row[2],
            semaforo_verde_hasta=float(row[5]),
            semaforo_amarillo_hasta=float(row[6]),
            umbral_minimo_mensual=float(row[8]) if row[8] is not None else 0.0,
            umbral_minimo_anual=float(row[9]) if row[9] is not None else 0.0,
            umbral_no_repetitivo=int(row[10]) if row[10] is not None else 4,
            umbral_estacional=int(row[11]) if row[11] is not None else 4,
            umbral_pareto=float(row[12]) if row[12] is not None else 5_000_000.0,
            version_actual=int(row[13]) if row[13] is not None else 1,
            cifras_en_millones=bool(row[14]) if row[14] is not None else False,
            estado=row[3],
            notas=row[4],
            created_at=row[7]
        )

    def guardar(self, presupuesto: Presupuesto) -> Presupuesto:
        cursor = self.conn.cursor()
        try:
            if presupuesto.id:
                cursor.execute(
                    """UPDATE presupuestos
                       SET anio = %s, nombre = %s, estado = %s, notas = %s,
                           semaforo_verde_hasta = %s, semaforo_amarillo_hasta = %s,
                           umbral_minimo_mensual = %s, umbral_minimo_anual = %s,
                           umbral_no_repetitivo = %s, umbral_estacional = %s,
                           umbral_pareto = %s, version_actual = %s,
                           cifras_en_millones = %s
                       WHERE id = %s
                       RETURNING id, created_at""",
                    (presupuesto.anio, presupuesto.nombre, presupuesto.estado,
                     presupuesto.notas, presupuesto.semaforo_verde_hasta,
                     presupuesto.semaforo_amarillo_hasta,
                     presupuesto.umbral_minimo_mensual, presupuesto.umbral_minimo_anual,
                     presupuesto.umbral_no_repetitivo, presupuesto.umbral_estacional,
                     presupuesto.umbral_pareto, presupuesto.version_actual,
                     presupuesto.cifras_en_millones,
                     presupuesto.id)
                )
                result = cursor.fetchone()
                if result:
                    presupuesto.created_at = result[1]
            else:
                cursor.execute(
                    """INSERT INTO presupuestos (anio, nombre, estado, notas,
                           semaforo_verde_hasta, semaforo_amarillo_hasta,
                           umbral_minimo_mensual, umbral_minimo_anual,
                           umbral_no_repetitivo, umbral_estacional,
                           umbral_pareto, version_actual, cifras_en_millones)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING id, created_at""",
                    (presupuesto.anio, presupuesto.nombre, presupuesto.estado,
                     presupuesto.notas, presupuesto.semaforo_verde_hasta,
                     presupuesto.semaforo_amarillo_hasta,
                     presupuesto.umbral_minimo_mensual, presupuesto.umbral_minimo_anual,
                     presupuesto.umbral_no_repetitivo, presupuesto.umbral_estacional,
                     presupuesto.umbral_pareto, presupuesto.version_actual,
                     presupuesto.cifras_en_millones)
                )
                result = cursor.fetchone()
                presupuesto.id = result[0]
                presupuesto.created_at = result[1]
            self.conn.commit()
            return presupuesto
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def obtener_por_id(self, presupuesto_id: int) -> Optional[Presupuesto]:
        cursor = self.conn.cursor()
        cursor.execute(
            f"SELECT {_COLUMNS} FROM presupuestos WHERE id = %s",
            (presupuesto_id,)
        )
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def obtener_todos(self, anio: Optional[int] = None) -> List[Presupuesto]:
        cursor = self.conn.cursor()
        if anio:
            cursor.execute(
                f"SELECT {_COLUMNS} FROM presupuestos WHERE anio = %s ORDER BY created_at DESC",
                (anio,)
            )
        else:
            cursor.execute(
                f"SELECT {_COLUMNS} FROM presupuestos ORDER BY anio DESC, created_at DESC"
            )
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_entity(r) for r in rows]

    def obtener_activo(self, anio: int) -> Optional[Presupuesto]:
        cursor = self.conn.cursor()
        cursor.execute(
            f"SELECT {_COLUMNS} FROM presupuestos WHERE anio = %s AND estado = 'activo'",
            (anio,)
        )
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def eliminar(self, presupuesto_id: int) -> None:
        cursor = self.conn.cursor()
        try:
            # Verificar que está en borrador
            cursor.execute("SELECT estado FROM presupuestos WHERE id = %s", (presupuesto_id,))
            row = cursor.fetchone()
            if not row:
                raise ValueError("Presupuesto no encontrado")
            if row[0] != 'borrador':
                raise ValueError("Solo se pueden eliminar presupuestos en estado borrador")
            cursor.execute("DELETE FROM presupuestos WHERE id = %s", (presupuesto_id,))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def cambiar_estado(self, presupuesto_id: int, nuevo_estado: str) -> Presupuesto:
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                f"""UPDATE presupuestos SET estado = %s WHERE id = %s
                   RETURNING {_COLUMNS}""",
                (nuevo_estado, presupuesto_id)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError("Presupuesto no encontrado")
            self.conn.commit()
            return self._row_to_entity(row)
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def incrementar_version(self, presupuesto_id: int) -> int:
        """Incrementa version_actual y retorna el nuevo número de versión."""
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                "UPDATE presupuestos SET version_actual = version_actual + 1 WHERE id = %s RETURNING version_actual",
                (presupuesto_id,)
            )
            row = cursor.fetchone()
            if not row:
                raise ValueError("Presupuesto no encontrado")
            self.conn.commit()
            return row[0]
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()
