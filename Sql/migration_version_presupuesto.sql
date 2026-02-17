-- =====================================================
-- MIGRACION: Versionado de presupuesto
-- Fecha: 2026-02-15
-- Proposito: Agregar versionado a presupuesto_detalle
--            para preservar historico de generaciones
-- =====================================================

-- 1. Columna version_actual en presupuestos
ALTER TABLE presupuestos
    ADD COLUMN IF NOT EXISTS version_actual INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN presupuestos.version_actual IS 'Version actual (ultima generacion) del presupuesto';

-- 2. Columna version en presupuesto_detalle
ALTER TABLE presupuesto_detalle
    ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

COMMENT ON COLUMN presupuesto_detalle.version IS 'Version de generacion a la que pertenece esta linea';

-- 3. Indice para filtrar por version
CREATE INDEX IF NOT EXISTS idx_pdetalle_version
    ON presupuesto_detalle(presupuesto_id, version);

-- 4. Reemplazar unique index para incluir version
DROP INDEX IF EXISTS uq_pdetalle_linea;

CREATE UNIQUE INDEX uq_pdetalle_linea
    ON presupuesto_detalle(
        presupuesto_id,
        centro_costo_id,
        COALESCE(concepto_id, 0),
        COALESCE(tercero_id, 0),
        mes,
        version
    );

-- 5. Tabla de metadatos de versiones
CREATE TABLE IF NOT EXISTS presupuesto_versiones (
    id SERIAL PRIMARY KEY,
    presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notas TEXT,
    lineas_generadas INTEGER DEFAULT 0,
    total_presupuestado NUMERIC(16,2) DEFAULT 0,
    anio_fuente INTEGER,
    UNIQUE (presupuesto_id, version)
);

CREATE INDEX IF NOT EXISTS idx_pversiones_presupuesto
    ON presupuesto_versiones(presupuesto_id);

COMMENT ON TABLE presupuesto_versiones IS 'Metadatos de cada version generada de un presupuesto';

-- 6. Semilla: registrar version 1 para presupuestos existentes con detalle
INSERT INTO presupuesto_versiones (presupuesto_id, version, notas, lineas_generadas, total_presupuestado)
SELECT
    pd.presupuesto_id,
    1,
    'Version inicial (migrada)',
    COUNT(*),
    SUM(pd.monto_presupuestado)
FROM presupuesto_detalle pd
GROUP BY pd.presupuesto_id
ON CONFLICT (presupuesto_id, version) DO NOTHING;

-- 7. Verificacion
SELECT 'presupuestos.version_actual' AS campo,
       COUNT(*) AS registros,
       MIN(version_actual) AS min_ver,
       MAX(version_actual) AS max_ver
FROM presupuestos
UNION ALL
SELECT 'presupuesto_detalle.version',
       COUNT(*),
       MIN(version),
       MAX(version)
FROM presupuesto_detalle
UNION ALL
SELECT 'presupuesto_versiones',
       COUNT(*),
       MIN(version),
       MAX(version)
FROM presupuesto_versiones;
