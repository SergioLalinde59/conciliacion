import json
from typing import List, Optional
from psycopg2.extras import Json
from src.domain.models.tipo_gasto import TipoGasto
from src.domain.ports.tipo_gasto_repository import TipoGastoRepository


class PostgresTipoGastoRepository(TipoGastoRepository):
    def __init__(self, connection):
        self.conn = connection

    def _row_to_entity(self, row) -> Optional[TipoGasto]:
        if not row:
            return None
        keywords_raw = row[6]
        if isinstance(keywords_raw, str):
            keywords_raw = json.loads(keywords_raw)
        return TipoGasto(
            id=row[0],
            tipo=row[1],
            descripcion=row[2],
            indicador_default=row[3],
            excluir_presupuesto=row[4],
            activo=row[5],
            keywords=keywords_raw or [],
            prioridad=row[7] or 99,
            created_at=row[8],
            direccion=row[9] if len(row) > 9 else 'egreso',
        )

    _COLUMNS = "id, tipo, descripcion, indicador_default, excluir_presupuesto, activo, keywords, prioridad, created_at, direccion"

    def guardar(self, tipo_gasto: TipoGasto) -> TipoGasto:
        cursor = self.conn.cursor()
        try:
            if tipo_gasto.id:
                cursor.execute(
                    f"""UPDATE tipos_gasto
                       SET tipo = %s, descripcion = %s,
                           indicador_default = %s, excluir_presupuesto = %s, activo = %s,
                           keywords = %s, prioridad = %s, direccion = %s
                       WHERE id = %s
                       RETURNING {self._COLUMNS}""",
                    (tipo_gasto.tipo, tipo_gasto.descripcion,
                     tipo_gasto.indicador_default, tipo_gasto.excluir_presupuesto, tipo_gasto.activo,
                     Json(tipo_gasto.keywords), tipo_gasto.prioridad, tipo_gasto.direccion,
                     tipo_gasto.id)
                )
            else:
                cursor.execute(
                    f"""INSERT INTO tipos_gasto
                       (tipo, descripcion, indicador_default, excluir_presupuesto, activo, keywords, prioridad, direccion)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                       RETURNING {self._COLUMNS}""",
                    (tipo_gasto.tipo, tipo_gasto.descripcion,
                     tipo_gasto.indicador_default, tipo_gasto.excluir_presupuesto, tipo_gasto.activo,
                     Json(tipo_gasto.keywords), tipo_gasto.prioridad, tipo_gasto.direccion)
                )
            row = cursor.fetchone()
            self.conn.commit()
            return self._row_to_entity(row)
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def obtener_todos(self) -> List[TipoGasto]:
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT {self._COLUMNS} FROM tipos_gasto WHERE activo = TRUE ORDER BY prioridad ASC, id")
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_entity(r) for r in rows]

    def obtener_por_tipo(self, tipo: str) -> Optional[TipoGasto]:
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT {self._COLUMNS} FROM tipos_gasto WHERE tipo = %s", (tipo,))
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def obtener_por_id(self, id: int) -> Optional[TipoGasto]:
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT {self._COLUMNS} FROM tipos_gasto WHERE id = %s", (id,))
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def eliminar(self, id: int) -> None:
        """Soft delete: activo=False"""
        cursor = self.conn.cursor()
        try:
            cursor.execute("UPDATE tipos_gasto SET activo = FALSE WHERE id = %s", (id,))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()
