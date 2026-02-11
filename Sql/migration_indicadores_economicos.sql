-- =====================================================
-- MIGRACION: Indicadores Económicos
-- Fecha: 2026-02-10
-- Propósito: Tabla para almacenar indicadores económicos
--            por año (IPC, salario mínimo, etc.)
-- =====================================================

CREATE TABLE IF NOT EXISTS indicadores_economicos (
    id SERIAL PRIMARY KEY,
    anio INTEGER NOT NULL,
    codigo VARCHAR(50) NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    valor_porcentaje NUMERIC(8,4) NOT NULL,
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(anio, codigo)
);

CREATE INDEX IF NOT EXISTS idx_indicadores_anio ON indicadores_economicos(anio);

COMMENT ON TABLE indicadores_economicos IS 'Indicadores económicos por año para cálculo de presupuesto';
COMMENT ON COLUMN indicadores_economicos.codigo IS 'Código único por año: IPC, SALARIO_MINIMO, SALARIO_MEDIO, SALARIO_ALTO';
COMMENT ON COLUMN indicadores_economicos.valor_porcentaje IS 'Porcentaje de aumento. Ej: 5.20 = 5.20%';

-- Datos semilla 2026
INSERT INTO indicadores_economicos (anio, codigo, nombre, valor_porcentaje, notas) VALUES
    (2026, 'IPC', 'IPC Colombia 2026', 5.2000, 'Inflación proyectada'),
    (2026, 'SALARIO_MINIMO', 'Aumento Salario Mínimo 2026', 23.0000, 'Obligatorio por ley, aplica a 1 SMLV'),
    (2026, 'SALARIO_MEDIO', 'Aumento salarios 2-4 SMLV', 10.0000, 'Negociado, banda media'),
    (2026, 'SALARIO_ALTO', 'Aumento salarios >4 SMLV', 5.2000, 'Directivos, se ajusta por IPC')
ON CONFLICT (anio, codigo) DO NOTHING;

-- Verificación
SELECT anio, codigo, nombre, valor_porcentaje FROM indicadores_economicos ORDER BY anio, codigo;