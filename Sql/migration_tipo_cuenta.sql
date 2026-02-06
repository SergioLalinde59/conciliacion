-- =====================================================
-- MIGRACIÓN: Crear tabla tipo_cuenta y actualizar cuentas
-- Fecha: 2026-02-04
-- Propósito: Eliminar hardcoded cuenta_id == 2 para efectivo
--            Permitir pesos y permisos configurables por tipo
-- =====================================================

-- 1. Crear tabla tipo_cuenta
CREATE TABLE IF NOT EXISTS tipo_cuenta (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    descripcion TEXT,
    -- Pesos para el algoritmo de clasificación
    peso_referencia INTEGER DEFAULT 100,
    peso_descripcion INTEGER DEFAULT 50,
    peso_valor INTEGER DEFAULT 30,
    longitud_min_referencia INTEGER DEFAULT 8,
    -- Permisos de operación
    permite_crear_manual BOOLEAN DEFAULT FALSE,
    permite_editar BOOLEAN DEFAULT FALSE,
    permite_modificar BOOLEAN DEFAULT FALSE,
    permite_borrar BOOLEAN DEFAULT FALSE,
    permite_clasificar BOOLEAN DEFAULT TRUE,
    -- Validaciones (aplican en creación manual)
    requiere_descripcion BOOLEAN DEFAULT FALSE,
    valor_minimo DECIMAL(18,2) DEFAULT NULL,
    -- UX
    responde_enter BOOLEAN DEFAULT FALSE,
    -- Clasificación avanzada
    referencia_define_tercero BOOLEAN DEFAULT FALSE,
    -- Metadatos
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 1b. Agregar columnas nuevas si la tabla ya existe
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_crear_manual BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_editar BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_modificar BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_borrar BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_clasificar BOOLEAN DEFAULT TRUE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS requiere_descripcion BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS valor_minimo DECIMAL(18,2) DEFAULT NULL;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS responde_enter BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS referencia_define_tercero BOOLEAN DEFAULT FALSE;

-- 1c. Eliminar columna codigo si existe (ya no se usa)
ALTER TABLE tipo_cuenta DROP COLUMN IF EXISTS codigo;

-- 1d. Asegurar que nombre sea UNIQUE (para UPSERT)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'tipo_cuenta_nombre_key'
    ) THEN
        ALTER TABLE tipo_cuenta ADD CONSTRAINT tipo_cuenta_nombre_key UNIQUE (nombre);
    END IF;
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- Comentarios
COMMENT ON TABLE tipo_cuenta IS 'Tipos de cuenta con pesos y permisos configurables';
COMMENT ON COLUMN tipo_cuenta.nombre IS 'Nombre único del tipo de cuenta';
COMMENT ON COLUMN tipo_cuenta.peso_referencia IS 'Peso cuando la referencia coincide 100%';
COMMENT ON COLUMN tipo_cuenta.peso_descripcion IS 'Peso para similitud de texto en descripción';
COMMENT ON COLUMN tipo_cuenta.peso_valor IS 'Peso cuando el valor coincide exactamente';
COMMENT ON COLUMN tipo_cuenta.longitud_min_referencia IS 'Longitud mínima de referencia para considerarla válida';
COMMENT ON COLUMN tipo_cuenta.permite_crear_manual IS '¿Se puede crear movimiento desde UI?';
COMMENT ON COLUMN tipo_cuenta.permite_editar IS '¿Se puede abrir edición del movimiento?';
COMMENT ON COLUMN tipo_cuenta.permite_modificar IS '¿Se pueden cambiar valores (fecha, valor, desc)?';
COMMENT ON COLUMN tipo_cuenta.permite_borrar IS '¿Se puede eliminar el movimiento?';
COMMENT ON COLUMN tipo_cuenta.permite_clasificar IS '¿Se puede asignar tercero, CC, concepto?';
COMMENT ON COLUMN tipo_cuenta.requiere_descripcion IS '¿Descripción obligatoria al crear?';
COMMENT ON COLUMN tipo_cuenta.valor_minimo IS 'Valor mínimo permitido (NULL = sin mínimo)';
COMMENT ON COLUMN tipo_cuenta.responde_enter IS '¿Enter valida y abre confirmación?';
COMMENT ON COLUMN tipo_cuenta.referencia_define_tercero IS 'Si TRUE y referencia coincide: tercero garantizado, historial solo por referencia';

