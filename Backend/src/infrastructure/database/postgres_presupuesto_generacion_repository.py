from typing import List, Optional
from decimal import Decimal
from src.domain.models.presupuesto_detalle import PresupuestoDetalle
from src.domain.ports.presupuesto_generacion_repository import PresupuestoGeneracionRepository


class PostgresPresupuestoGeneracionRepository(PresupuestoGeneracionRepository):
    def __init__(self, connection):
        self.conn = connection

    @staticmethod
    def _valor_filter(direccion: str) -> str:
        """Retorna el filtro SQL de valor según dirección."""
        return "md.Valor > 0" if direccion == 'ingreso' else "md.Valor < 0"

    def generar_base_desde_anio(
        self,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        direccion: str = 'egreso'
    ) -> List[PresupuestoDetalle]:
        cursor = self.conn.cursor()

        fecha_inicio = f"{anio_fuente}-01-01"
        fecha_fin = f"{anio_fuente}-12-31"
        valor_filter = self._valor_filter(direccion)

        query = f"""
            SELECT
                md.centro_costo_id,
                md.ConceptoID as concepto_id,
                md.TerceroID as tercero_id,
                EXTRACT(MONTH FROM m.Fecha)::INT as mes,
                SUM(ABS(md.Valor)) as monto,
                cc.centro_costo as centro_costo_nombre,
                con.concepto as concepto_nombre,
                t.tercero as tercero_nombre
            FROM movimientos_encabezado m
            JOIN movimientos_detalle md ON m.Id = md.movimiento_id
            LEFT JOIN centro_costos cc ON md.centro_costo_id = cc.centro_costo_id
            LEFT JOIN conceptos con ON md.ConceptoID = con.conceptoid
            LEFT JOIN terceros t ON md.TerceroID = t.terceroid
            WHERE m.Fecha >= %s AND m.Fecha <= %s
              AND md.centro_costo_id IS NOT NULL
              AND {valor_filter}
        """
        params = [fecha_inicio, fecha_fin]

        if centros_costos_excluidos:
            placeholders = ','.join(['%s'] * len(centros_costos_excluidos))
            query += f" AND md.centro_costo_id NOT IN ({placeholders})"
            params.extend(centros_costos_excluidos)

        query += """
            GROUP BY md.centro_costo_id, md.ConceptoID, md.TerceroID,
                     EXTRACT(MONTH FROM m.Fecha),
                     cc.centro_costo, con.concepto, t.tercero
            ORDER BY md.centro_costo_id, md.ConceptoID, mes
        """

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()

        detalles = []
        for row in rows:
            detalle = PresupuestoDetalle(
                presupuesto_id=0,  # Se asigna después en el application service
                centro_costo_id=row[0],
                concepto_id=row[1],
                tercero_id=row[2],
                mes=row[3],
                monto_presupuestado=Decimal(str(row[4])).quantize(Decimal('0.01')),
                tipo='variable',
                direccion=direccion,
                centro_costo_nombre=row[5],
                concepto_nombre=row[6],
                tercero_nombre=row[7],
            )
            detalles.append(detalle)

        return detalles

    def obtener_combinaciones_gasto(
        self,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None,
        direccion: str = 'egreso'
    ) -> List[dict]:
        cursor = self.conn.cursor()
        fecha_inicio = f"{anio_fuente}-01-01"
        fecha_fin = f"{anio_fuente}-12-31"
        valor_filter = self._valor_filter(direccion)

        # 1. Combinaciones CC/Concepto con movimientos en el año fuente
        query = f"""
            SELECT
                md.centro_costo_id,
                md.ConceptoID as concepto_id,
                cc.centro_costo as centro_costo_nombre,
                con.concepto as concepto_nombre,
                COUNT(DISTINCT EXTRACT(MONTH FROM m.Fecha)::INT) as meses_activos,
                SUM(ABS(md.Valor)) as monto_total
            FROM movimientos_encabezado m
            JOIN movimientos_detalle md ON m.Id = md.movimiento_id
            LEFT JOIN centro_costos cc ON md.centro_costo_id = cc.centro_costo_id
            LEFT JOIN conceptos con ON md.ConceptoID = con.conceptoid
            WHERE m.Fecha >= %s AND m.Fecha <= %s
              AND md.centro_costo_id IS NOT NULL
              AND {valor_filter}
        """
        params: list = [fecha_inicio, fecha_fin]

        if centros_costos_excluidos:
            placeholders = ','.join(['%s'] * len(centros_costos_excluidos))
            query += f" AND md.centro_costo_id NOT IN ({placeholders})"
            params.extend(centros_costos_excluidos)

        query += """
            GROUP BY md.centro_costo_id, md.ConceptoID,
                     cc.centro_costo, con.concepto
        """

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()

        combos = [
            {
                "centro_costo_id": row[0],
                "concepto_id": row[1],
                "centro_costo_nombre": row[2],
                "concepto_nombre": row[3],
                "meses_activos": row[4],
                "monto_total": float(Decimal(str(row[5])).quantize(Decimal('0.01')))
            }
            for row in rows
        ]

        # 2. Reglas CC+Concepto sin movimientos en el año fuente (huérfanas)
        existing_pairs = {(c["centro_costo_id"], c["concepto_id"]) for c in combos}

        orphan_query = """
            SELECT
                rp.centro_costo_id,
                rp.concepto_id,
                cc.centro_costo as centro_costo_nombre,
                con.concepto as concepto_nombre
            FROM reglas_presupuesto rp
            JOIN centro_costos cc ON rp.centro_costo_id = cc.centro_costo_id
            JOIN conceptos con ON rp.concepto_id = con.conceptoid
            WHERE rp.centro_costo_id IS NOT NULL
              AND rp.concepto_id IS NOT NULL
              AND rp.direccion = %s
        """
        orphan_params: list = [direccion]

        if centros_costos_excluidos:
            placeholders = ','.join(['%s'] * len(centros_costos_excluidos))
            orphan_query += f" AND rp.centro_costo_id NOT IN ({placeholders})"
            orphan_params.extend(centros_costos_excluidos)

        cursor.execute(orphan_query, tuple(orphan_params))
        orphan_rows = cursor.fetchall()
        cursor.close()

        for row in orphan_rows:
            if (row[0], row[1]) not in existing_pairs:
                combos.append({
                    "centro_costo_id": row[0],
                    "concepto_id": row[1],
                    "centro_costo_nombre": row[2],
                    "concepto_nombre": row[3],
                    "meses_activos": 0,
                    "monto_total": 0.0
                })

        combos.sort(key=lambda c: (c["centro_costo_nombre"], c["concepto_nombre"]))
        return combos

    def obtener_desglose_mensual(
        self,
        anio_fuente: int,
        centro_costo_id: int,
        concepto_id: Optional[int] = None,
        direccion: str = 'egreso'
    ) -> List[dict]:
        cursor = self.conn.cursor()
        fecha_inicio = f"{anio_fuente}-01-01"
        fecha_fin = f"{anio_fuente}-12-31"
        valor_filter = self._valor_filter(direccion)

        query = f"""
            SELECT
                EXTRACT(MONTH FROM m.Fecha)::INT as mes,
                SUM(ABS(md.Valor)) as monto,
                COUNT(DISTINCT m.Id) as registros
            FROM movimientos_encabezado m
            JOIN movimientos_detalle md ON m.Id = md.movimiento_id
            WHERE m.Fecha >= %s AND m.Fecha <= %s
              AND md.centro_costo_id = %s
              AND {valor_filter}
        """
        params: list = [fecha_inicio, fecha_fin, centro_costo_id]

        if concepto_id is not None:
            query += " AND md.ConceptoID = %s"
            params.append(concepto_id)
        else:
            query += " AND md.ConceptoID IS NULL"

        query += """
            GROUP BY EXTRACT(MONTH FROM m.Fecha)
            ORDER BY mes
        """

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()

        return [
            {"mes": row[0], "monto": float(Decimal(str(row[1])).quantize(Decimal('0.01'))), "registros": row[2]}
            for row in rows
        ]
