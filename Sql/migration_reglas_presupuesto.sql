-- =====================================================
-- MIGRACION: Reglas de Presupuesto
-- Fecha: 2026-02-10
-- Propósito: Mapeo CC/Concepto → tipo gasto + indicador
--            para clasificación automática en generación
-- Requiere: tipos_gasto (FK)
-- =====================================================

CREATE TABLE IF NOT EXISTS reglas_presupuesto (
    id SERIAL PRIMARY KEY,
    centro_costo_id INTEGER REFERENCES centro_costos(centro_costo_id),
    concepto_id INTEGER REFERENCES conceptos(conceptoid),
    tipo_gasto VARCHAR(100) NOT NULL DEFAULT 'Variable'
        REFERENCES tipos_gasto(tipo),
    indicador_codigo VARCHAR(50) NOT NULL DEFAULT 'IPC',
    factor_ajuste NUMERIC(8,4) DEFAULT 0,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index con COALESCE para permitir NULLs como "todos"
CREATE UNIQUE INDEX IF NOT EXISTS uq_reglas_ppto_cc_concepto
    ON reglas_presupuesto (COALESCE(centro_costo_id, 0), COALESCE(concepto_id, 0));

CREATE INDEX IF NOT EXISTS idx_reglas_ppto_cc ON reglas_presupuesto(centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_reglas_ppto_concepto ON reglas_presupuesto(concepto_id);

COMMENT ON TABLE reglas_presupuesto IS 'Reglas de clasificación CC/Concepto → tipo gasto + indicador para presupuesto';
COMMENT ON COLUMN reglas_presupuesto.tipo_gasto IS 'FK a tipos_gasto.tipo';
COMMENT ON COLUMN reglas_presupuesto.indicador_codigo IS 'Código del indicador económico a aplicar';
COMMENT ON COLUMN reglas_presupuesto.factor_ajuste IS 'Porcentaje adicional sobre el indicador. Ej: 2.0 = +2% extra';

-- Regla global default (CC=NULL, Concepto=NULL)
INSERT INTO reglas_presupuesto (centro_costo_id, concepto_id, tipo_gasto, indicador_codigo, factor_ajuste, notas)
VALUES (NULL, NULL, 'Variable', 'IPC', 0, 'Regla default global: variable con IPC')
ON CONFLICT ((COALESCE(centro_costo_id, 0)), (COALESCE(concepto_id, 0))) DO NOTHING;

-- Verificación
SELECT r.id, r.centro_costo_id, r.concepto_id, r.tipo_gasto, r.indicador_codigo, r.factor_ajuste
FROM reglas_presupuesto r ORDER BY r.id;
