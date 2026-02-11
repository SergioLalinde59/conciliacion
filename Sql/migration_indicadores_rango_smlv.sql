-- =====================================================
-- MIGRACION: Agregar columnas rango SMLV a indicadores_economicos
-- Fecha: 2026-02-10
-- Propósito: Permitir configurar rangos salariales (en múltiplos de SMLV)
--            para indicadores de tipo salarial
-- =====================================================

-- Paso 1: Agregar columnas
ALTER TABLE indicadores_economicos
    ADD COLUMN IF NOT EXISTS rango_min_smlv DECIMAL(5,2) NULL,
    ADD COLUMN IF NOT EXISTS rango_max_smlv DECIMAL(5,2) NULL;

-- Paso 2: Poblar datos existentes basándose en nombres actuales
UPDATE indicadores_economicos
SET rango_min_smlv = 0, rango_max_smlv = 1
WHERE indicador = 'Aumento Salario Mínimo';

UPDATE indicadores_economicos
SET rango_min_smlv = 2, rango_max_smlv = 4
WHERE indicador = 'Aumento salarios 2-4 SMLV';

UPDATE indicadores_economicos
SET rango_min_smlv = 4, rango_max_smlv = NULL
WHERE indicador = 'Aumento salarios >4 SMLV';

-- Paso 3: Comentarios
COMMENT ON COLUMN indicadores_economicos.rango_min_smlv IS 'Rango mínimo en múltiplos de SMLV (NULL = no aplica rango)';
COMMENT ON COLUMN indicadores_economicos.rango_max_smlv IS 'Rango máximo en múltiplos de SMLV (NULL = sin límite superior)';

-- Verificación
SELECT id, anio, indicador, valor_porcentaje, rango_min_smlv, rango_max_smlv, notas
FROM indicadores_economicos ORDER BY anio, indicador;
