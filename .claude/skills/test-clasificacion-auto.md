# Test: Clasificacion Automatica (Matching Inteligente)

## Objetivo
Verificar que el algoritmo de clasificacion usa los pesos dinamicos segun el tipo de cuenta.

## Pagina
`/movimientos/clasificar` - ClasificarMovimientosPage

## Tabla tipo_cuenta (Completa)

### Campos de Identificacion
| Campo | Tipo | Descripcion |
|-------|------|-------------|
| `id` | SERIAL | Primary key |
| `nombre` | VARCHAR(100) UNIQUE | Nombre unico del tipo (Efectivo/Caja Menor, Cuenta Bancaria, etc.) |
| `descripcion` | TEXT | Descripcion larga |
| `activo` | BOOLEAN | Si el tipo esta activo |
| `created_at` | TIMESTAMP | Fecha de creacion |

### Pesos para Algoritmo de Clasificacion
| Campo | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `peso_referencia` | INTEGER | 100 | Peso cuando referencia coincide 100% |
| `peso_descripcion` | INTEGER | 50 | Peso para similitud de texto |
| `peso_valor` | INTEGER | 30 | Peso cuando valor coincide exactamente |
| `longitud_min_referencia` | INTEGER | 8 | Minimo chars para considerar referencia valida |
| `referencia_define_tercero` | BOOLEAN | FALSE | Si TRUE: referencia garantiza tercero, historial solo por referencia |

### Permisos de Operacion
| Campo | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `permite_crear_manual` | BOOLEAN | FALSE | ¿Se puede crear movimiento desde UI? |
| `permite_editar` | BOOLEAN | FALSE | ¿Se puede abrir edicion del movimiento? |
| `permite_modificar` | BOOLEAN | FALSE | ¿Se pueden cambiar valores (fecha, valor, desc)? |
| `permite_borrar` | BOOLEAN | FALSE | ¿Se puede eliminar el movimiento? |
| `permite_clasificar` | BOOLEAN | TRUE | ¿Se puede asignar tercero, CC, concepto? |

### Validaciones (Aplican en Creacion Manual)
| Campo | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `requiere_descripcion` | BOOLEAN | FALSE | ¿Descripcion obligatoria al crear? |
| `valor_minimo` | DECIMAL(18,2) | NULL | Valor minimo permitido (NULL = sin minimo) |

> **IMPORTANTE:** Estas validaciones SOLO aplican a cuentas tipo **Efectivo** (unica con `permite_crear_manual = TRUE`).
> - `valor_minimo`: Se puede configurar un monto minimo
> - `requiere_descripcion`: Siempre FALSE, descripcion es opcional
>
> **Validaciones de Efectivo:** Clasificacion (Tercero, CC, Concepto) + valor_minimo.
> **Descripcion:** Opcional (para anotaciones).

### UX
| Campo | Tipo | Default | Descripcion |
|-------|------|---------|-------------|
| `responde_enter` | BOOLEAN | FALSE | ¿Enter valida y abre confirmacion? |

---

## Configuracion por Tipo de Cuenta (Resumen)

| Campo | Bancaria | Efectivo | Tarjeta | Inversiones |
|-------|----------|----------|---------|-------------|
| `peso_referencia` | 100 | 0 | 100 | 100 |
| `peso_descripcion` | 50 | 20 | 50 | 50 |
| `peso_valor` | 30 | 80 | 30 | 30 |
| `longitud_min_referencia` | 8 | 0 | 8 | 8 |
| `permite_crear_manual` | false | **true** | false | false |
| `permite_editar` | false | **true** | false | false |
| `permite_modificar` | false | **true** | false | false |
| `permite_borrar` | false | **true** | false | false |
| `permite_clasificar` | true | true | true | true |
| `requiere_descripcion` | false | false | false | false |
| `responde_enter` | false | **true** | false | false |
| `referencia_define_tercero` | **true** | false | **true** | **true** |

---

## FASE 0: Match por Referencia Exacta (Prioridad Maxima)

**Controlado por**: `referencia_define_tercero` en tabla `tipo_cuenta`

### Cuando `referencia_define_tercero = TRUE`

La referencia identifica al tercero de forma unica:
- **Bancarias**: Referencia = numero de cuenta del tercero (Bancolombia confirmado)
- **Tarjetas**: Referencia = codigo del comercio (ej: APPLE, NETFLIX)

### Regla
```
Si referencia_define_tercero = TRUE y len(referencia) >= longitud_min:
    1. Buscar SOLO movimientos con esa misma referencia
    2. Tercero = tercero del primer movimiento clasificado
    3. score = 100 para todos los candidatos
    4. NO buscar por descripcion ni por cuenta
```

### Comportamiento
- El tercero esta **garantizado** por la referencia
- El historial **SOLO muestra movimientos con esa misma referencia**
- CC/Concepto **puede variar** (ej: Apple = App Store o Hardware)
- El usuario elige el CC/Concepto apropiado del historial

---

## FASE 1: Calculo del Score (Sin Match de Referencia)

