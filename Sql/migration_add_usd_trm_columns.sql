-- Migración: Agregar columnas USD y TRM a movimientos_extracto
-- Fecha: 2026-02-05
-- Propósito: Soportar cuentas en dólares (MasterCard USD, etc.)

-- Agregar columnas para valores en USD y TRM
ALTER TABLE movimientos_extracto
ADD COLUMN IF NOT EXISTS usd NUMERIC(16, 2),
ADD COLUMN IF NOT EXISTS trm NUMERIC(16, 6);

-- Comentarios para documentación
COMMENT ON COLUMN movimientos_extracto.usd IS 'Valor en dólares para cuentas USD (MasterCard USD, etc.)';
COMMENT ON COLUMN movimientos_extracto.trm IS 'Tasa Representativa del Mercado al momento del movimiento';

-- Crear índice para búsquedas por USD
CREATE INDEX IF NOT EXISTS idx_mov_extracto_usd
    ON movimientos_extracto(usd)
    WHERE usd IS NOT NULL;

-- Verificación
SELECT
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'movimientos_extracto'
    AND column_name IN ('valor', 'usd', 'trm')
ORDER BY ordinal_position;