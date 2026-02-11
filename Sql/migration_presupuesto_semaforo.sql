-- =====================================================
-- MIGRACION: Configuración de semáforos en presupuestos
-- Fecha: 2026-02-10
-- Propósito: Hacer configurables los umbrales del semáforo
--            por presupuesto (eliminar valores hardcodeados)
-- =====================================================

-- Agregar columnas de configuración de semáforo
ALTER TABLE presupuestos
    ADD COLUMN IF NOT EXISTS semaforo_verde_hasta NUMERIC(5,2) NOT NULL DEFAULT 5.0,
    ADD COLUMN IF NOT EXISTS semaforo_amarillo_hasta NUMERIC(5,2) NOT NULL DEFAULT 15.0;

COMMENT ON COLUMN presupuestos.semaforo_verde_hasta IS 'Variación % máxima para semáforo verde (ej: 5.0 = ≤5%)';
COMMENT ON COLUMN presupuestos.semaforo_amarillo_hasta IS 'Variación % máxima para semáforo amarillo (ej: 15.0 = ≤15%). Rojo = todo lo superior.';

-- Verificación
SELECT id, nombre, semaforo_verde_hasta, semaforo_amarillo_hasta FROM presupuestos;