**Solo aplica cuando NO hay match de referencia exacta.**

### Formula
```
score = (match_ref × peso_ref) + (sim_texto × peso_desc) + (match_valor × peso_valor)
        ─────────────────────────────────────────────────────────────────────────────
                              peso_ref + peso_desc + peso_valor

+ bonus_cobertura (max 10 pts por palabras coincidentes)
```

### Componentes del Score

#### 1. Match Referencia (`match_ref`)
| Condicion | Valor |
|-----------|-------|
| Referencia exacta igual Y longitud >= `longitud_min_referencia` | 100 |
| Referencia no coincide o muy corta | 0 |

#### 2. Similitud Texto (`sim_texto`)
Compara descripciones usando similitud hibrida:
- 60% similitud por palabras (Jaccard)
- 40% similitud por secuencia (SequenceMatcher)

Resultado: **0-100%**

#### 3. Match Valor (`match_valor`)
| Condicion | Valor |
|-----------|-------|
| Valor exactamente igual | 100 |
| Mismo signo Y diferencia <= 20% | 80 |
| Otro caso | 0 |

#### 4. Bonus Cobertura
+2 puntos por cada palabra clave encontrada en la descripcion (max 10 pts)

### Ejemplo: Cuenta Bancaria (R=100, D=50, V=30)

Movimiento actual: `REF: 123456789, DESC: "Pago Nomina", VALOR: -$5.000.000`

| Candidato | match_ref | sim_texto | match_valor | Score |
|-----------|-----------|-----------|-------------|-------|
| REF igual, DESC igual, VALOR igual | 100 | 100 | 100 | **100%** |
| REF igual, DESC diferente, VALOR diferente | 100 | 20 | 0 | **61%** |
| REF diferente, DESC igual, VALOR igual | 0 | 100 | 100 | **44%** |

### Ejemplo: Cuenta Efectivo (R=0, D=20, V=80)

Movimiento actual: `DESC: "Almuerzo", VALOR: -$15.000`

| Candidato | match_ref | sim_texto | match_valor | Score |
|-----------|-----------|-----------|-------------|-------|
| DESC igual, VALOR igual | 0 | 100 | 100 | **100%** |
| DESC diferente, VALOR igual | 0 | 30 | 100 | **86%** |
| DESC igual, VALOR diferente | 0 | 100 | 0 | **20%** |

---

## FASE 1.5: Redistribucion de Pesos (Sin Referencia)

**IMPORTANTE**: Si el movimiento actual NO tiene referencia valida (longitud < `longitud_min_referencia`):

- El peso de referencia se **redistribuye proporcionalmente** entre descripcion y valor
- Esto evita que el 55% del score quede "desperdiciado"

### Ejemplo: MasterCardPesos sin referencia

| Escenario | peso_ref | peso_desc | peso_val |
|-----------|----------|-----------|----------|
| Original (R=100, D=50, V=30) | 55.6% | 27.8% | 16.6% |
| **Sin referencia (redistribuido)** | **0%** | **62.5%** | **37.5%** |

Resultado: Descripcion exacta ahora puede dar score >= 62.5% (antes solo 27.8%)

---

## FASE 2: Clasificacion (Inferencia)

Una vez calculado el score, se infieren los campos de clasificacion:

### Reglas de Inferencia

| Paso | Condicion | Accion |
|------|-----------|--------|
| 5 | `score >= 50%` | Sugerir **Tercero** del ganador |
| 5 | `score >= 50%` Y `match_valor >= 50%` | Sugerir tambien **CC** y **Concepto** |
| 6 | Todos los candidatos tienen mismo tercero | Sugerir ese **Tercero** (consistencia) |
| 7 | Tercero sugerido pero sin CC/Concepto | Buscar CC/Concepto del historial del tercero |

### Paso 7: Inferir CC/Concepto del Tercero

Si ya se sugirio un tercero pero NO hay CC/Concepto:

1. Filtrar candidatos que tengan el mismo tercero sugerido
2. Contar CC y Conceptos mas frecuentes
3. Si un CC aparece en >= umbral del historial del tercero → Sugerirlo
4. Si un Concepto aparece en >= umbral del historial del tercero → Sugerirlo

**Variable de entorno:**
```
CLASIFICACION_UMBRAL_CC_CONCEPTO=0.6  # Default 60% (3/5)
```

**Ejemplo**:
```
Tercero sugerido: Tostado
Umbral: 60%

Historial de Tostado:
- Restaurantes / Restaurantes (4 veces)

→ CC sugerido: Restaurantes (4/4 = 100% >= 60%) ✅
→ Concepto sugerido: Restaurantes (4/4 = 100% >= 60%) ✅
```

### Tipos de Sugerencia (razon)

| Tipo | Descripcion |
|------|-------------|
| `match_referencia` | Referencia exacta encontrada |
| `historico_valor` | Similitud texto + valor coincidente |
| `historico_texto` | Solo similitud de texto |
| `frecuencia_tercero` | Historial consistente (todos igual tercero) |
| `+ CC/Concepto del tercero` | CC/Concepto inferidos del historial del tercero |

