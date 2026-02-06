---
description: Plan de implementación para configuración de tipos de cuenta con permisos y validaciones
---

# Plan: Configuración Tipos de Cuenta

## 1. Tipos de Cuenta

| Código | Nombre |
|--------|--------|
| `efectivo` | Efectivo/Caja Menor |
| `bancaria` | Cuenta Bancaria |
| `tarjeta_credito` | Tarjeta de Crédito |
| `inversiones` | Inversiones/Fondo Renta |

---

## 2. Campos en tabla `tipo_cuenta`

### Permisos de operación
| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `permite_crear_manual` | BOOLEAN | FALSE | ¿Crear desde UI? |
| `permite_editar` | BOOLEAN | FALSE | ¿Editar datos del movimiento? |
| `permite_modificar` | BOOLEAN | FALSE | ¿Cambiar valores (fecha, valor, desc)? |
| `permite_borrar` | BOOLEAN | FALSE | ¿Eliminar movimiento? |
| `permite_clasificar` | BOOLEAN | TRUE | ¿Asignar tercero, CC, concepto? |

### Validaciones (creación manual)
| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `requiere_descripcion` | BOOLEAN | FALSE | ¿Descripción obligatoria al crear? |
| `valor_minimo` | DECIMAL(18,2) | NULL | Valor mínimo permitido |

### UX
| Campo | Tipo | Default | Descripción |
|-------|------|---------|-------------|
| `responde_enter` | BOOLEAN | FALSE | ¿Enter valida y abre confirmación? |

### Pesos algoritmo clasificación (existentes)
| Campo | Tipo | Default |
|-------|------|---------|
| `peso_referencia` | INTEGER | 100 |
| `peso_descripcion` | INTEGER | 50 |
| `peso_valor` | INTEGER | 30 |
| `longitud_min_referencia` | INTEGER | 8 |

---

## 3. Configuración por tipo

| Campo | Efectivo | Bancaria | Tarjeta | Inversiones |
|-------|:--------:|:--------:|:-------:|:-----------:|
| `permite_crear_manual` | ✓ | ✗ | ✗ | ✗ |
| `permite_editar` | ✓ | ✗ | ✗ | ✗ |
| `permite_modificar` | ✓ | ✗ | ✗ | ✗ |
| `permite_borrar` | ✓ | ✗ | ✗ | ✗ |
| `permite_clasificar` | ✓ | ✓ | ✓ | ✓ |
| `requiere_descripcion` | ✓ | ✗ | ✗ | ✗ |
| `valor_minimo` | configurable | NULL | NULL | NULL |
| `responde_enter` | ✓ | ✗ | ✗ | ✗ |
| `peso_referencia` | 0 | 100 | 100 | 100 |
| `peso_descripcion` | 20 | 50 | 50 | 50 |
| `peso_valor` | 80 | 30 | 30 | 30 |
| `longitud_min_referencia` | 0 | 8 | 8 | 8 |

---

## 4. Regla universal (no configurable)

> **Clasificación SIEMPRE requiere: Tercero + Centro de Costo + Concepto**

Aplica a todos los tipos de cuenta sin excepción. Garantiza integridad para informes de presupuestos y exógenas.

---

## 5. UI según permisos

| Permiso = FALSE | Resultado en UI |
|-----------------|-----------------|
| `permite_crear_manual` | Ocultar botón "Nuevo" |
| `permite_editar` | Ocultar botón "Editar" |
| `permite_borrar` | Ocultar botón "Borrar" |
| `permite_modificar` | Campos fecha/valor/desc en solo lectura |
| `permite_clasificar` | Ocultar opción "Clasificar" |

---

## 6. Orden de campos - Formulario Efectivo

```
┌─────────────────────────────────────────┐
│ 1. Fecha     │ Cuenta    │ Valor        │
├─────────────────────────────────────────┤
│ 2. Tercero                              │
│ 3. Centro de Costos                     │
│ 4. Concepto                             │
│ 5. Descripción                          │
│ 6. Referencia                           │
│ 7. Nota adicional (campo 'detalle')     │
└─────────────────────────────────────────┘
```

---

## 7. Comportamiento Enter

```
[Enter]
   ↓
¿Validaciones OK?
   ↓
  NO → Mostrar errores
   ↓
  SÍ → Modal de confirmación
```

### Modal de confirmación (formato compacto)
```
┌─ Confirmar Movimiento ──────────────────┐
│                                         │
│  $150,000    Efectivo    2026-02-04     │
│                                         │
│  Tercero:  Juan Pérez                   │
│  CC:       Operaciones                  │
│  Concepto: Gastos Menores               │
│  Desc:     Compra papelería             │
│                                         │
│         [Cancelar]  [Guardar]           │
└─────────────────────────────────────────┘
```

Solo aplica si `responde_enter = TRUE`.

---

## 8. Flujo de movimientos

### Efectivo (creación manual)
```
Nuevo → Llenar campos → Enter/Guardar → Confirmación → Guardado
```

### Bancaria/Tarjeta/Inversiones (carga extracto)
```
Carga archivo → Movimientos sin clasificar → Clasificar → Guardado
                                               ↓
                              (tercero + CC + concepto obligatorios)
```

---

## 9. Tareas de implementación

### Backend
1. Actualizar migración SQL con nuevos campos en `tipo_cuenta`
2. Agregar tipo `inversiones` a los datos iniciales
3. Actualizar modelo Python `TipoCuenta` con nuevos campos
4. Exponer configuración de tipo en API de cuentas
5. Validar permisos en endpoints POST/PUT/DELETE de movimientos
6. Validar clasificación completa (regla universal)

### Frontend
1. Reorganizar campos del formulario según nuevo orden
2. Implementar validaciones dinámicas según configuración del tipo
3. Implementar Enter → validar → modal confirmación
4. Ocultar botones según permisos del tipo
5. Campos en solo lectura cuando `permite_modificar = FALSE`

---

## 10. SQL de migración (referencia)

```sql
-- Nuevos campos en tipo_cuenta
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_crear_manual BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_editar BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_modificar BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_borrar BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS permite_clasificar BOOLEAN DEFAULT TRUE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS requiere_descripcion BOOLEAN DEFAULT FALSE;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS valor_minimo DECIMAL(18,2) DEFAULT NULL;
ALTER TABLE tipo_cuenta ADD COLUMN IF NOT EXISTS responde_enter BOOLEAN DEFAULT FALSE;

-- Nuevo tipo: Inversiones
INSERT INTO tipo_cuenta (codigo, nombre, descripcion, peso_referencia, peso_descripcion, peso_valor, longitud_min_referencia)
VALUES ('inversiones', 'Inversiones/Fondo Renta', 'Cuentas de inversión y fondos de renta', 100, 50, 30, 8)
ON CONFLICT (codigo) DO NOTHING;

-- Configurar permisos por tipo
UPDATE tipo_cuenta SET
    permite_crear_manual = TRUE,
    permite_editar = TRUE,
    permite_modificar = TRUE,
    permite_borrar = TRUE,
    permite_clasificar = TRUE,
    requiere_descripcion = TRUE,
    responde_enter = TRUE
WHERE codigo = 'efectivo';

UPDATE tipo_cuenta SET
    permite_crear_manual = FALSE,
    permite_editar = FALSE,
    permite_modificar = FALSE,
    permite_borrar = FALSE,
    permite_clasificar = TRUE,
    requiere_descripcion = FALSE,
    responde_enter = FALSE
WHERE codigo IN ('bancaria', 'tarjeta_credito', 'inversiones');
```

---

## Fecha de creación
2026-02-04

## Estado
APROBADO - Pendiente implementación
