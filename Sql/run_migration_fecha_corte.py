"""
Migración: Agregar columna fecha_corte a movimientos_encabezado
Ejecutar desde la raíz del proyecto: python Sql/run_migration_fecha_corte.py
"""
import sys
import os

# Cargar .env desde la raíz del proyecto
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

import psycopg2

def main():
    conn = psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=int(os.getenv('DB_PORT', '5433')),
        dbname=os.getenv('DB_NAME', 'Mvtos'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', '')
    )
    conn.autocommit = True
    cursor = conn.cursor()

    # Verificar si la columna ya existe
    cursor.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'movimientos_encabezado' AND column_name = 'fecha_corte'
    """)
    if cursor.fetchone():
        print('La columna fecha_corte ya existe. No se requiere migración.')
    else:
        cursor.execute('ALTER TABLE movimientos_encabezado ADD COLUMN fecha_corte DATE NULL')
        cursor.execute("COMMENT ON COLUMN movimientos_encabezado.fecha_corte IS 'Fecha de corte del ciclo de facturación (tarjetas de crédito)'")
        print('Columna fecha_corte agregada exitosamente a movimientos_encabezado.')

    cursor.close()
    conn.close()

if __name__ == '__main__':
    main()
