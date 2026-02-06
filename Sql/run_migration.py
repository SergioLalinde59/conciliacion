"""Script para ejecutar la migración de tipo_cuenta."""
import psycopg2
from dotenv import load_dotenv
import os

# Cargar variables de entorno desde .env en la raíz del proyecto
load_dotenv(dotenv_path='../.env')

def run_migration():
    password = os.getenv('DB_PASSWORD')
    if not password:
        print("ERROR: No se encontró DB_PASSWORD en .env (raíz del proyecto)")
        return False

    try:
        conn = psycopg2.connect(
            host='localhost',
            port=5433,
            database='Mvtos',
            user='postgres',
            password=password
        )
        conn.autocommit = False
        cursor = conn.cursor()

        # Leer y ejecutar el archivo SQL
        with open('migration_tipo_cuenta.sql', 'r', encoding='utf-8') as f:
            sql = f.read()

        print("Ejecutando migración...")
        cursor.execute(sql)
        conn.commit()

        # Mostrar resultados
        print("\n--- Tipos de cuenta creados ---")
        cursor.execute("""
            SELECT id, nombre, permite_crear_manual, permite_editar, permite_modificar, permite_borrar, referencia_define_tercero
            FROM tipo_cuenta WHERE activo = TRUE ORDER BY id
        """)
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} | crear={row[2]}, editar={row[3]}, modificar={row[4]}, borrar={row[5]}, ref_tercero={row[6]}")

        print("\n--- Cuentas actualizadas ---")
        cursor.execute("""
            SELECT c.cuentaid, c.cuenta, tc.nombre as tipo
            FROM cuentas c
            LEFT JOIN tipo_cuenta tc ON c.tipo_cuenta_id = tc.id
            WHERE c.activa = TRUE ORDER BY c.cuentaid
        """)
        for row in cursor.fetchall():
            print(f"  {row[0]}: {row[1]} -> {row[2]}")

        cursor.close()
        conn.close()
        print("\nMigración ejecutada correctamente!")
        return True

    except Exception as e:
        print(f"ERROR: {e}")
        return False

if __name__ == '__main__':
    run_migration()
