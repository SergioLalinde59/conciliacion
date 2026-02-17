"""
Script de migración de datos históricos USD (una sola vez).
Busca movimientos con usd != 0 AND (trm = 0 OR valor = 0),
consulta la TRM del Banco de la República por fecha,
y actualiza trm, valor y trm_provisional.

Uso: docker exec -it mvtos_backend python -m scripts.migrar_trm_historicos
  O: python scripts/migrar_trm_historicos.py
"""
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import psycopg2
from decimal import Decimal
from datetime import date
from collections import defaultdict
from src.infrastructure.external.datos_gov_trm_provider import DatosGovTrmProvider

# Configuración BD
DB_HOST = os.environ.get('DB_HOST', 'host.docker.internal')
DB_PORT = int(os.environ.get('DB_PORT', 5433))
DB_NAME = os.environ.get('DB_NAME', 'Mvtos')
DB_USER = os.environ.get('DB_USER', 'postgres')
DB_PASSWORD = os.environ.get('DB_PASSWORD', os.environ.get('PGPASSWORD', 'SLB'))


def main():
    conn = psycopg2.connect(
        host=DB_HOST, port=DB_PORT, dbname=DB_NAME,
        user=DB_USER, password=DB_PASSWORD
    )
    cursor = conn.cursor()

    # 1. Buscar movimientos USD sin TRM
    cursor.execute("""
        SELECT Id, Fecha, USD, TRM, Valor
        FROM movimientos_encabezado
        WHERE COALESCE(USD, 0) != 0
          AND (COALESCE(TRM, 0) = 0 OR COALESCE(Valor, 0) = 0)
        ORDER BY Fecha
    """)
    rows = cursor.fetchall()
    print(f"Encontrados {len(rows)} movimientos USD sin TRM/Valor")

    if not rows:
        print("Nada que migrar.")
        cursor.close()
        conn.close()
        return

    # 2. Obtener fechas únicas
    fechas_unicas = sorted(set(row[1] for row in rows))
    print(f"Fechas únicas a consultar: {len(fechas_unicas)}")

    # 3. Consultar TRM por fecha
    provider = DatosGovTrmProvider()
    trm_cache: dict[date, Decimal] = {}

    for i, fecha in enumerate(fechas_unicas):
        if fecha in trm_cache:
            continue
        trm_valor = provider.obtener_trm(fecha)
        if trm_valor:
            trm_cache[fecha] = trm_valor
            print(f"  [{i+1}/{len(fechas_unicas)}] {fecha} -> TRM: {trm_valor}")
        else:
            print(f"  [{i+1}/{len(fechas_unicas)}] {fecha} -> TRM NO ENCONTRADA")

    # 4. Actualizar movimientos
    actualizados = 0
    sin_trm = 0

    for row in rows:
        mov_id, fecha, usd, trm_actual, valor_actual = row
        trm_valor = trm_cache.get(fecha)

        if not trm_valor:
            sin_trm += 1
            continue

        valor_cop = usd * trm_valor

        cursor.execute("""
            UPDATE movimientos_encabezado
            SET TRM = %s, Valor = %s, trm_provisional = true
            WHERE Id = %s
        """, (trm_valor, valor_cop, mov_id))

        # Actualizar detalle (si tiene un solo detalle con valor 0)
        cursor.execute("""
            UPDATE movimientos_detalle
            SET Valor = %s
            WHERE movimiento_id = %s
              AND (SELECT COUNT(*) FROM movimientos_detalle WHERE movimiento_id = %s) = 1
        """, (valor_cop, mov_id, mov_id))

        actualizados += 1

    conn.commit()
    cursor.close()
    conn.close()

    print(f"\nResultado:")
    print(f"  Actualizados: {actualizados}")
    print(f"  Sin TRM disponible: {sin_trm}")
    print(f"  Total procesados: {len(rows)}")


if __name__ == '__main__':
    main()
