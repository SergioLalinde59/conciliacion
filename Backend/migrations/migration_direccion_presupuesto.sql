-- Migration: Agregar columna direccion para soporte de ingresos en presupuesto
-- Fecha: 2026-02-17

-- 1. Agregar columna direccion a presupuesto_detalle
ALTER TABLE presupuesto_detalle
ADD COLUMN IF NOT EXISTS direccion VARCHAR(10) NOT NULL DEFAULT 'egreso';

-- Add CHECK constraint separately (IF NOT EXISTS not supported for constraints)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'presupuesto_detalle_direccion_check'
    ) THEN
        ALTER TABLE presupuesto_detalle
        ADD CONSTRAINT presupuesto_detalle_direccion_check
        CHECK (direccion IN ('ingreso', 'egreso'));
    END IF;
END$$;

-- 2. Agregar columna direccion a reglas_presupuesto
ALTER TABLE reglas_presupuesto
ADD COLUMN IF NOT EXISTS direccion VARCHAR(10) NOT NULL DEFAULT 'egreso';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'reglas_presupuesto_direccion_check'
    ) THEN
        ALTER TABLE reglas_presupuesto
        ADD CONSTRAINT reglas_presupuesto_direccion_check
        CHECK (direccion IN ('ingreso', 'egreso'));
    END IF;
END$$;

-- 3. Agregar columna direccion a tipos_gasto
ALTER TABLE tipos_gasto
ADD COLUMN IF NOT EXISTS direccion VARCHAR(10) NOT NULL DEFAULT 'egreso';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tipos_gasto_direccion_check'
    ) THEN
        ALTER TABLE tipos_gasto
        ADD CONSTRAINT tipos_gasto_direccion_check
        CHECK (direccion IN ('ingreso', 'egreso'));
    END IF;
END$$;

-- 4. Insertar tipos de ingreso
INSERT INTO tipos_gasto (tipo, descripcion, indicador_default, excluir_presupuesto, prioridad, direccion, keywords)
VALUES
  ('Ingreso Fijo', 'Ingresos recurrentes mensuales (salario, arriendos)', 'Aumento Salario Mínimo', false, 1, 'ingreso', '[]'::jsonb),
  ('Ingreso Inversión', 'Rendimientos financieros, dividendos, intereses', 'IPC Colombia', false, 3, 'ingreso', '[]'::jsonb),
  ('Ingreso Variable', 'Ingresos irregulares o variables (freelance, bonos)', 'IPC Colombia', false, 5, 'ingreso', '[]'::jsonb)
ON CONFLICT DO NOTHING;
