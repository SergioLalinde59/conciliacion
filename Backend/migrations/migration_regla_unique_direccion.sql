-- Migration: Agregar direccion al unique constraint de reglas_presupuesto
-- Fecha: 2026-02-18
-- Permite tener reglas separadas para egreso e ingreso con el mismo CC+Concepto

DROP INDEX IF EXISTS uq_reglas_ppto_cc_concepto;
CREATE UNIQUE INDEX uq_reglas_ppto_cc_concepto ON reglas_presupuesto (COALESCE(centro_costo_id, 0), COALESCE(concepto_id, 0), direccion);
