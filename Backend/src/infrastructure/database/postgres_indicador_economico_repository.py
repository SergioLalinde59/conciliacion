from typing import List, Optional
from src.domain.models.indicador_economico import IndicadorEconomico
from src.domain.ports.indicador_economico_repository import IndicadorEconomicoRepository


class PostgresIndicadorEconomicoRepository(IndicadorEconomicoRepository):
    def __init__(self, connection):
        self.conn = connection

    def _row_to_entity(self, row) -> Optional[IndicadorEconomico]:
        if not row:
            return None
        return IndicadorEconomico(
            id=row[0],
            anio=row[1],
            indicador=row[2],
            valor_porcentaje=row[3],
            notas=row[4],
            rango_min_smlv=row[5],
            rango_max_smlv=row[6],
            created_at=row[7]
        )

    _COLUMNS = "id, anio, indicador, valor_porcentaje, notas, rango_min_smlv, rango_max_smlv, created_at"

    def guardar(self, indicador: IndicadorEconomico) -> IndicadorEconomico:
        cursor = self.conn.cursor()
        try:
            if indicador.id:
                cursor.execute(
                    f"""UPDATE indicadores_economicos
                       SET anio = %s, indicador = %s,
                           valor_porcentaje = %s, notas = %s,
                           rango_min_smlv = %s, rango_max_smlv = %s
                       WHERE id = %s
                       RETURNING {self._COLUMNS}""",
                    (indicador.anio, indicador.indicador,
                     indicador.valor_porcentaje, indicador.notas,
                     indicador.rango_min_smlv, indicador.rango_max_smlv,
                     indicador.id)
                )
            else:
                cursor.execute(
                    f"""INSERT INTO indicadores_economicos
                       (anio, indicador, valor_porcentaje, notas, rango_min_smlv, rango_max_smlv)
                       VALUES (%s, %s, %s, %s, %s, %s)
                       RETURNING {self._COLUMNS}""",
                    (indicador.anio, indicador.indicador,
                     indicador.valor_porcentaje, indicador.notas,
                     indicador.rango_min_smlv, indicador.rango_max_smlv)
                )
            row = cursor.fetchone()
            self.conn.commit()
            return self._row_to_entity(row)
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def obtener_por_anio(self, anio: int) -> List[IndicadorEconomico]:
        cursor = self.conn.cursor()
        cursor.execute(
            f"SELECT {self._COLUMNS} FROM indicadores_economicos WHERE anio = %s ORDER BY indicador",
            (anio,)
        )
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_entity(r) for r in rows]

    def obtener_por_anio_e_indicador(self, anio: int, indicador: str) -> Optional[IndicadorEconomico]:
        cursor = self.conn.cursor()
        cursor.execute(
            f"SELECT {self._COLUMNS} FROM indicadores_economicos WHERE anio = %s AND indicador = %s",
            (anio, indicador)
        )
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def obtener_todos(self) -> List[IndicadorEconomico]:
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT {self._COLUMNS} FROM indicadores_economicos ORDER BY anio DESC, indicador")
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_entity(r) for r in rows]

    def obtener_por_id(self, id: int) -> Optional[IndicadorEconomico]:
        cursor = self.conn.cursor()
        cursor.execute(f"SELECT {self._COLUMNS} FROM indicadores_economicos WHERE id = %s", (id,))
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def eliminar(self, id: int) -> None:
        cursor = self.conn.cursor()
        try:
            cursor.execute("DELETE FROM indicadores_economicos WHERE id = %s", (id,))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()
