-- =====================================================
-- MIGRACION: Sistema de Presupuesto
-- Fecha: 2026-02-10
-- Proposito: Tablas para presupuesto anual y detalle mensual
-- =====================================================

-- 1. Tabla maestra de presupuestos
CREATE TABLE IF NOT EXISTS presupuestos (
    id SERIAL PRIMARY KEY,
    anio INTEGER NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'activo', 'cerrado')),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indice para busqueda rapida por año
CREATE INDEX IF NOT EXISTS idx_presupuestos_anio ON presupuestos(anio);

-- Solo 1 presupuesto activo por año
CREATE UNIQUE INDEX IF NOT EXISTS uq_presupuesto_activo_anio
    ON presupuestos(anio) WHERE estado = 'activo';

COMMENT ON TABLE presupuestos IS 'Presupuestos anuales (maestro)';
COMMENT ON COLUMN presupuestos.estado IS 'borrador | activo | cerrado';

-- 2. Detalle de lineas de presupuesto (mensual por clasificacion)
CREATE TABLE IF NOT EXISTS presupuesto_detalle (
    id SERIAL PRIMARY KEY,
    presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
    centro_costo_id INTEGER NOT NULL REFERENCES centro_costos(centro_costo_id),
    concepto_id INTEGER REFERENCES conceptos(conceptoid),
    tercero_id INTEGER REFERENCES terceros(terceroid),
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    monto_presupuestado NUMERIC(16,2) NOT NULL DEFAULT 0,
    monto_ajustado NUMERIC(16,2),
    tipo VARCHAR(20) NOT NULL DEFAULT 'variable'
        CHECK (tipo IN ('fijo', 'variable', 'estacional')),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indices para performance en queries de comparacion
CREATE INDEX IF NOT EXISTS idx_pdetalle_presupuesto ON presupuesto_detalle(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_pdetalle_cc ON presupuesto_detalle(centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_pdetalle_concepto ON presupuesto_detalle(concepto_id);
CREATE INDEX IF NOT EXISTS idx_pdetalle_tercero ON presupuesto_detalle(tercero_id);
CREATE INDEX IF NOT EXISTS idx_pdetalle_mes ON presupuesto_detalle(mes);

-- Unicidad por linea de presupuesto (misma combinacion CC+concepto+tercero+mes)
CREATE UNIQUE INDEX IF NOT EXISTS uq_pdetalle_linea
    ON presupuesto_detalle(presupuesto_id, centro_costo_id, COALESCE(concepto_id, 0), COALESCE(tercero_id, 0), mes);

COMMENT ON TABLE presupuesto_detalle IS 'Lineas mensuales del presupuesto por clasificacion';
COMMENT ON COLUMN presupuesto_detalle.monto_ajustado IS 'Revision mid-year, NULL si no ha sido ajustado';
COMMENT ON COLUMN presupuesto_detalle.tipo IS 'fijo | variable | estacional';

-- 3. Verificacion
SELECT 'presupuestos' as tabla, COUNT(*) as registros FROM presupuestos
UNION ALL
SELECT 'presupuesto_detalle', COUNT(*) FROM presupuesto_detalle;