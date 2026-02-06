-- =====================================================
-- MIGRACIÓN: Agregar saldo_acumulado a movimientos_extracto
-- Fecha: 2026-02-05
-- Propósito: Implementar Running Balance para estados de cuenta
-- =====================================================

-- 1. Agregar columna saldo_acumulado
ALTER TABLE movimientos_extracto
ADD COLUMN IF NOT EXISTS saldo_acumulado NUMERIC(18,2);

-- 2. Comentario descriptivo
COMMENT ON COLUMN movimientos_extracto.saldo_acumulado
IS 'Saldo después de este movimiento. Calculado al cargar, inmutable.';

-- 3. Índice para consultas de estado de cuenta
CREATE INDEX IF NOT EXISTS idx_mov_extracto_saldo_acumulado
ON movimientos_extracto(cuenta_id, fecha, numero_linea)
WHERE saldo_acumulado IS NOT NULL;

-- 4. Verificar cambio
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'movimientos_extracto'
AND column_name = 'saldo_acumulado';