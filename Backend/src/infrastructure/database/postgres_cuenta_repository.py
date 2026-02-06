from typing import List, Optional
from decimal import Decimal
from src.domain.models.cuenta import Cuenta
from src.domain.ports.cuenta_repository import CuentaRepository


class PostgresCuentaRepository(CuentaRepository):
    def __init__(self, connection):
        self.conn = connection

    def _get_select_con_tipo(self) -> str:
        """Campos SELECT para consultas con JOIN a tipo_cuenta."""
        return """
            c.cuentaid, c.cuenta, c.activa, c.permite_carga, c.permite_conciliar,
            c.tipo_cuenta_id,
            tc.nombre as tipo_cuenta_nombre,
            COALESCE(tc.peso_referencia, 100) as peso_referencia,
            COALESCE(tc.peso_descripcion, 50) as peso_descripcion,
            COALESCE(tc.peso_valor, 30) as peso_valor,
            COALESCE(tc.longitud_min_referencia, 8) as longitud_min_referencia,
            COALESCE(tc.permite_crear_manual, FALSE) as permite_crear_manual,
            COALESCE(tc.permite_editar, FALSE) as permite_editar,
            COALESCE(tc.permite_modificar, FALSE) as permite_modificar,
            COALESCE(tc.permite_borrar, FALSE) as permite_borrar,
            COALESCE(tc.permite_clasificar, TRUE) as permite_clasificar,
            COALESCE(tc.requiere_descripcion, FALSE) as requiere_descripcion,
            tc.valor_minimo,
            COALESCE(tc.responde_enter, FALSE) as responde_enter,
            COALESCE(tc.referencia_define_tercero, FALSE) as referencia_define_tercero
        """

    def _row_to_cuenta_con_tipo(self, row) -> Cuenta:
        """Convierte una fila con JOIN a objeto Cuenta."""
        return Cuenta(
            cuentaid=row[0],
            cuenta=row[1],
            activa=row[2],
            permite_carga=row[3],
            permite_conciliar=row[4],
            tipo_cuenta_id=row[5],
            tipo_cuenta_nombre=row[6],
            peso_referencia=row[7],
            peso_descripcion=row[8],
            peso_valor=row[9],
            longitud_min_referencia=row[10],
            permite_crear_manual=row[11],
            permite_editar=row[12],
            permite_modificar=row[13],
            permite_borrar=row[14],
            permite_clasificar=row[15],
            requiere_descripcion=row[16],
            valor_minimo=Decimal(str(row[17])) if row[17] is not None else None,
            responde_enter=row[18],
            referencia_define_tercero=row[19]
        )

    def guardar(self, cuenta: Cuenta) -> Cuenta:
        cursor = self.conn.cursor()
        try:
            if cuenta.cuentaid:
                cursor.execute(
                    """UPDATE cuentas
                       SET cuenta = %s, activa = %s, permite_carga = %s,
                           permite_conciliar = %s, tipo_cuenta_id = %s
                       WHERE cuentaid = %s""",
                    (cuenta.cuenta, cuenta.activa, cuenta.permite_carga,
                     cuenta.permite_conciliar, cuenta.tipo_cuenta_id, cuenta.cuentaid)
                )
            else:
                cursor.execute(
                    """INSERT INTO cuentas (cuenta, activa, permite_carga, permite_conciliar, tipo_cuenta_id)
                       VALUES (%s, %s, %s, %s, %s) RETURNING cuentaid""",
                    (cuenta.cuenta, cuenta.activa, cuenta.permite_carga,
                     cuenta.permite_conciliar, cuenta.tipo_cuenta_id)
                )
                cuenta.cuentaid = cursor.fetchone()[0]
            self.conn.commit()
            return cuenta
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()

    def obtener_por_id(self, cuentaid: int) -> Optional[Cuenta]:
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT {self._get_select_con_tipo()}
            FROM cuentas c
            LEFT JOIN tipo_cuenta tc ON c.tipo_cuenta_id = tc.id
            WHERE c.cuentaid = %s AND c.activa = TRUE
        """, (cuentaid,))
        row = cursor.fetchone()
        cursor.close()
        if not row:
            return None
        return self._row_to_cuenta_con_tipo(row)

    def obtener_todos(self) -> List[Cuenta]:
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT {self._get_select_con_tipo()}
            FROM cuentas c
            LEFT JOIN tipo_cuenta tc ON c.tipo_cuenta_id = tc.id
            WHERE c.activa = TRUE
            ORDER BY c.cuenta
        """)
        rows = cursor.fetchall()
        cursor.close()
        return [self._row_to_cuenta_con_tipo(r) for r in rows]

    def obtener_todas_con_tipo(self) -> List[Cuenta]:
        """Alias para obtener_todos (retrocompatibilidad)."""
        return self.obtener_todos()

    def buscar_por_nombre(self, nombre: str) -> Optional[Cuenta]:
        cursor = self.conn.cursor()
        cursor.execute(f"""
            SELECT {self._get_select_con_tipo()}
            FROM cuentas c
            LEFT JOIN tipo_cuenta tc ON c.tipo_cuenta_id = tc.id
            WHERE LOWER(c.cuenta) = LOWER(%s) AND c.activa = TRUE
        """, (nombre,))
        row = cursor.fetchone()
        cursor.close()
        return self._row_to_cuenta_con_tipo(row) if row else None

    def eliminar(self, cuentaid: int):
        cursor = self.conn.cursor()
        try:
            # Soft delete
            cursor.execute("UPDATE cuentas SET activa = FALSE WHERE cuentaid = %s", (cuentaid,))
            self.conn.commit()
        except Exception as e:
            self.conn.rollback()
            raise e
        finally:
            cursor.close()
