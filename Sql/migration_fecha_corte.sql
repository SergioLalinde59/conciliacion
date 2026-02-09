-- Migración: Agregar columna fecha_corte a movimientos_encabezado
-- Fecha de corte de la tarjeta de crédito (NULL para cuentas que no aplica)
-- Ejecutar: psql -h localhost -p 5433 -U postgres -d Mvtos -f Sql/migration_fecha_corte.sql

ALTER TABLE movimientos_encabezado
ADD COLUMN IF NOT EXISTS fecha_corte DATE NULL;

COMMENT ON COLUMN movimientos_encabezado.fecha_corte IS 'Fecha de corte del ciclo de facturación (tarjetas de crédito)';