-- 2. Insertar tipos predefinidos con permisos
INSERT INTO tipo_cuenta (
    nombre, descripcion,
    peso_referencia, peso_descripcion, peso_valor, longitud_min_referencia,
    permite_crear_manual, permite_editar, permite_modificar, permite_borrar, permite_clasificar,
    requiere_descripcion, valor_minimo, responde_enter, referencia_define_tercero
)
VALUES
    -- Efectivo: permite todo, entrada manual
    ('Efectivo/Caja Menor',
     'Cuentas de manejo de efectivo y caja menor. Entrada manual.',
     0, 20, 80, 0,
     TRUE, TRUE, TRUE, TRUE, TRUE,
     FALSE, NULL, TRUE, FALSE),

    -- Bancaria: solo clasificar, referencia = número de cuenta del tercero
    ('Cuenta Bancaria',
     'Cuentas bancarias. Movimientos vienen del extracto, solo se clasifican.',
     100, 50, 30, 8,
     FALSE, FALSE, FALSE, FALSE, TRUE,
     FALSE, NULL, FALSE, TRUE),

    -- Tarjeta de Crédito: referencia identifica al comercio
    ('Tarjeta de Crédito',
     'Tarjetas de crédito corporativas. Movimientos vienen del extracto.',
     100, 50, 30, 8,
     FALSE, FALSE, FALSE, FALSE, TRUE,
     FALSE, NULL, FALSE, TRUE),

    -- Inversiones: referencia identifica tipo de operación
    ('Inversiones/Fondo Renta',
     'Cuentas de inversión y fondos. Movimientos vienen del extracto.',
     100, 50, 30, 8,
     FALSE, FALSE, FALSE, FALSE, TRUE,
     FALSE, NULL, FALSE, TRUE)
ON CONFLICT (nombre) DO UPDATE SET
    descripcion = EXCLUDED.descripcion,
    peso_referencia = EXCLUDED.peso_referencia,
    peso_descripcion = EXCLUDED.peso_descripcion,
    peso_valor = EXCLUDED.peso_valor,
    longitud_min_referencia = EXCLUDED.longitud_min_referencia,
    permite_crear_manual = EXCLUDED.permite_crear_manual,
    permite_editar = EXCLUDED.permite_editar,
    permite_modificar = EXCLUDED.permite_modificar,
    permite_borrar = EXCLUDED.permite_borrar,
    permite_clasificar = EXCLUDED.permite_clasificar,
    requiere_descripcion = EXCLUDED.requiere_descripcion,
    valor_minimo = EXCLUDED.valor_minimo,
    responde_enter = EXCLUDED.responde_enter,
    referencia_define_tercero = EXCLUDED.referencia_define_tercero;

-- 3. Agregar columna tipo_cuenta_id a la tabla cuentas (si no existe)
ALTER TABLE cuentas ADD COLUMN IF NOT EXISTS tipo_cuenta_id INTEGER REFERENCES tipo_cuenta(id);

-- 4. Actualizar cuentas existentes
-- Cuenta ID 2 es efectivo (según regla de negocio original)
UPDATE cuentas
SET tipo_cuenta_id = (SELECT id FROM tipo_cuenta WHERE nombre = 'Efectivo/Caja Menor')
WHERE cuentaid = 2 AND tipo_cuenta_id IS NULL;

-- Las demás cuentas se asumen bancarias por defecto
UPDATE cuentas
SET tipo_cuenta_id = (SELECT id FROM tipo_cuenta WHERE nombre = 'Cuenta Bancaria')
WHERE tipo_cuenta_id IS NULL;

-- 5. Crear índice para mejorar performance en JOINs
CREATE INDEX IF NOT EXISTS idx_cuentas_tipo_cuenta_id ON cuentas(tipo_cuenta_id);

-- 6. Verificar resultados
SELECT
    c.cuentaid,
    c.cuenta,
    tc.nombre as tipo_nombre,
    tc.permite_crear_manual,
    tc.permite_editar,
    tc.permite_modificar,
    tc.permite_borrar,
    tc.permite_clasificar
FROM cuentas c
LEFT JOIN tipo_cuenta tc ON c.tipo_cuenta_id = tc.id
WHERE c.activa = TRUE
ORDER BY c.cuentaid;

-- 7. Mostrar configuración de tipos
SELECT
    id,
    nombre,
    permite_crear_manual as crear,
    permite_editar as editar,
    permite_modificar as modificar,
    permite_borrar as borrar,
    permite_clasificar as clasificar,
    responde_enter as enter,
    referencia_define_tercero as ref_tercero
FROM tipo_cuenta
WHERE activo = TRUE
ORDER BY id;
