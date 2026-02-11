-- =====================================================
-- MIGRACION: Umbrales de materialidad en presupuestos
-- Fecha: 2026-02-10
-- Proposito: Filtrar gastos menores que no ameritan
--            seguimiento presupuestal (ruido visual)
-- =====================================================

ALTER TABLE presupuestos
    ADD COLUMN IF NOT EXISTS umbral_minimo_mensual NUMERIC(16,2) NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS umbral_minimo_anual NUMERIC(16,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN presupuestos.umbral_minimo_mensual IS 'Monto minimo mensual para seguimiento. Gastos con promedio mensual menor se consideran no-materiales. 0 = sin filtro.';
COMMENT ON COLUMN presupuestos.umbral_minimo_anual IS 'Monto minimo anual para seguimiento. Gastos con total anualizado menor se consideran no-materiales. 0 = sin filtro.';

-- Verificacion
SELECT id, nombre, umbral_minimo_mensual, umbral_minimo_anual FROM presupuestos;
