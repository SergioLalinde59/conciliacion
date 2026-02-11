-- Migration: Monto Fijo Mensual para Gastos Fijos
-- Fecha: 2026-02-10
-- Descripcion: Permite que gastos fijos usen un monto mensual directo
--              en vez de indicador economico + formula

-- 1. tipos_gasto: indicador_default nullable, Fijo = NULL
ALTER TABLE tipos_gasto ALTER COLUMN indicador_default DROP DEFAULT;
UPDATE tipos_gasto SET indicador_default = NULL WHERE tipo = 'Fijo';

-- 2. reglas_presupuesto: nuevo campo monto_fijo_mensual
ALTER TABLE reglas_presupuesto ADD COLUMN IF NOT EXISTS monto_fijo_mensual NUMERIC(16,2);

-- 3. reglas_presupuesto: indicador_nombre nullable
ALTER TABLE reglas_presupuesto ALTER COLUMN indicador_nombre DROP NOT NULL;

-- 4. Constraint: al menos uno de los dos mecanismos debe existir (excepto No Repetitivo)
ALTER TABLE reglas_presupuesto ADD CONSTRAINT chk_regla_indicador_o_monto
    CHECK (tipo_gasto = 'No Repetitivo' OR indicador_nombre IS NOT NULL OR monto_fijo_mensual IS NOT NULL);

COMMENT ON COLUMN reglas_presupuesto.monto_fijo_mensual IS
    'Monto fijo mensual para gastos tipo Fijo. Si presente, se usa en vez de indicador + formula';
