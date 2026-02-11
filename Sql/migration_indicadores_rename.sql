-- =====================================================
-- MIGRACION: Renombrar campos indicadores_economicos
-- Fecha: 2026-02-10
-- Propósito: Eliminar campo 'codigo', renombrar 'nombre' a 'indicador'
--            Actualizar referencias en reglas_presupuesto y tipos_gasto
-- =====================================================

-- Paso 1: Normalizar nombre (quitar año al final) para que sea reutilizable entre años
UPDATE indicadores_economicos
SET nombre = TRIM(REGEXP_REPLACE(nombre, '\s+\d{4}$', ''));

-- Paso 2: Actualizar reglas_presupuesto para usar nombre en vez de codigo
UPDATE reglas_presupuesto r
SET indicador_codigo = ie.nombre
FROM indicadores_economicos ie
WHERE ie.codigo = r.indicador_codigo;

-- Paso 3: Actualizar tipos_gasto para usar nombre en vez de codigo
UPDATE tipos_gasto t
SET indicador_default = ie.nombre
FROM indicadores_economicos ie
WHERE ie.codigo = t.indicador_default;

-- Paso 4: Eliminar constraint UNIQUE(anio, codigo)
ALTER TABLE indicadores_economicos DROP CONSTRAINT IF EXISTS indicadores_economicos_anio_codigo_key;

-- Paso 5: Eliminar columna codigo
ALTER TABLE indicadores_economicos DROP COLUMN codigo;

-- Paso 6: Renombrar nombre → indicador
ALTER TABLE indicadores_economicos RENAME COLUMN nombre TO indicador;

-- Paso 7: Agregar constraint UNIQUE(anio, indicador)
CREATE UNIQUE INDEX IF NOT EXISTS uq_indicadores_anio_indicador
    ON indicadores_economicos(anio, indicador);

-- Paso 8: Renombrar indicador_codigo → indicador_nombre en reglas_presupuesto
ALTER TABLE reglas_presupuesto RENAME COLUMN indicador_codigo TO indicador_nombre;

-- Paso 9: Actualizar default de la columna
ALTER TABLE reglas_presupuesto ALTER COLUMN indicador_nombre SET DEFAULT 'IPC Colombia';

-- Paso 10: Actualizar comentarios
COMMENT ON COLUMN indicadores_economicos.indicador IS 'Nombre del indicador económico, único por año';
COMMENT ON COLUMN reglas_presupuesto.indicador_nombre IS 'Nombre del indicador económico a aplicar (referencia indicadores_economicos.indicador)';

-- Verificación
SELECT id, anio, indicador, valor_porcentaje, notas FROM indicadores_economicos ORDER BY anio, indicador;
SELECT id, indicador_nombre, tipo_gasto FROM reglas_presupuesto ORDER BY id;
SELECT tipo, indicador_default FROM tipos_gasto ORDER BY id;