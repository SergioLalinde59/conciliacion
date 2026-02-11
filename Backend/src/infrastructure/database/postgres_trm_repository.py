from typing import Optional
from datetime import date
from src.domain.models.trm import Trm
from src.domain.ports.trm_repository import TrmRepository


class PostgresTrmRepository(TrmRepository):
    def __init__(self, connection):
        self.conn = connection

    _COLUMNS = "id, fecha, valor, fuente, created_at"

    def _row_to_entity(self, row) -> Optional[Trm]:
        if not row:
            return None
        return Trm(
            id=row[0],
            fecha=row[1],
            valor=row[2],
            fuente=row[3],
            created_at=row[4]
        )

    def guardar(self, trm: Trm) -> Trm:
        """Upsert: inserta o actualiza si la fecha ya existe."""
        cursor = self.conn.cursor()
        try:
            cursor.execute(
                f"""INSERT INTO trm_cache (fecha, valor, fuente)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (fecha) DO UPDATE SET valor = EXCLUDED.valor, fuente = EXCLUDED.fuente
                    RETURNING {self._COLUMNS}""",
                (trm.fecha, trm.valor, trm.fuente)
            )
            row = cursor.fetchone()
            self.conn.commit()
            return self._row_to_entity(row)
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def obtener_por_fecha(self, fecha: date) -> Optional[Trm]:
        cursor = self.conn.cursor()
        cursor.execute(
            f"SELECT {self._COLUMNS} FROM trm_cache WHERE fecha = %s",
            (fecha,)
        )
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)

    def obtener_mas_cercana(self, fecha: date) -> Optional[Trm]:
        """Busca la TRM más cercana anterior o igual a la fecha."""
        cursor = self.conn.cursor()
        cursor.execute(
            f"SELECT {self._COLUMNS} FROM trm_cache WHERE fecha <= %s ORDER BY fecha DESC LIMIT 1",
            (fecha,)
        )
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_entity(row)
