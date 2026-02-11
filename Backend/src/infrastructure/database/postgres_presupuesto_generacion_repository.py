from typing import List, Optional
from decimal import Decimal
from src.domain.models.presupuesto_detalle import PresupuestoDetalle
from src.domain.ports.presupuesto_generacion_repository import PresupuestoGeneracionRepository


class PostgresPresupuestoGeneracionRepository(PresupuestoGeneracionRepository):
    def __init__(self, connection):
        self.conn = connection

    def generar_base_desde_anio(
        self,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None
    ) -> List[PresupuestoDetalle]:
        cursor = self.conn.cursor()

        fecha_inicio = f"{anio_fuente}-01-01"
        fecha_fin = f"{anio_fuente}-12-31"

        query = """
            SELECT
                md.centro_costo_id,
                md.ConceptoID as concepto_id,
                md.TerceroID as tercero_id,
                EXTRACT(MONTH FROM m.Fecha)::INT as mes,
                SUM(ABS(md.Valor)) as monto
            FROM movimientos_encabezado m
            JOIN movimientos_detalle md ON m.Id = md.movimiento_id
            WHERE m.Fecha >= %s AND m.Fecha <= %s
              AND md.centro_costo_id IS NOT NULL
              AND md.Valor < 0
        """
        params = [fecha_inicio, fecha_fin]

        if centros_costos_excluidos:
            placeholders = ','.join(['%s'] * len(centros_costos_excluidos))
            query += f" AND md.centro_costo_id NOT IN ({placeholders})"
            params.extend(centros_costos_excluidos)

        query += """
            GROUP BY md.centro_costo_id, md.ConceptoID, md.TerceroID,
                     EXTRACT(MONTH FROM m.Fecha)
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
                tipo='variable'
            )
            detalles.append(detalle)

        return detalles

    def obtener_combinaciones_gasto(
        self,
        anio_fuente: int,
        centros_costos_excluidos: Optional[List[int]] = None
    ) -> List[dict]:
        cursor = self.conn.cursor()
        fecha_inicio = f"{anio_fuente}-01-01"
        fecha_fin = f"{anio_fuente}-12-31"

        query = """
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
              AND md.Valor < 0
        """
        params: list = [fecha_inicio, fecha_fin]

        if centros_costos_excluidos:
            placeholders = ','.join(['%s'] * len(centros_costos_excluidos))
            query += f" AND md.centro_costo_id NOT IN ({placeholders})"
            params.extend(centros_costos_excluidos)

        query += """
            GROUP BY md.centro_costo_id, md.ConceptoID,
                     cc.centro_costo, con.concepto
            ORDER BY cc.centro_costo, con.concepto
        """

        cursor.execute(query, tuple(params))
        rows = cursor.fetchall()
        cursor.close()

        return [
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

    def obtener_desglose_mensual(
        self,
        anio_fuente: int,
        centro_costo_id: int,
        concepto_id: Optional[int] = None
    ) -> List[dict]:
        cursor = self.conn.cursor()
        fecha_inicio = f"{anio_fuente}-01-01"
        fecha_fin = f"{anio_fuente}-12-31"

        query = """
            SELECT
                EXTRACT(MONTH FROM m.Fecha)::INT as mes,
                SUM(ABS(md.Valor)) as monto,
                COUNT(DISTINCT m.Id) as registros
            FROM movimientos_encabezado m
            JOIN movimientos_detalle md ON m.Id = md.movimiento_id
            WHERE m.Fecha >= %s AND m.Fecha <= %s
              AND md.centro_costo_id = %s
              AND md.Valor < 0
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