---

## FASE 3: Ordenamiento del Historial

Los candidatos se ordenan por:
1. **Score** - Mayor primero
2. **Fecha** - Mas reciente primero
3. **Valor** - Por cercania al valor actual

---

## Casos de Prueba

### 1. Cuenta Bancaria (pesos: R=100, D=50, V=30)
- [ ] Movimiento con referencia larga (>8 chars) debe priorizar match por referencia
- [ ] Si referencia corta (<8 chars), el peso de referencia NO suma al score
- [ ] Sugerencia debe mostrar "Por referencia" cuando aplique
- [ ] Score con referencia exacta debe ser > 55%

### 2. Cuenta Efectivo (pesos: R=0, D=20, V=80)
- [ ] NUNCA debe usar referencia (peso=0)
- [ ] Debe priorizar match por valor exacto (peso=80)
- [ ] Sugerencia debe mostrar "Por valor" o "Por descripcion"
- [ ] Score con valor exacto debe ser > 80%

### 3. Busqueda en Historial
- [ ] SIEMPRE filtra por la misma cuenta (no mezcla bancos)
- [ ] Busca movimientos YA clasificados como referencia
- [ ] Muestra maximo 5 candidatos ordenados por score

### 4. Aplicar Clasificacion
- [ ] Solo si `permite_clasificar = true`
- [ ] Asigna tercero, centro_costo, concepto
- [ ] Guarda en historial para futuras sugerencias

### 5. UI - Historial Relacionado
- [ ] Columna % muestra el score calculado
- [ ] Color verde si score >= 80%
- [ ] Color amarillo si score >= 50%
- [ ] Color gris si score < 50%
- [ ] Orden respeta backend (no permite reordenar en frontend)

### 6. Redistribucion de Pesos (Sin Referencia)
- [ ] Movimiento SIN referencia debe redistribuir peso entre desc y valor
- [ ] Score con descripcion exacta debe ser >= 62% (no 28%)
- [ ] Log debe mostrar "redistribuyendo peso de referencia"

### 7. Inferir CC/Concepto del Tercero
- [ ] Si tercero sugerido y CC consistente (>= 60%) → Sugerir CC
- [ ] Si tercero sugerido y Concepto consistente (>= 60%) → Sugerir Concepto
- [ ] Log debe mostrar "CC inferido del tercero" y/o "Concepto inferido"
- [ ] Razon debe incluir "+ CC/Concepto del tercero"

---

## Variables de Entorno

| Variable | Default | Descripcion |
|----------|---------|-------------|
| `CLASIFICACION_UMBRAL_CC_CONCEPTO` | `0.6` | Umbral (60%) para inferir CC/Concepto del historial del tercero |
| `SIMILAR_RECORDS_VALUE_MARGIN_PERCENT` | `20` | Margen % para considerar valores "cercanos" |
| `SIMILAR_RECORDS_TEXT_SIMILARITY_THRESHOLD` | `70` | Umbral % minimo de similitud de texto |

---

## Archivos Relevantes

### Backend
- `Backend/src/application/services/clasificacion_service.py`
  - `obtener_sugerencia_clasificacion()` - Pipeline principal
  - `calcular_similitud_hibrida()` - Similitud de texto
  - `_obtener_pesos_cuenta()` - Carga pesos por tipo cuenta
- `Backend/src/infrastructure/api/routers/tipos_cuenta.py` - CRUD API tipos de cuenta
- `Backend/src/infrastructure/database/postgres_tipo_cuenta_repository.py` - Repositorio PostgreSQL
- `Backend/src/domain/models/tipo_cuenta.py` - Modelo de dominio
- `Backend/src/domain/models/cuenta.py` - Modelo cuenta con campos de tipo_cuenta

### Frontend
- `frontend/src/pages/ClasificarMovimientosPage.tsx` - UI de clasificacion
- `frontend/src/pages/TiposCuentaPage.tsx` - Admin tipos de cuenta
- `frontend/src/components/organisms/modals/TipoCuentaModal.tsx` - Modal edicion
  - Secciones: Datos basicos > **Referencia** > Permisos > Validaciones > Pesos
  - Referencia: Define Tercero (checkbox) | Longitud Min (input)
- `frontend/src/types.ts` - `TipoCuenta`, `ContextoItem`, `ContextoClasificacionResponse`

### Base de Datos
- `tipo_cuenta` - Configuracion de pesos y permisos por tipo
- `cuentas.tipo_cuenta_id` - FK a tipo_cuenta
- `movimientos` - Historial de clasificaciones

### Migracion
- `Sql/migration_tipo_cuenta.sql` - Crea tabla y tipos predefinidos

---

## Resultado Esperado
- **Bancarias**: Prioriza referencia bancaria unica (transferencias, pagos PSE)
- **Efectivo**: Prioriza valor exacto (gastos recurrentes como almuerzo, transporte)
- **Tarjetas**: Balance entre referencia y descripcion (comercios)
- **Sin referencia**: Redistribuye peso entre descripcion y valor (score mas alto)