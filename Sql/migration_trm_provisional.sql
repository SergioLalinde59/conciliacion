-- Migration: Add trm_provisional column to movimientos_encabezado
-- Date: 2026-02-12
-- Purpose: Track whether TRM is provisional (Banco de la República) or definitive (TC payment)

ALTER TABLE movimientos_encabezado
ADD COLUMN IF NOT EXISTS trm_provisional BOOLEAN DEFAULT true;

-- Comment
COMMENT ON COLUMN movimientos_encabezado.trm_provisional IS
'true = TRM provisional (Banco de la República del día de la transacción), false = TRM definitiva (del pago de la TC)';
