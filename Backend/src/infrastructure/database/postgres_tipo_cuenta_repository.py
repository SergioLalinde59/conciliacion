from typing import List, Optional
from decimal import Decimal
from src.domain.models.tipo_cuenta import TipoCuenta
from src.domain.ports.tipo_cuenta_repository import TipoCuentaRepository


class PostgresTipoCuentaRepository(TipoCuentaRepository):
    """Implementación PostgreSQL del repositorio de tipos de cuenta."""

    def __init__(self, connection):
        self.conn = connection

    def _row_to_tipo_cuenta(self, row) -> TipoCuenta:
        """Convierte una fila de la BD a un objeto TipoCuenta."""
        return TipoCuenta(
            id=row[0],
            nombre=row[1],
            descripcion=row[2],
            peso_referencia=row[3],
            peso_descripcion=row[4],
            peso_valor=row[5],
            longitud_min_referencia=row[6],
            permite_crear_manual=row[7],
            permite_editar=row[8],
            permite_modificar=row[9],
            permite_borrar=row[10],
            permite_clasificar=row[11],
            requiere_descripcion=row[12],
            valor_minimo=Decimal(str(row[13])) if row[13] is not None else None,
            responde_enter=row[14],
            referencia_define_tercero=row[15],
            activo=row[16],
            created_at=row[17]
        )

    def _get_select_fields(self) -> str:
        """Campos SELECT comunes para todas las consultas."""
        return """
            id, nombre, descripcion,
            peso_referencia, peso_descripcion, peso_valor, longitud_min_referencia,
            permite_crear_manual, permite_editar, permite_modificar, permite_borrar, permite_clasificar,
            requiere_descripcion, valor_minimo, responde_enter, referencia_define_tercero,
            activo, created_at
        """

    def obtener_por_id(self, tipo_cuenta_id: int) -> Optional[TipoCuenta]:
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT {self._get_select_fields()}
            FROM tipo_cuenta
            WHERE id = %s AND activo = TRUE
        """, (tipo_cuenta_id,))
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_tipo_cuenta(row) if row else None

    def obtener_todos(self) -> List[TipoCuenta]:
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT {self._get_select_fields()}
            FROM tipo_cuenta
            WHERE activo = TRUE
            ORDER BY nombre
        """)
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_tipo_cuenta(row) for row in rows]

    def guardar(self, tipo_cuenta: TipoCuenta) -> TipoCuenta:
        cursor = self.conn.cursor()
        try:
            if tipo_cuenta.id:
                # UPDATE
                cursor.execute("""
                    UPDATE tipo_cuenta
                    SET nombre = %s, descripcion = %s,
                        peso_referencia = %s, peso_descripcion = %s, peso_valor = %s,
                        longitud_min_referencia = %s,
                        permite_crear_manual = %s, permite_editar = %s,
                        permite_modificar = %s, permite_borrar = %s, permite_clasificar = %s,
                        requiere_descripcion = %s, valor_minimo = %s, responde_enter = %s,
                        referencia_define_tercero = %s, activo = %s
                    WHERE id = %s
                """, (
                    tipo_cuenta.nombre, tipo_cuenta.descripcion,
                    tipo_cuenta.peso_referencia, tipo_cuenta.peso_descripcion, tipo_cuenta.peso_valor,
                    tipo_cuenta.longitud_min_referencia,
                    tipo_cuenta.permite_crear_manual, tipo_cuenta.permite_editar,
                    tipo_cuenta.permite_modificar, tipo_cuenta.permite_borrar, tipo_cuenta.permite_clasificar,
                    tipo_cuenta.requiere_descripcion, tipo_cuenta.valor_minimo, tipo_cuenta.responde_enter,
                    tipo_cuenta.referencia_define_tercero, tipo_cuenta.activo,
                    tipo_cuenta.id
                ))
            else:
                # INSERT
                cursor.execute("""
                    INSERT INTO tipo_cuenta
                    (nombre, descripcion, peso_referencia, peso_descripcion, peso_valor,
                     longitud_min_referencia, permite_crear_manual, permite_editar,
                     permite_modificar, permite_borrar, permite_clasificar,
                     requiere_descripcion, valor_minimo, responde_enter, referencia_define_tercero, activo)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    tipo_cuenta.nombre, tipo_cuenta.descripcion,
                    tipo_cuenta.peso_referencia, tipo_cuenta.peso_descripcion, tipo_cuenta.peso_valor,
                    tipo_cuenta.longitud_min_referencia,
                    tipo_cuenta.permite_crear_manual, tipo_cuenta.permite_editar,
                    tipo_cuenta.permite_modificar, tipo_cuenta.permite_borrar, tipo_cuenta.permite_clasificar,
                    tipo_cuenta.requiere_descripcion, tipo_cuenta.valor_minimo, tipo_cuenta.responde_enter,
                    tipo_cuenta.referencia_define_tercero, tipo_cuenta.activo
                ))
                tipo_cuenta.id = cursor.fetchone()[0]

            self.conn.commit()
            return tipo_cuenta
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()