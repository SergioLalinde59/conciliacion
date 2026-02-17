-- Migración: Agregar cifras_en_millones a presupuestos
-- Fecha: 2026-02-16
-- Propósito: Permitir configurar si las cifras se muestran en millones ($X.XM) o en pesos completos ($X.XXX.XXX)

ALTER TABLE presupuestos
    ADD COLUMN IF NOT EXISTS cifras_en_millones BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN presupuestos.cifras_en_millones IS 'Si true, muestra cifras en formato compacto (millones/miles). Si false, muestra pesos completos.';

-- Verificar
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns
WHERE table_name = 'presupuestos' AND column_name = 'cifras_en_millones';
