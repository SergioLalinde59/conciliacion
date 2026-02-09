-- Migración: Agregar campo numero_cuenta a tabla cuentas
-- Fecha: 2026-02-09
-- Descripción: Número de cuenta bancaria (solo dígitos, entre 9 y 15 caracteres)

ALTER TABLE cuentas
ADD COLUMN IF NOT EXISTS numero_cuenta VARCHAR(16);

-- Constraint: solo dígitos, entre 9 y 16 caracteres (permite NULL)
ALTER TABLE cuentas
ADD CONSTRAINT chk_numero_cuenta_formato
CHECK (numero_cuenta IS NULL OR numero_cuenta ~ '^\d{9,16}$');

-- Ejecutar con:
-- psql -h localhost -p 5433 -U postgres -d Mvtos -f Sql/migration_numero_cuenta.sql
