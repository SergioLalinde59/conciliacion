-- Migración: Campo umbral_pareto en presupuestos
-- Define el monto mínimo anual para que un CC aparezca en el gráfico TOP (Pareto)
-- Fecha: 2026-02-14

ALTER TABLE presupuestos
ADD COLUMN IF NOT EXISTS umbral_pareto NUMERIC(15,2) NOT NULL DEFAULT 5000000;

COMMENT ON COLUMN presupuestos.umbral_pareto IS 'Monto mínimo anual (COP) para que un CC aparezca en el gráfico Pareto de vista previa';
