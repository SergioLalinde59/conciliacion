from typing import List, Optional
from src.domain.models.perspectiva import Perspectiva
from src.domain.ports.perspectiva_repository import PerspectivaRepository


class PostgresPerspectivaRepository(PerspectivaRepository):
    def __init__(self, connection):
        self.conn = connection

    def _row_to_perspectiva(self, row) -> Perspectiva:
        return Perspectiva(
            id=row[0],
            nombre=row[1],
            slug=row[2],
            tipo=row[3],
            centro_costo_ids=row[4] or [],
            siempre_excluir_ids=row[5] or [],
            es_defecto=row[6],
            orden=row[7],
            activa=row[8]
        )

    def obtener_todas(self) -> List[Perspectiva]:
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT id, nombre, slug, tipo, centro_costo_ids, siempre_excluir_ids, es_defecto, orden, activa "
            "FROM perspectivas WHERE activa = TRUE ORDER BY orden"
        )
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_perspectiva(r) for r in rows]

    def obtener_por_id(self, id: int) -> Optional[Perspectiva]:
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT id, nombre, slug, tipo, centro_costo_ids, siempre_excluir_ids, es_defecto, orden, activa "
            "FROM perspectivas WHERE id = %s",
            (id,)
        )
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_perspectiva(row) if row else None

    def obtener_por_slug(self, slug: str) -> Optional[Perspectiva]:
        cursor = self.conn.cursor()
        cursor.execute(
            "SELECT id, nombre, slug, tipo, centro_costo_ids, siempre_excluir_ids, es_defecto, orden, activa "
            "FROM perspectivas WHERE slug = %s AND activa = TRUE",
            (slug,)
        )
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_perspectiva(row) if row else None

    def guardar(self, perspectiva: Perspectiva) -> Perspectiva:
        cursor = self.conn.cursor()
        try:
            if perspectiva.id:
                cursor.execute(
                    "UPDATE perspectivas SET nombre=%s, slug=%s, tipo=%s, centro_costo_ids=%s, "
                    "siempre_excluir_ids=%s, es_defecto=%s, orden=%s, activa=%s WHERE id=%s",
                    (perspectiva.nombre, perspectiva.slug, perspectiva.tipo,
                     perspectiva.centro_costo_ids, perspectiva.siempre_excluir_ids,
                     perspectiva.es_defecto, perspectiva.orden, perspectiva.activa,
                     perspectiva.id)
                )
            else:
                cursor.execute(
                    "INSERT INTO perspectivas (nombre, slug, tipo, centro_costo_ids, siempre_excluir_ids, es_defecto, orden, activa) "
                    "VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id",
                    (perspectiva.nombre, perspectiva.slug, perspectiva.tipo,
                     perspectiva.centro_costo_ids, perspectiva.siempre_excluir_ids,
                     perspectiva.es_defecto, perspectiva.orden, perspectiva.activa)
                )
                perspectiva.id = cursor.fetchone()[0]
            self.conn.commit()
            return perspectiva
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def eliminar(self, id: int) -> None:
        cursor = self.conn.cursor()
        try:
            cursor.execute("UPDATE perspectivas SET activa = FALSE WHERE id = %s", (id,))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()
