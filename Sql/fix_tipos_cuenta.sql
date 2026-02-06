-- Corregir asignación de tipos de cuenta

-- 1. Actualizar cuentas a los tipos correctos (por nombre de cuenta)
UPDATE cuentas SET tipo_cuenta_id = (SELECT id FROM tipo_cuenta WHERE codigo = 'efectivo')
WHERE LOWER(cuenta) IN ('efectivo', 'saldos', 'otros');

UPDATE cuentas SET tipo_cuenta_id = (SELECT id FROM tipo_cuenta WHERE codigo = 'tarjeta_credito')
WHERE LOWER(cuenta) LIKE '%tarjeta%' OR LOWER(cuenta) LIKE '%mastercard%';

UPDATE cuentas SET tipo_cuenta_id = (SELECT id FROM tipo_cuenta WHERE codigo = 'inversiones')
WHERE LOWER(cuenta) IN ('fondorenta', 'fondo renta', 'inversiones');

UPDATE cuentas SET tipo_cuenta_id = (SELECT id FROM tipo_cuenta WHERE codigo = 'bancaria')
WHERE tipo_cuenta_id IS NULL OR tipo_cuenta_id NOT IN (SELECT id FROM tipo_cuenta WHERE codigo IS NOT NULL);

-- 2. Eliminar tipos antiguos sin código
DELETE FROM tipo_cuenta WHERE codigo IS NULL;

-- 3. Verificar resultados
SELECT
    c.cuentaid,
    c.cuenta,
    tc.codigo as tipo_codigo,
    tc.nombre as tipo_nombre
FROM cuentas c
LEFT JOIN tipo_cuenta tc ON c.tipo_cuenta_id = tc.id
WHERE c.activa = TRUE
ORDER BY c.cuentaid;
