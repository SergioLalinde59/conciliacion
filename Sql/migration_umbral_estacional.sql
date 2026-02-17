-- Migración: Agregar umbral_estacional a presupuestos
-- Fecha: 2026-02-14
-- Propósito: Hacer configurable el umbral de meses para clasificar gastos como estacionales
--            (antes hardcodeado a 4 en presupuesto_generacion_service.py)

ALTER TABLE presupuestos
    ADD COLUMN IF NOT EXISTS umbral_estacional INTEGER NOT NULL DEFAULT 4;

COMMENT ON COLUMN presupuestos.umbral_estacional IS 'Meses máximos para clasificar un gasto como estacional (keywords + ≤umbral). Default 4.';

-- Verificar
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'presupuestos' AND column_name = 'umbral_estacional';