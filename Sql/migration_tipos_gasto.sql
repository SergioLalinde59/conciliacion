-- =====================================================
-- MIGRACION: Catálogo de Tipos de Gasto
-- Fecha: 2026-02-10
-- Propósito: Tabla configurable de tipos de gasto para
--            clasificación de presupuesto (reemplaza CHECK)
-- EJECUTAR PRIMERO - es FK de reglas_presupuesto y presupuesto_detalle
-- =====================================================

CREATE TABLE IF NOT EXISTS tipos_gasto (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    indicador_default VARCHAR(50) DEFAULT 'IPC',
    excluir_presupuesto BOOLEAN DEFAULT FALSE,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE tipos_gasto IS 'Catálogo configurable de tipos de gasto para presupuesto';
COMMENT ON COLUMN tipos_gasto.tipo IS 'Identificador único del tipo de gasto';
COMMENT ON COLUMN tipos_gasto.indicador_default IS 'Indicador económico sugerido al crear regla con este tipo';
COMMENT ON COLUMN tipos_gasto.excluir_presupuesto IS 'TRUE = este tipo se excluye de la generación automática';

-- Datos semilla
INSERT INTO tipos_gasto (tipo, descripcion, indicador_default, excluir_presupuesto) VALUES
    ('Fijo', 'Costos constantes mes a mes: arriendo, seguros, suscripciones', 'IPC', FALSE),
    ('Variable', 'Costos que fluctúan: servicios, insumos, mantenimiento', 'IPC', FALSE),
    ('Salarial', 'Nómina: salarios, prestaciones, seguridad social', 'SALARIO_MINIMO', FALSE),
    ('Estacional', 'Patrón mensual variable: primas, vacaciones', 'IPC', FALSE),
    ('No Repetitivo', 'Gasto puntual, excluido del presupuesto automático', 'IPC', TRUE)
ON CONFLICT (tipo) DO NOTHING;

-- Verificación
SELECT tipo, indicador_default, excluir_presupuesto FROM tipos_gasto ORDER BY id;
