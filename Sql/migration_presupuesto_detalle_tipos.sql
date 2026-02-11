-- =====================================================
-- MIGRACION: Actualizar presupuesto_detalle y presupuestos
-- Fecha: 2026-02-10
-- Propósito:
--   1. Quitar CHECK hardcodeado de tipo en presupuesto_detalle
--   2. Agregar FK a tipos_gasto
--   3. Agregar campo monto_base para auditoría
--   4. Agregar umbral_no_repetitivo en presupuestos
--   5. Actualizar defaults de semáforo a 10%/25%
-- Requiere: tipos_gasto (FK)
-- =====================================================

-- 1. Quitar CHECK constraint hardcodeado de presupuesto_detalle.tipo
ALTER TABLE presupuesto_detalle DROP CONSTRAINT IF EXISTS presupuesto_detalle_tipo_check;

-- 2. Agregar FK a tipos_gasto (validación dinámica en vez de CHECK)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'presupuesto_detalle_tipo_fk'
        AND table_name = 'presupuesto_detalle'
    ) THEN
        ALTER TABLE presupuesto_detalle
            ADD CONSTRAINT presupuesto_detalle_tipo_fk
            FOREIGN KEY (tipo) REFERENCES tipos_gasto(tipo);
    END IF;
END $$;

-- 3. Campo para preservar monto original del año fuente (auditoría)
ALTER TABLE presupuesto_detalle
    ADD COLUMN IF NOT EXISTS monto_base NUMERIC(16,2);

COMMENT ON COLUMN presupuesto_detalle.monto_base IS 'Monto original del año fuente antes de aplicar aumentos';

-- 4. Umbral de no repetitivos configurable por presupuesto
ALTER TABLE presupuestos
    ADD COLUMN IF NOT EXISTS umbral_no_repetitivo INTEGER NOT NULL DEFAULT 4;

COMMENT ON COLUMN presupuestos.umbral_no_repetitivo IS 'Meses mínimos para considerar un gasto como repetitivo. ≤umbral = no repetitivo.';

-- 5. Actualizar defaults de semáforo a 10% / 25%
ALTER TABLE presupuestos
    ALTER COLUMN semaforo_verde_hasta SET DEFAULT 10.0;
ALTER TABLE presupuestos
    ALTER COLUMN semaforo_amarillo_hasta SET DEFAULT 25.0;

-- Verificación
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'presupuesto_detalle' AND column_name IN ('tipo', 'monto_base')
ORDER BY ordinal_position;

SELECT column_name, column_default
FROM information_schema.columns
WHERE table_name = 'presupuestos' AND column_name IN ('umbral_no_repetitivo', 'semaforo_verde_hasta', 'semaforo_amarillo_hasta');
