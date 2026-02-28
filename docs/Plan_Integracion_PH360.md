# Plan de Integración Conciliación + Presupuestos en PH360

**Fecha**: 2026-02-19
**Última actualización**: 2026-02-26
**Estado**: Revisado
**Autor**: Análisis Claude Code

---

## 1. Contexto

El directorio `conciliacion/` contiene una aplicación personal de conciliación bancaria con dos dominios de negocio:

- **Movimientos Bancarios / Conciliación**: gestión de movimientos, extractos PDF, matching inteligente, clasificación automática
- **Presupuestos**: generación inteligente, reglas por tipo de gasto, indicadores económicos, comparación presupuesto vs real

Estos dominios deben integrarse en **PH360**, la plataforma de microservicios empresarial ubicada en `F:\1. Cloud\4. AI\1. Antigravity\PH360`.

La pregunta original era cómo separar conciliacion/ en dos proyectos independientes. Tras analizar PH360, la verdadera pregunta es: **¿cómo migrar estos dominios al stack de PH360?**

### 1.1 Inventario de Tablas — App Conciliación y Presupuestos

La aplicación actual cuenta con **27 tablas** organizadas en 5 categorías.

> **Nota**: El mapeo campo a campo hacia PH360 se encuentra en la [sección 1.3](#13-mapeo-campo-a-campo). El análisis detallado vs PH360 en la [sección 16](#16-análisis-de-maestros-y-configuración-conciliación-vs-ph360).

#### Tablas Maestras (8)

| # | Tabla | Descripción | Uso | Campos |
|---|-------|-------------|-----|--------|
| 1 | `cuentas` | Cuentas bancarias | Registro de cuentas con permisos de carga y conciliación | cuentaid, cuenta, activa, permite_carga, permite_conciliar, numero_cuenta, tipo_cuenta_id |
| 2 | `centro_costos` | Centros de costo | Agrupación jerárquica de gastos e ingresos | centro_costo_id, centro_costo, activa |
| 3 | `conceptos` | Conceptos de gasto/ingreso | Subcategorías dependientes de un centro de costo (ej: CC "Servicios" → "Agua") | conceptoid, concepto, centro_costo_id, activa |
| 4 | `terceros` | Proveedores y terceros | Proveedores/pagadores identificados en extractos bancarios (EPM, EAAB) | terceroid, tercero, activa |
| 5 | `tercero_descripciones` | Alias de terceros (3NF) | Múltiples descripciones/referencias por tercero para clasificación automática | id, terceroid, descripcion, referencia, activa, created_at |
| 6 | `monedas` | Monedas | Catálogo de monedas (COP, USD). No se migra a PH360 (ver D1) | monedaid, isocode, moneda, activa |
| 7 | `tipo_mov` | Tipos de movimiento | Clasificación de movimiento bancario (débito, crédito, etc.) | tipomovid, tipomov, activa |
| 8 | `tipo_cuenta` | Tipos de cuenta | Permisos y pesos de matching por tipo de cuenta | id, nombre, descripcion, peso_referencia, peso_descripcion, peso_valor, longitud_min_referencia, permite_crear_manual, permite_editar, permite_modificar, permite_borrar, permite_clasificar, requiere_descripcion, valor_minimo, responde_enter, referencia_define_tercero, activo, created_at |

#### Tablas de Configuración (10)

| # | Tabla | Descripción | Uso | Campos |
|---|-------|-------------|-----|--------|
| 9 | `tipos_gasto` | Tipos de gasto | Catálogo: Fijo, Variable, Salarial, Estacional, No Repetitivo | id, tipo, descripcion, indicador_default, excluir_presupuesto, activo, keywords, prioridad, direccion, created_at |
| 10 | `indicadores_economicos` | Indicadores económicos | Indicadores por año (IPC, SMLV, rangos salariales) para cálculo de presupuesto | id, anio, codigo, nombre, valor_porcentaje, rango_min_smlv, rango_max_smlv, notas, created_at |
| 11 | `trm_cache` | Cache TRM diaria | Tasa representativa del mercado consultada de datos.gov.co | id, fecha, valor, fuente, created_at |
| 12 | `configuracion_matching` | Config. de matching | Parámetros del algoritmo de conciliación (tolerancias, pesos, scores) | id, tolerancia_valor, similitud_descripcion_minima, peso_fecha, peso_valor, peso_descripcion, score_minimo_exacto, score_minimo_probable, palabras_clave_traslado, activo, created_at, updated_at |
| 13 | `cuenta_extractores` | Extractores por cuenta | Mapeo de módulos de extracción PDF por cuenta bancaria | id, cuenta_id, tipo, modulo, orden, activo, created_at |
| 14 | `regla_clasificacion` | Reglas de clasificación | Clasificación automática de movimientos por patrón → tercero/CC/concepto | id, patron, descripcion, tercero_id, centro_costo_id, concepto_id, tipo_match, cuenta_id |
| 15 | `reglas_presupuesto` | Reglas de presupuesto | Reglas de generación de presupuesto por CC/concepto con indicador económico | id, centro_costo_id, concepto_id, tipo_gasto, indicador_codigo, factor_ajuste, monto_fijo_mensual, notas, created_at |
| 16 | `matching_alias` | Alias de matching | Normalización de descripciones bancarias para mejorar matching | id, cuenta_id, patron, reemplazo, created_at |
| 17 | `config_filtro_centro_costo` | Filtros de CC | Filtros de exclusión de centros de costo en dashboards | id, centro_costo_id, etiqueta, activo_por_defecto |
| 18 | `config_valor_pendiente` | Valores pendientes | Marcadores de valores "pendiente de clasificar" (tercero, grupo, concepto) | id, tipo, valor_id, descripcion, activo |

#### Tablas de Presupuesto (3)

| # | Tabla | Descripción | Uso | Campos |
|---|-------|-------------|-----|--------|
| 19 | `presupuestos` | Presupuestos anuales | Encabezado con umbrales semáforo y configuración de versión | id, anio, nombre, estado, notas, semaforo_verde_hasta, semaforo_amarillo_hasta, umbral_minimo_mensual, umbral_minimo_anual, umbral_no_repetitivo, umbral_estacional, umbral_pareto, version_actual, cifras_en_millones, created_at |
| 20 | `presupuesto_detalle` | Detalle de presupuesto | Líneas mensuales por CC/concepto/tercero con montos y versión | id, presupuesto_id, centro_costo_id, concepto_id, tercero_id, mes, monto_presupuestado, monto_ajustado, monto_base, tipo, direccion, version, notas, created_at |
| 21 | `presupuesto_versiones` | Versiones de presupuesto | Historial de generación: líneas generadas, total, año fuente | id, presupuesto_id, version, created_at, notas, lineas_generadas, total_presupuestado, anio_fuente |

#### Tablas Transaccionales (5)

| # | Tabla | Descripción | Uso | Campos |
|---|-------|-------------|-----|--------|
| 22 | `movimientos_encabezado` | Movimientos del sistema | Movimientos contables cargados manualmente o por Excel | Id, Fecha, Descripcion, Referencia, Valor, USD, TRM, trm_provisional, MonedaID, CuentaID, terceroid, Detalle, fecha_corte, created_at |
| 23 | `movimientos_detalle` | Detalle de movimientos | Distribución de un movimiento por CC/concepto/tercero | id, movimiento_id, centro_costo_id, ConceptoID, TerceroID, Valor, created_at |
| 24 | `movimientos_extracto` | Movimientos de extracto | Movimientos extraídos de extractos bancarios PDF | id, cuenta_id, year, month, fecha, descripcion, referencia, valor, usd, trm, saldo_acumulado, numero_linea, raw_text, created_at |
| 25 | `movimiento_vinculaciones` | Vinculaciones | Enlaces de conciliación extracto↔sistema con scores de similitud | id, movimiento_extracto_id, movimiento_sistema_id, estado, score_similitud, score_fecha, score_valor, score_descripcion, es_traslado, cuenta_contraparte_id, vinculacion_contraparte_id, confirmado_por_usuario, fecha_confirmacion, created_at, created_by, notas |
| 26 | `conciliaciones` | Conciliaciones mensuales | Registro mensual por cuenta con saldos de extracto vs sistema | id, cuenta_id, year, month, fecha_corte, extracto_saldo_anterior, extracto_entradas, extracto_salidas, extracto_saldo_final, sistema_entradas, sistema_salidas, sistema_saldo_final, diferencia_saldo, estado, datos_extra, updated_at |

#### Tablas de Visualización (1)

| # | Tabla | Descripción | Uso | Campos |
|---|-------|-------------|-----|--------|
| 27 | `perspectivas` | Perspectivas de visualización | Filtros de centros de costo por contexto (SLB, Bosques, Tita, etc.) para dashboards y reportes | id, nombre, slug, tipo (incluir/excluir), centro_costo_ids, siempre_excluir_ids, es_defecto, orden, activa |

### 1.2 Mapeo de Tablas: Conciliación Actual → PH360

Referencia rápida para codificación. Todas las tablas PH360 incluyen `property_id`.

#### Schema `conciliation` (backend-conciliation) — 20 tablas

| # | Tabla actual | Tabla PH360 | Tipo | Notas |
|---|-------------|-------------|------|-------|
| 1 | `cuentas` | `conciliation.account_config` | Maestro | Extensión de `payment.bank_accounts` (FK lógico `bank_account_id UUID`) |
| 2 | `tipo_cuenta` | `conciliation.account_types` | Config | Pesos de matching + permisos por tipo |
| 3 | `centro_costos` | `conciliation.cost_centers` | Maestro | |
| 4 | `conceptos` | `conciliation.concepts` | Maestro | Gasto e ingreso. FK a `cost_centers` |
| 5 | `terceros` | `conciliation.third_parties` | Maestro | |
| 6 | `tercero_descripciones` | `conciliation.third_party_aliases` | Maestro | FK a `third_parties` ON DELETE CASCADE |
| 7 | `tipo_mov` | `conciliation.movement_types` | Maestro | |
| 8 | `monedas` | — | — | No se migra. Se resuelve con `payment.bank_accounts.currency` |
| 9 | `configuracion_matching` | `conciliation.matching_config` | Config | Pesos, scores, tolerancia, keywords traslado |
| 10 | `matching_alias` | `conciliation.matching_aliases` | Config | FK lógico `bank_account_id UUID` |
| 11 | `cuenta_extractores` | `conciliation.account_extractors` | Config | FK lógico `bank_account_id UUID` |
| 12 | `regla_clasificacion` | `conciliation.classification_rules` | Config | FK lógico `bank_account_id UUID` |
| 13 | `config_filtro_centro_costo` | `conciliation.cost_center_filters` | Config | FK a `cost_centers` |
| 14 | `config_valor_pendiente` | `conciliation.pending_value_config` | Config | type: third_party / concept / cost_center |
| 15 | `movimientos_encabezado` | `conciliation.movements` | Transaccional | FK lógico `bank_account_id UUID` |
| 16 | `movimientos_detalle` | `conciliation.movement_details` | Transaccional | FK a movements, cost_centers, concepts, third_parties |
| 17 | `movimientos_extracto` | `conciliation.bank_statements` | Transaccional | FK lógico `bank_account_id UUID` |
| 18 | `movimiento_vinculaciones` | `conciliation.movement_matches` | Transaccional | FK a movements + bank_statements + reconciliations |
| 19 | `conciliaciones` | `conciliation.reconciliations` | Transaccional | FK lógico `bank_account_id UUID` |
| 20 | `perspectivas` | `conciliation.perspectives` | Config | Filtros de visualización por contexto. Arrays de cost_center_ids |

#### Schema `budget` (backend-budget) — 8 tablas

| # | Tabla actual | Tabla PH360 | Tipo | Notas |
|---|-------------|-------------|------|-------|
| 21 | `tipos_gasto` | `budget.expense_types` | Config | keywords JSONB, dirección (egreso/ingreso) |
| 22 | `indicadores_economicos` | `budget.economic_indicators` | Config | IPC, SMLV por año |
| 23 | `reglas_presupuesto` | `budget.budget_rules` | Config | CC/concepto como IDs lógicos (no FK cross-schema) |
| 24 | `presupuestos` | `budget.budgets` | Maestro | Umbrales semáforo, estado, versión actual |
| 25 | `presupuesto_detalle` | `budget.budget_details` | Transaccional | CC/concepto como IDs lógicos (no FK cross-schema) |
| 26 | `presupuesto_versiones` | `budget.budget_versions` | Transaccional | FK a budgets ON DELETE CASCADE |
| 27 | `trm_cache` | `conciliation.trm_cache` | Config | En schema conciliation (no budget). Cache TRM diaria |

#### Tablas nuevas en PH360 (sin equivalente en app actual)

| # | Tabla PH360 | Schema | Tipo | Propósito |
|---|-------------|--------|------|-----------|
| 28 | `budget.movement_summary` | budget | CQRS Read Model | Agregado de movimientos, alimentado por eventos Kafka |
| 29 | `budget.processed_events` | budget | Técnica | Idempotencia de eventos Kafka (sin `property_id`) |

#### Tablas PH360 que se consumen (solo lectura)

| Tabla PH360 | Mecanismo | Para qué |
|-------------|-----------|----------|
| `realestate.properties` | `property_id` en header | Eje de datos |
| `payment.bank_accounts` | FK lógico `bank_account_id` UUID | Datos de cuenta (nombre, número, moneda) |
| `iam.tenants` | JWT | Autenticación |
| `iam.permissions` | `@RequiresPermission` | Autorización RBAC |

### 1.3 Mapeo Campo a Campo: Columna Actual → Columna PH360

Referencia para codificación de JPA entities y Flyway migrations. Convenciones PH360:
- PK: `id BIGSERIAL` (en vez de nombres como `cuentaid`, `conceptoid`)
- Nombres en inglés, snake_case
- Todas las tablas agregan `property_id UUID NOT NULL`
- Timestamps: `created_at`, `updated_at`
- Booleanos: `active` (en vez de `activa`/`activo`)

#### 1. `cuentas` → `conciliation.account_config`

> La tabla `cuentas` se divide en dos: los datos bancarios quedan en `payment.bank_accounts` (ya existe) y la configuración de conciliación en `account_config`.

| Columna actual | Columna PH360 | Destino | Notas |
|---------------|---------------|---------|-------|
| cuentaid | — | — | Reemplazado por `bank_account_id UUID` (referencia a payment) |
| cuenta | — | `payment.bank_accounts.account_name` | Ya existe en payment |
| numero_cuenta | — | `payment.bank_accounts.account_number` | Ya existe en payment |
| activa | — | `payment.bank_accounts.is_active` | Ya existe en payment |
| permite_carga | can_upload | `account_config` | BOOLEAN DEFAULT false |
| permite_conciliar | can_reconcile | `account_config` | BOOLEAN DEFAULT true |
| tipo_cuenta_id | account_type_id | `account_config` | FK → account_types(id) |
| — | id | `account_config` | BIGSERIAL PK (nuevo) |
| — | property_id | `account_config` | UUID NOT NULL (nuevo) |
| — | bank_account_id | `account_config` | UUID NOT NULL, FK lógico a payment (nuevo) |
| — | display_order | `account_config` | INTEGER DEFAULT 0 (nuevo) |

#### 2. `tipo_cuenta` → `conciliation.account_types`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| nombre | name | VARCHAR(100) NOT NULL |
| descripcion | — | Eliminado (no necesario en PH360) |
| peso_referencia | weight_ref | DECIMAL(3,2) DEFAULT 0.40 |
| peso_descripcion | weight_desc | DECIMAL(3,2) DEFAULT 0.35 |
| peso_valor | weight_val | DECIMAL(3,2) DEFAULT 0.25 |
| longitud_min_referencia | — | Eliminado (se maneja en lógica de negocio) |
| permite_crear_manual | can_create | BOOLEAN DEFAULT false |
| permite_editar | can_edit | BOOLEAN DEFAULT false |
| permite_modificar | — | Eliminado (redundante con can_edit) |
| permite_borrar | can_delete | BOOLEAN DEFAULT false |
| permite_clasificar | can_classify | BOOLEAN DEFAULT true |
| requiere_descripcion | — | Eliminado (se maneja en lógica de negocio) |
| valor_minimo | — | Eliminado (se maneja en lógica de negocio) |
| responde_enter | — | Eliminado (comportamiento frontend) |
| referencia_define_tercero | — | Eliminado (se maneja en lógica de negocio) |
| activo | active | BOOLEAN DEFAULT true |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |
| — | updated_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 3. `centro_costos` → `conciliation.cost_centers`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| centro_costo_id | id | BIGSERIAL PK |
| centro_costo | name | VARCHAR(200) NOT NULL |
| activa | active | BOOLEAN DEFAULT true |
| — | property_id | UUID NOT NULL (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 4. `conceptos` → `conciliation.concepts`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| conceptoid | id | BIGSERIAL PK |
| concepto | name | VARCHAR(200) NOT NULL |
| centro_costo_id | cost_center_id | FK → cost_centers(id) |
| activa | active | BOOLEAN DEFAULT true |
| — | property_id | UUID NOT NULL (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 5. `terceros` → `conciliation.third_parties`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| terceroid | id | BIGSERIAL PK |
| tercero | name | VARCHAR(200) NOT NULL |
| activa | active | BOOLEAN DEFAULT true |
| — | property_id | UUID NOT NULL (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 6. `tercero_descripciones` → `conciliation.third_party_aliases`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| terceroid | third_party_id | FK → third_parties(id) ON DELETE CASCADE |
| descripcion | description | TEXT, nullable |
| referencia | reference | VARCHAR(255), nullable |
| activa | active | BOOLEAN DEFAULT true |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 7. `tipo_mov` → `conciliation.movement_types`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| tipomovid | id | BIGSERIAL PK |
| tipomov | name | VARCHAR(100) NOT NULL |
| activa | active | BOOLEAN DEFAULT true |
| — | property_id | UUID NOT NULL (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 8. `monedas` — No se migra

Se resuelve con `payment.bank_accounts.currency` (VARCHAR(3), ej: 'COP', 'USD').

#### 9. `configuracion_matching` → `conciliation.matching_config`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| tolerancia_valor | tolerance_amount | NUMERIC(16,2) DEFAULT 100.00 |
| similitud_descripcion_minima | min_description_similarity | NUMERIC(3,2) DEFAULT 0.75 |
| peso_fecha | weight_date | NUMERIC(3,2) DEFAULT 0.40 |
| peso_valor | weight_amount | NUMERIC(3,2) DEFAULT 0.40 |
| peso_descripcion | weight_description | NUMERIC(3,2) DEFAULT 0.20 |
| score_minimo_exacto | min_score_exact | NUMERIC(3,2) DEFAULT 0.95 |
| score_minimo_probable | min_score_probable | NUMERIC(3,2) DEFAULT 0.70 |
| palabras_clave_traslado | transfer_keywords | TEXT[] DEFAULT ARRAY[...] |
| activo | active | BOOLEAN DEFAULT true |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| updated_at | updated_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 10. `matching_alias` → `conciliation.matching_aliases`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| cuenta_id | bank_account_id | UUID, FK lógico a payment.bank_accounts |
| patron | original | VARCHAR(500) NOT NULL |
| reemplazo | alias | VARCHAR(500) NOT NULL |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 11. `cuenta_extractores` → `conciliation.account_extractors`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| cuenta_id | bank_account_id | UUID NOT NULL, FK lógico a payment.bank_accounts |
| tipo | type | VARCHAR(20) CHECK ('MOVEMENTS','SUMMARY') |
| modulo | module | VARCHAR(100) NOT NULL |
| orden | priority | INTEGER DEFAULT 1 |
| activo | active | BOOLEAN DEFAULT true |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 12. `regla_clasificacion` → `conciliation.classification_rules`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| patron | pattern | VARCHAR(500) NOT NULL |
| descripcion | — | Eliminado (el patrón es autodescriptivo) |
| tercero_id | third_party_id | FK → third_parties(id) |
| centro_costo_id | cost_center_id | FK → cost_centers(id) |
| concepto_id | concept_id | FK → concepts(id) |
| tipo_match | match_type | VARCHAR(20) DEFAULT 'contains' CHECK (exact, contains, starts_with) |
| cuenta_id | bank_account_id | UUID, FK lógico a payment.bank_accounts |
| — | property_id | UUID NOT NULL (nuevo) |
| — | priority | INTEGER DEFAULT 0 (nuevo) |
| — | active | BOOLEAN DEFAULT true (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 13. `config_filtro_centro_costo` → `conciliation.cost_center_filters`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| centro_costo_id | cost_center_id | FK → cost_centers(id) ON DELETE CASCADE |
| etiqueta | label | VARCHAR(200) NOT NULL |
| activo_por_defecto | active_by_default | BOOLEAN DEFAULT true |
| — | property_id | UUID NOT NULL (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 14. `config_valor_pendiente` → `conciliation.pending_value_config`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| tipo | type | VARCHAR(20) CHECK ('third_party','concept','cost_center') |
| valor_id | value_id | BIGINT NOT NULL |
| descripcion | description | VARCHAR(200) DEFAULT '' |
| activo | active | BOOLEAN DEFAULT true |
| — | property_id | UUID NOT NULL (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 15. `movimientos_encabezado` → `conciliation.movements`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| Id | id | BIGSERIAL PK |
| Fecha | date | DATE NOT NULL |
| Descripcion | description | VARCHAR(500) |
| Referencia | reference | VARCHAR(200) |
| Valor | amount | DECIMAL(18,2) NOT NULL |
| USD | usd | DECIMAL(18,2) DEFAULT 0 |
| TRM | trm | DECIMAL(10,4) DEFAULT 0 |
| trm_provisional | trm_provisional | BOOLEAN DEFAULT true |
| MonedaID | — | Eliminado. Moneda viene de payment.bank_accounts.currency |
| CuentaID | bank_account_id | UUID NOT NULL, FK lógico a payment.bank_accounts |
| terceroid | third_party_id | FK → third_parties(id) |
| Detalle | — | Eliminado (redundante con description) |
| fecha_corte | cut_date | DATE, nullable |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |
| — | source | VARCHAR(50) (nuevo: 'manual','csv','pdf') |
| — | updated_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 16. `movimientos_detalle` → `conciliation.movement_details`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| movimiento_id | movement_id | FK → movements(id) ON DELETE CASCADE |
| centro_costo_id | cost_center_id | FK → cost_centers(id) |
| ConceptoID | concept_id | FK → concepts(id) |
| TerceroID | third_party_id | FK → third_parties(id) |
| Valor | amount | DECIMAL(18,2) NOT NULL |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 17. `movimientos_extracto` → `conciliation.bank_statements`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| cuenta_id | bank_account_id | UUID NOT NULL, FK lógico a payment.bank_accounts |
| year | — | Eliminado (se deriva de date) |
| month | — | Eliminado (se deriva de date) |
| fecha | date | DATE NOT NULL |
| descripcion | description | VARCHAR(500) |
| referencia | reference | VARCHAR(200) |
| valor | amount | DECIMAL(18,2) NOT NULL |
| usd | — | Eliminado (se maneja en movements) |
| trm | — | Eliminado (se maneja en movements) |
| saldo_acumulado | balance | DECIMAL(18,2) |
| numero_linea | — | Eliminado (metadato de parsing) |
| raw_text | source_file | VARCHAR(500) — cambia semántica: nombre del archivo fuente |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 18. `movimiento_vinculaciones` → `conciliation.movement_matches`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| movimiento_extracto_id | bank_statement_id | FK → bank_statements(id) |
| movimiento_sistema_id | movement_id | FK → movements(id) |
| estado | status | VARCHAR(50) — valores: OK, PROBABLE, NO_MATCH |
| score_similitud | total_score | DECIMAL(5,4) |
| score_fecha | score_date | DECIMAL(5,4) |
| score_valor | score_amount | DECIMAL(5,4) |
| score_descripcion | score_description | DECIMAL(5,4) |
| es_traslado | — | Eliminado (se maneja como status o lógica de negocio) |
| cuenta_contraparte_id | — | Eliminado (se maneja en lógica de negocio) |
| vinculacion_contraparte_id | — | Eliminado |
| confirmado_por_usuario | linked_manually | BOOLEAN DEFAULT false |
| fecha_confirmacion | — | Eliminado (se usa created_at) |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| created_by | — | Eliminado (se obtiene del JWT) |
| notas | — | Eliminado |
| — | property_id | UUID NOT NULL (nuevo) |
| — | reconciliation_id | FK → reconciliations(id) (nuevo) |

#### 19. `conciliaciones` → `conciliation.reconciliations`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| cuenta_id | bank_account_id | UUID NOT NULL, FK lógico a payment.bank_accounts |
| year | — | Eliminado (se deriva de period_start) |
| month | — | Eliminado (se deriva de period_start) |
| fecha_corte | period_end | DATE NOT NULL |
| extracto_saldo_anterior | — | Eliminado (se calcula del periodo anterior) |
| extracto_entradas | — | Eliminado (se calcula de bank_statements) |
| extracto_salidas | — | Eliminado (se calcula de bank_statements) |
| extracto_saldo_final | — | Eliminado (se calcula) |
| sistema_entradas | — | Eliminado (se calcula de movements) |
| sistema_salidas | — | Eliminado (se calcula de movements) |
| sistema_saldo_final | — | Eliminado (se calcula) |
| diferencia_saldo | — | Eliminado (se calcula) |
| estado | status | VARCHAR(50) DEFAULT 'pending' |
| datos_extra | — | Eliminado |
| updated_at | updated_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |
| — | period_start | DATE NOT NULL (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

> **Nota**: La tabla `conciliaciones` actual almacena saldos pre-calculados. En PH360 se simplifica: solo almacena periodo y estado. Los saldos se calculan en tiempo real desde `movements` y `bank_statements`.

#### 20. `tipos_gasto` → `budget.expense_types`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| tipo | name | VARCHAR(100) NOT NULL |
| descripcion | — | Eliminado |
| indicador_default | default_indicator | VARCHAR(100) |
| excluir_presupuesto | — | Eliminado (se maneja en lógica de negocio) |
| activo | active | BOOLEAN DEFAULT true |
| keywords | keywords | JSONB DEFAULT '[]' |
| prioridad | priority | INTEGER DEFAULT 0 |
| direccion | direction | VARCHAR(10) DEFAULT 'egreso' |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 21. `indicadores_economicos` → `budget.economic_indicators`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| anio | year | INTEGER NOT NULL |
| codigo | — | Eliminado (se usa name como identificador) |
| nombre | name | VARCHAR(200) NOT NULL |
| valor_porcentaje | value | DECIMAL(8,4) NOT NULL |
| rango_min_smlv | — | Eliminado (se maneja en lógica de negocio) |
| rango_max_smlv | — | Eliminado (se maneja en lógica de negocio) |
| notas | — | Eliminado |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 22. `reglas_presupuesto` → `budget.budget_rules`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| centro_costo_id | cost_center_id | BIGINT, ID lógico (no FK cross-schema) |
| concepto_id | concept_id | BIGINT, ID lógico (no FK cross-schema) |
| tipo_gasto | expense_type | VARCHAR(100) |
| indicador_nombre | indicator_name | VARCHAR(200). Columna actual renombrada de `indicador_codigo` a `indicador_nombre` en v0.0.0007 |
| factor_ajuste | adjustment_factor | DECIMAL(8,4) DEFAULT 0 |
| monto_fijo_mensual | fixed_monthly | DECIMAL(18,2) |
| notas | — | Eliminado |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |
| — | direction | VARCHAR(10) DEFAULT 'egreso' (nuevo) |

#### 23. `presupuestos` → `budget.budgets`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| anio | year | INTEGER NOT NULL |
| nombre | name | VARCHAR(200) |
| estado | status | VARCHAR(50) DEFAULT 'draft' |
| notas | — | Eliminado |
| semaforo_verde_hasta | green_threshold | DECIMAL(5,2) DEFAULT 10.00 — cambia a porcentaje |
| semaforo_amarillo_hasta | yellow_threshold | DECIMAL(5,2) DEFAULT 25.00 — cambia a porcentaje |
| umbral_minimo_mensual | min_monthly_threshold | DECIMAL(18,2) DEFAULT 0 |
| umbral_minimo_anual | min_annual_threshold | DECIMAL(18,2) DEFAULT 0 |
| umbral_no_repetitivo | non_recurring_threshold | INTEGER DEFAULT 4 |
| umbral_estacional | seasonal_threshold | INTEGER DEFAULT 0 |
| umbral_pareto | — | Eliminado |
| version_actual | current_version | INTEGER DEFAULT 1 |
| cifras_en_millones | show_in_millions | BOOLEAN DEFAULT false |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |
| — | active | BOOLEAN DEFAULT false (nuevo) |
| — | updated_at | TIMESTAMP DEFAULT NOW() (nuevo) |

#### 24. `presupuesto_detalle` → `budget.budget_details`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| presupuesto_id | budget_id | FK → budgets(id) ON DELETE CASCADE |
| centro_costo_id | cost_center_id | BIGINT, ID lógico (no FK cross-schema) |
| concepto_id | concept_id | BIGINT, ID lógico (no FK cross-schema) |
| tercero_id | — | Eliminado en schema PH360 |
| mes | month | INTEGER CHECK (1-12) |
| monto_presupuestado | amount | DECIMAL(18,2) DEFAULT 0 |
| monto_ajustado | — | Eliminado (se calcula) |
| monto_base | base_amount | DECIMAL(18,2) DEFAULT 0 |
| tipo | expense_type | VARCHAR(100) |
| direccion | direction | VARCHAR(10) DEFAULT 'egreso' |
| version | version | INTEGER DEFAULT 1 |
| notas | — | Eliminado |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |

#### 25. `presupuesto_versiones` → `budget.budget_versions`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| presupuesto_id | budget_id | FK → budgets(id) ON DELETE CASCADE |
| version | version | INTEGER NOT NULL |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| notas | notes | TEXT |
| lineas_generadas | lines_generated | INTEGER DEFAULT 0 |
| total_presupuestado | total_budgeted | DECIMAL(18,2) DEFAULT 0 |
| anio_fuente | source_year | INTEGER |
| — | property_id | UUID NOT NULL (nuevo) |

#### 26. `trm_cache` → `conciliation.trm_cache`

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| fecha | date | DATE NOT NULL |
| valor | value | NUMERIC(16,6) NOT NULL |
| fuente | source | VARCHAR(100) DEFAULT 'datos.gov.co' |
| created_at | created_at | TIMESTAMP DEFAULT NOW() |
| — | property_id | UUID NOT NULL (nuevo) |
| — | — | UNIQUE(property_id, date) |

#### 27. `perspectivas` → `conciliation.perspectives`

> Tabla agregada en v0.0.0008 (2026-02-26). Permite al usuario definir "perspectivas" de visualización que filtran centros de costo según contexto (SLB, Bosques, Tita, etc.). Cada perspectiva define si incluye o excluye un conjunto de centros de costo.

| Columna actual | Columna PH360 | Notas |
|---------------|---------------|-------|
| id | id | BIGSERIAL PK |
| nombre | name | VARCHAR(100) NOT NULL |
| slug | slug | VARCHAR(100) NOT NULL, UNIQUE(property_id, slug) |
| tipo | type | VARCHAR(10) CHECK ('include', 'exclude') |
| centro_costo_ids | cost_center_ids | BIGINT[] — IDs de centros de costo incluidos/excluidos |
| siempre_excluir_ids | always_exclude_ids | BIGINT[] DEFAULT '{}' — IDs excluidos independientemente del tipo |
| es_defecto | is_default | BOOLEAN DEFAULT false |
| orden | display_order | INTEGER DEFAULT 0 |
| activa | active | BOOLEAN DEFAULT true |
| — | property_id | UUID NOT NULL (nuevo) |
| — | created_at | TIMESTAMP DEFAULT NOW() (nuevo) |

---

## 2. Comparación de Stacks

| Aspecto | Conciliación (actual) | PH360 (destino) |
|---------|----------------------|------------------|
| **Backend** | Python 3.11 + FastAPI 0.109.2 | Java 21 + Spring Boot 3.2.1 |
| **Frontend** | React 19 + TypeScript 5.9 + Vite 7 | Angular 20 + TypeScript 5.8 |
| **BD** | PostgreSQL 17, tabla compartida sin esquemas | PostgreSQL 14+, schema-per-service |
| **ORM** | psycopg2 (SQL raw, sin ORM) | Spring Data JPA + Hibernate |
| **Migraciones** | Scripts SQL manuales | Flyway (versionado) |
| **Arquitectura** | Hexagonal simple | DDD + CQRS + Clean Architecture |
| **Seguridad** | Ninguna (app personal) | JWT (HS512) + RBAC + Multi-tenant |
| **Mensajería** | Ninguna | Spring Cloud Stream (Kafka / GCP Pub/Sub) |
| **Deploy** | Docker Compose simple | Kubernetes (K8s) |
| **Testing** | 0% cobertura | JaCoCo 85% línea / 80% branch |
| **CSS** | TailwindCSS 4 | TailwindCSS 3.4 |
| **API Docs** | Ninguna | Springdoc OpenAPI (Swagger 3.x) |

---

## 3. Decisión: Reescribir en Java + Angular

### Opciones evaluadas

| Factor | Reescribir Java+Angular | Polyglot (Python en K8s) | Separado (conectar por API) |
|--------|------------------------|--------------------------|----------------------------|
| Frontend | Reescribir en Angular (**obligatorio**) | Reescribir en Angular (**obligatorio**) | Mantener React (inconsistente) |
| Backend | Reescribir en Java | Mantener Python | Mantener Python |
| Seguridad JWT/RBAC | **Gratis** (shared-java) | Implementar desde cero | No integrado |
| Multi-tenancy | **Gratis** (shared-java) | Implementar desde cero | No aplica |
| Eventos Kafka/PubSub | **Gratis** (Spring Cloud Stream) | Implementar con lib Python | No integrado |
| Migraciones BD | Flyway (patrón PH360) | Manual (actual) | Sin cambio |
| Mantenimiento largo plazo | **1 stack** | 2 stacks permanentes | 2 apps separadas |
| Esfuerzo | Alto | Medio | Bajo |

### Justificación

1. **El frontend se reescribe de cualquier forma** (React → Angular). Eso representa ~60% del esfuerzo total. La diferencia entre polyglot y reescritura completa es solo el backend.

2. **El backend Java obtiene gratis**: seguridad, multi-tenancy, eventos, resilience4j, testcontainers, JaCoCo, Swagger.

3. **La arquitectura hexagonal actual mapea 1:1 al patrón PH360**:

```
Python (actual)                    →  Java (PH360)
─────────────────────────────────────────────────────
domain/models/                     →  domain/aggregate/
domain/ports/                      →  domain/port/out/
domain/services/                   →  domain/service/
application/services/              →  application/usecase/
infrastructure/api/routers/        →  infrastructure/adapter/in/rest/controller/
infrastructure/database/postgres_* →  infrastructure/adapter/out/persistence/
infrastructure/extractors/         →  infrastructure/adapter/out/persistence/ (o in/)
```

4. **PH360 ya tiene las herramientas equivalentes**:

| Herramienta PH360 | Reemplaza en Conciliación |
|-------------------|--------------------------|
| iText7 | pdfplumber (extracción PDF) |
| Apache POI | openpyxl (Excel) |
| Spring Data JPA | psycopg2 raw SQL |
| MapStruct | Mapeo manual dict→entity |
| Flyway | Migraciones SQL manuales |
| Springdoc OpenAPI | Sin documentación API |
| shared-java (JWT + @RequiresPermission) | Sin seguridad |
| shared-java (Multi-tenancy interceptor) | Sin multi-tenant (se reutiliza `TenantContext` de shared-java con `property_id`, ver sección 3.5) |
| Spring Cloud Stream | Sin eventos |
| Resilience4j | Sin circuit breakers |
| TestContainers + JaCoCo | 0% test coverage |
| @ph360/shared-angular | React httpClient, atoms |

---

## 3.5 Decisión: `property_id` en lugar de `tenant_id` como eje de datos

### Problema con `tenant_id`

En PH360, `tenant_id` identifica a la **compañía administradora** (el tenant del SaaS). Sin embargo, en el contexto de administración de copropiedades:

- Los datos financieros (movimientos, extractos, presupuestos) pertenecen a la **copropiedad** (`property`), no a la administradora
- La copropiedad puede **cambiar de administrador** en cualquier momento
- Si los datos están ligados a `tenant_id`, cambiar de administrador requiere migrar todas las tablas, eventos históricos, read models e índices — un overhead inaceptable

### Solución: `property_id` como eje de datos

| Aspecto | `tenant_id` (descartado) | `property_id` (elegido) |
|---------|--------------------------|------------------------|
| Dueño del dato | Compañía administradora | Copropiedad |
| Cambio de administrador | Migrar millones de filas + eventos | Cambiar 1 registro en tabla de relaciones |
| Eventos Kafka históricos | Quedan con tenant viejo (inválidos) | Siempre correctos |
| Partition key | `tenantId:aggregateId` | `propertyId:aggregateId` |
| Complejidad migración | Alta | Nula |

### Relación Tenant ↔ Property

```
tenant (compañía administradora)  ──── N:M ────  property (copropiedad)
       │                                              │
       │ JWT / autenticación                          │ Eje de datos
       │ Permisos de acceso                           │ Movimientos, extractos, presupuestos
       ▼                                              ▼
  ¿Quién accede?                               ¿De quién son los datos?
```

- El **JWT** sigue portando `tenant_id` (identifica la compañía logueada)
- El frontend envía **`X-Property-ID`** header con la copropiedad seleccionada (ver sección 3.6)
- El sistema valida que el tenant tiene acceso a ese property via IAM (`@RequiresPermission(propertyScoped = true)`)
- **Todas las tablas** de datos usan `property_id` (UUID) como eje de aislamiento
- **Todos los eventos** Kafka llevan `property_id` en el payload y headers
- Se reutiliza **`TenantContext`** de shared-java (almacenando `property_id` como valor). No se crea un `PropertyContext` nuevo para evitar bifurcar shared-java

### Impacto en el diseño

- **18 tablas** usan `property_id` en lugar de `tenant_id` (12 en schema `conciliation`, 6 en schema `budget`)
- **9 eventos** Kafka llevan `property_id` en el payload
- **Interfaz `DomainEvent`**: mantiene `getTenantId()` (estándar PH360). Los records cross-BC (pubsub/) usan `propertyId` sin implementar `DomainEvent`
- **Partition keys**: `propertyId:aggregateId`
- **Índices y UNIQUE constraints**: prefijo `property_id`

---

## 3.6 Flujo HTTP: `X-Property-ID` header

### Patrón PH360 existente

PH360 ya tiene este flujo implementado en el frontend:

1. El usuario se autentica → JWT con `tenant_id` (compañía)
2. El frontend muestra un **Property Selector** (selector de copropiedad)
3. El usuario selecciona una copropiedad → `property_id` se almacena en `PropertyContextService`
4. El **interceptor HTTP** del frontend agrega ambos headers a cada request:
   - `Authorization: Bearer {jwt}` (identifica al tenant/usuario)
   - `X-Property-ID: {property_uuid}` (identifica la copropiedad seleccionada)

### Flujo en el backend

```
Request HTTP
    │
    ├── Header: Authorization → JwtAuthFilter → extrae tenant_id, roles, permisos
    ├── Header: X-Property-ID → TenantFilter → TenantContext.setTenantId(propertyId)
    │
    ▼
Controller
    │
    ├── @RequiresPermission(value = "conciliation.read.movement", propertyScoped = true)
    │   └── PermissionAspect → valida vía IAM que el tenant tiene acceso a ese property_id
    │
    ▼
UseCase / Repository
    │
    └── Queries filtran por property_id (obtenido de TenantContext.getTenantId())
```

**Nota**: `TenantContext` de shared-java almacena el `property_id` (no el `tenant_id` de la compañía). Esto es consistente con el patrón ya implementado en `backend-supplier-invoice` (V11: remove tenant_id, use property_id).

### Frontend Angular — Interceptor

```typescript
// core/interceptors/property.interceptor.ts
// PH360 ya tiene tenant.interceptor.ts que agrega X-Tenant-ID.
// Para conciliation/budget se reutiliza el mismo interceptor,
// ya que X-Tenant-ID = property_id seleccionado en el Property Selector.
export const propertyInterceptor: HttpInterceptorFn = (req, next) => {
  const propertyContext = inject(PropertyContextService);
  const propertyId = propertyContext.currentPropertyId();

  if (propertyId) {
    req = req.clone({
      setHeaders: { 'X-Tenant-ID': propertyId }  // ← Reutiliza header existente
    });
  }
  return next(req);
};
```

### Implicación

No se necesita crear un header nuevo `X-Property-ID` ni un filtro nuevo. Se reutiliza:
- **Header**: `X-Tenant-ID` (ya existente, el frontend ya lo envía con el property_id seleccionado)
- **Filtro**: `TenantFilter` de shared-java (ya extrae el header y lo pone en `TenantContext`)
- **Validación**: `@RequiresPermission(propertyScoped = true)` (ya implementado en shared-java)

---

## 4. Decisión: Dos microservicios coreografiados por eventos

### Problema original: acoplamiento Presupuesto → Movimientos

Presupuesto dependía de **lectura directa** sobre las tablas de movimientos:

| Repositorio Python | Tablas leídas | Tipo de query |
|-------------------|--------------|---------------|
| `PresupuestoGeneracionRepository` | `movimientos_encabezado` + `movimientos_detalle` | CTE + GROUP BY (genera base presupuestal desde histórico) |
| `PresupuestoComparacionRepository` | `movimientos_encabezado` + `movimientos_detalle` | CTE + FULL OUTER JOIN (compara presupuesto vs ejecución real) |
| Dashboard widget | Ambos dominios | Combina estadísticas movimientos + widget presupuesto |

### Solución: Coreografía por eventos + CQRS

Con eventos Kafka/Pub/Sub (patrón ya establecido en PH360), el acoplamiento directo a BD se elimina:

1. **`backend-conciliation`** publica eventos cuando un movimiento se crea, clasifica o elimina
2. **`backend-budget`** consume esos eventos y mantiene su propio **read model** (CQRS) con datos de movimientos agregados
3. Presupuesto genera y compara contra **sus propias tablas**, no contra las de conciliación
4. **Consistencia eventual** — aceptable para presupuestos (no necesita precisión en tiempo real)

```
┌─────────────────────┐         Kafka Topics          ┌─────────────────────┐
│                     │                                │                     │
│  backend-conciliation│   MovementClassifiedEvent     │   backend-budget    │
│                     │ ──────────────────────────────►│                     │
│  Schema:            │   MovementReclassifiedEvent    │  Schema:            │
│  conciliation.*     │ ──────────────────────────────►│  budget.*           │
│                     │   MovementDeletedEvent         │                     │
│  - movements        │ ──────────────────────────────►│  - budgets          │
│  - movement_details │                                │  - budget_details   │
│  - bank_statements  │   BudgetActivatedEvent         │  - budget_rules     │
│  - reconciliations  │ ◄──────────────────────────────│  - expense_types    │
│  - matches          │                                │  - indicators       │
│  - classification   │                                │  - movement_summary │ ← CQRS read model
│  - master data      │                                │    (populated by    │
│                     │                                │     events)         │
└─────────────────────┘                                └─────────────────────┘
```

### Precedente en PH360

PH360 ya implementa este patrón entre `backend-financial` ↔ `backend-payment`:
- Financial publica `InvoiceCreatedEvent` → Payment consume
- Payment publica `AuditEvent(FIFO_ALLOCATION_APPLIED)` → Financial consume y actualiza facturas
- Sagas coreografiadas para: aplicación de pagos, reversiones, notas crédito, balance crédito
- Idempotencia via `ProcessedEventJpaRepository`
- `StreamBridge` + partition keys para ordenamiento por property+aggregate

### Ventajas de dos servicios con eventos

| Aspecto | Un servicio (antes) | Dos servicios + eventos (ahora) |
|---------|--------------------|---------------------------------|
| Acoplamiento | Tablas compartidas en mismo schema | Cada servicio con su schema + read model |
| Escalabilidad | Escalan juntos | Escalan independientemente |
| Deploy | Un solo deploy afecta todo | Deploy independiente |
| Resiliencia | Fallo en presupuesto afecta movimientos | Aislados: si budget cae, conciliation sigue |
| Consistencia | Inmediata (JOINs directos) | Eventual (aceptable para presupuestos) |
| Complejidad | Menor | Mayor (eventos, idempotencia, read model) |
| Patrón PH360 | No sigue el patrón | Consistente con Financial↔Payment |

### Microservicios resultantes

| Servicio | Puerto K8s | Context Path | Schema | Responsabilidad |
|----------|-----------|-------------|--------|-----------------|
| `backend-conciliation` | 30089 | `/api/conciliation` | `conciliation` | Movimientos, extractos, matching, clasificación, maestros |
| `backend-budget` | 30091 | `/api/budget` | `budget` | Presupuestos, reglas, tipos gasto, indicadores, comparación |

---

## 5. Arquitectura de Eventos (Coreografía)

### 5.1 Catálogo de Eventos

#### Conciliation → Budget (Eventos de Movimientos)

| Evento | Topic Kafka | Trigger | Payload clave |
|--------|-------------|---------|---------------|
| `MovementClassifiedEvent` | `conciliation.movement.classified` | Movimiento recibe CC/concepto/tercero | property_id, movement_id, detail_id, cost_center_id, concept_id, third_party_id, amount, date, direction |
| `MovementReclassifiedEvent` | `conciliation.movement.reclassified` | Cambia clasificación de un movimiento | property_id, detail_id, old_cc/concept/third, new_cc/concept/third, amount, date |
| `MovementDeletedEvent` | `conciliation.movement.deleted` | Movimiento eliminado (solo Efectivo) | property_id, movement_id, detail_ids[], amounts[] |
| `MovementAmountUpdatedEvent` | `conciliation.movement.amount-updated` | Monto corregido (ej: TRM definitiva) | property_id, detail_id, old_amount, new_amount |
| `BulkMovementsLoadedEvent` | `conciliation.movement.bulk-loaded` | Carga masiva CSV/PDF | property_id, bank_account_id, count, year, month |

#### Budget → Conciliation (Eventos de Presupuesto)

| Evento | Topic Kafka | Trigger | Payload clave |
|--------|-------------|---------|---------------|
| `BudgetActivatedEvent` | `budget.budget.activated` | Presupuesto activado para un año | property_id, budget_id, year, total_amount |
| `BudgetGeneratedEvent` | `budget.budget.generated` | Generación completada | property_id, budget_id, year, line_count |
| `BudgetOverspendAlertEvent` | `budget.alert.overspend` | CC supera umbral rojo (>25%) | property_id, budget_id, cost_center_id, variance_pct |

#### Budget → Communications (Notificaciones)

| Evento | Topic Kafka | Trigger | Payload clave |
|--------|-------------|---------|---------------|
| `BudgetMonthlyReportEvent` | `budget.report.monthly` | Cierre mensual (scheduled job) | property_id, year, month, summary |

### 5.2 Estructura de Eventos (siguiendo patrón PH360)

```java
// ─── Interfaz base (IDÉNTICA a PH360 — NO modificar) ───
// Nota: mantiene getTenantId() por compatibilidad con shared-java.
// Los eventos cross-BC (records en pubsub/) NO implementan esta interfaz,
// usan propertyId directamente en el record.
public interface DomainEvent {
    UUID getEventId();
    UUID getTenantId();           // Estándar PH360 — no cambiar
    LocalDateTime getOccurredOn();
    String getEventType();
    UUID getAggregateId();
}

// ─── Evento PubSub para comunicación cross-BC (Java Record, NO implementa DomainEvent) ───
public record MovementClassifiedEvent(
    UUID eventId,
    UUID propertyId,              // ← Eje de datos: copropiedad
    UUID movementId,
    UUID detailId,
    Long costCenterId,
    String costCenterName,
    Long conceptId,
    String conceptName,
    Long thirdPartyId,
    String thirdPartyName,
    BigDecimal amount,              // Valor COP (siempre, incluso para USD)
    LocalDate date,
    String direction,               // "egreso" | "ingreso"
    Long accountId,
    Instant occurredOn
) {}

// ─── Evento de reclasificación (para compensar en read model) ───
public record MovementReclassifiedEvent(
    UUID eventId,
    UUID propertyId,
    UUID detailId,
    // Clasificación anterior (para restar del read model)
    Long oldCostCenterId,
    Long oldConceptId,
    Long oldThirdPartyId,
    BigDecimal amount,
    LocalDate date,
    String direction,
    // Clasificación nueva (para sumar al read model)
    Long newCostCenterId,
    Long newConceptId,
    Long newThirdPartyId,
    Instant occurredOn
) {}
```

### 5.3 Publishing Pattern (Conciliation → Kafka)

```java
// ─── Port (application layer) ───
public interface ConciliationEventPublisherPort {
    boolean publishMovementClassified(MovementClassifiedEvent event);
    boolean publishMovementReclassified(MovementReclassifiedEvent event);
    boolean publishMovementDeleted(MovementDeletedEvent event);
    boolean publishMovementAmountUpdated(MovementAmountUpdatedEvent event);
}

// ─── Adapter (infrastructure layer, usa StreamBridge) ───
// Nota: En PH360 los adapters reales con StreamBridge existen en Financial, IAM y Payment
// pero están inactivos por perfil. Se usa @Profile({"kafka"}) para activar
// cuando la infraestructura Kafka esté disponible (consistente con patrón PH360).
@Component
@RequiredArgsConstructor
@Profile({"kafka"})
public class ConciliationEventPublisherAdapter implements ConciliationEventPublisherPort {

    private static final String CLASSIFIED_BINDING = "movement-classified-out-0";
    private final StreamBridge streamBridge;

    @Override
    public boolean publishMovementClassified(MovementClassifiedEvent event) {
        String partitionKey = event.propertyId() + ":" + event.movementId();

        Message<MovementClassifiedEvent> message = MessageBuilder
            .withPayload(event)
            .setHeader("partitionKey", partitionKey)
            .setHeader("event_type", "Conciliation.MovementClassified")
            .setHeader("event_version", "1.0.0")
            .setHeader("source", "conciliation-service")
            .setHeader("property_id", event.propertyId().toString())
            .build();

        return streamBridge.send(CLASSIFIED_BINDING, message);
    }
}
```

### 5.4 Consumption Pattern (Budget ← Kafka)

```java
// ─── Event Handler en backend-budget ───
@Component
@RequiredArgsConstructor
@Profile({"kafka"})
public class MovementClassifiedStreamHandler {

    private final MovementSummaryRepository summaryRepo;
    private final ProcessedEventRepository processedEventRepo;
    private final ObjectMapper objectMapper;

    @Bean
    public Consumer<Message<String>> handleMovementClassified() {
        return message -> {
            MovementClassifiedEvent event = objectMapper.readValue(
                message.getPayload(), MovementClassifiedEvent.class);

            // Idempotencia: no reprocesar
            if (processedEventRepo.existsByEventId(event.eventId())) {
                return;
            }

            // TenantContext: PH360 usa TenantContext de shared-java para aislamiento.
            // En eventos cross-BC se almacena el propertyId como "tenant" del contexto,
            // ya que property_id es el eje real de datos (ver sección 3.5).
            TenantContext.setTenantId(event.propertyId());
            try {
                // Actualizar read model (CQRS)
                summaryRepo.upsertMovementSummary(
                    event.propertyId(),
                    event.date().getYear(),
                    event.date().getMonthValue(),
                    event.costCenterId(),
                    event.conceptId(),
                    event.thirdPartyId(),
                    event.amount(),
                    event.direction()
                );

                // Marcar evento como procesado
                processedEventRepo.save(new ProcessedEvent(
                    event.eventId(), "MovementClassified", Instant.now()
                ));
            } finally {
                TenantContext.clear();
            }
        };
    }
}
```

### 5.5 CQRS Read Model en Budget

El servicio Budget mantiene su propia tabla `movement_summary` alimentada por eventos:

```sql
-- Schema: budget
CREATE TABLE budget.movement_summary (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    cost_center_id  BIGINT,
    concept_id      BIGINT,
    third_party_id  BIGINT,
    direction       VARCHAR(10) NOT NULL,     -- 'egreso' | 'ingreso'
    total_amount    DECIMAL(18,2) DEFAULT 0,  -- Suma de valores COP
    record_count    INTEGER DEFAULT 0,
    last_updated    TIMESTAMP DEFAULT NOW(),

    UNIQUE(property_id, year, month, cost_center_id, concept_id, third_party_id, direction)
);

CREATE INDEX idx_movement_summary_year ON budget.movement_summary(property_id, year);
CREATE INDEX idx_movement_summary_cc ON budget.movement_summary(property_id, year, cost_center_id);
```

**Cómo reemplaza las queries directas:**

| Query original (Python, directo a BD) | Nueva query (Java, sobre read model) |
|---------------------------------------|--------------------------------------|
| `SELECT ... FROM movimientos_encabezado m JOIN movimientos_detalle md ... GROUP BY cc, concepto, mes` | `SELECT ... FROM budget.movement_summary WHERE year = ? GROUP BY cost_center_id, concept_id, month` |
| FULL OUTER JOIN presupuesto_detalle con movimientos | FULL OUTER JOIN budget.budget_details con budget.movement_summary |
| CTE con 3+ tablas para generación | Simple SELECT sobre movement_summary agrupado |

**Beneficio**: Las queries de comparación y generación pasan de CTEs complejos con 3+ JOINs a queries simples sobre una tabla pre-agregada.

### 5.6 Spring Cloud Stream Configuration

```yaml
# backend-conciliation/src/main/resources/application-local.yml
spring:
  cloud:
    function:
      definition: ""  # No consume eventos externos (solo publica)
    stream:
      binders:
        kafka-local:
          type: kafka
          environment:
            spring.kafka.bootstrap-servers: localhost:9092
      output-bindings: movement-classified-out-0;movement-reclassified-out-0;movement-deleted-out-0;movement-amount-updated-out-0
      bindings:
        movement-classified-out-0:
          destination: conciliation.movement.classified
          producer:
            partition-key-expression: headers['partitionKey']
            partition-count: 3
        movement-reclassified-out-0:
          destination: conciliation.movement.reclassified
          producer:
            partition-key-expression: headers['partitionKey']
            partition-count: 3
        movement-deleted-out-0:
          destination: conciliation.movement.deleted
          producer:
            partition-key-expression: headers['partitionKey']
            partition-count: 3
        movement-amount-updated-out-0:
          destination: conciliation.movement.amount-updated
          producer:
            partition-key-expression: headers['partitionKey']
            partition-count: 3

# Umbral para estrategia híbrida de eventos (ver sección 5.10)
conciliation:
  upload:
    bulk-threshold: 50

---
# backend-budget/src/main/resources/application-local.yml
spring:
  cloud:
    function:
      definition: handleMovementClassified;handleMovementReclassified;handleMovementDeleted;handleMovementAmountUpdated;handleBudgetActivated
    stream:
      binders:
        kafka-local:
          type: kafka
          environment:
            spring.kafka.bootstrap-servers: localhost:9092
      output-bindings: budget-activated-out-0;budget-overspend-alert-out-0
      bindings:
        # ─── Consumidores (desde Conciliation) ───
        handleMovementClassified-in-0:
          destination: conciliation.movement.classified
          group: budget-movement-consumer
          consumer:
            max-attempts: 3
            back-off-initial-interval: 1000
            back-off-multiplier: 2.0
        handleMovementReclassified-in-0:
          destination: conciliation.movement.reclassified
          group: budget-movement-consumer
        handleMovementDeleted-in-0:
          destination: conciliation.movement.deleted
          group: budget-movement-consumer
        handleMovementAmountUpdated-in-0:
          destination: conciliation.movement.amount-updated
          group: budget-movement-consumer
        # ─── Productores (hacia Conciliation / Communications) ───
        budget-activated-out-0:
          destination: budget.budget.activated
          producer:
            partition-key-expression: headers['partitionKey']
            partition-count: 3
        budget-overspend-alert-out-0:
          destination: budget.alert.overspend
          producer:
            partition-key-expression: headers['partitionKey']
```

### 5.7 Topic Registry (Kafka)

| Topic | Particiones | Retention | Productor | Consumidor(es) |
|-------|------------|-----------|-----------|-----------------|
| `conciliation.movement.classified` | 3 | 7d | backend-conciliation | backend-budget |
| `conciliation.movement.reclassified` | 3 | 7d | backend-conciliation | backend-budget |
| `conciliation.movement.deleted` | 3 | 7d | backend-conciliation | backend-budget |
| `conciliation.movement.amount-updated` | 3 | 7d | backend-conciliation | backend-budget |
| `conciliation.movement.bulk-loaded` | 1 | 7d | backend-conciliation | backend-budget (rebuild) |
| `budget.budget.activated` | 3 | 7d | backend-budget | backend-conciliation (dashboard) |
| `budget.budget.generated` | 1 | 7d | backend-budget | (logging/audit) |
| `budget.alert.overspend` | 1 | 7d | backend-budget | backend-communications |
| `budget.report.monthly` | 1 | 30d | backend-budget | backend-communications |

### 5.8 Idempotencia y Error Handling

```java
// Tabla en CADA servicio para rastrear eventos procesados
CREATE TABLE {schema}.processed_events (
    id          BIGSERIAL PRIMARY KEY,
    event_id    UUID NOT NULL UNIQUE,
    event_type  VARCHAR(200) NOT NULL,
    processed_at TIMESTAMP DEFAULT NOW(),
    payload     JSONB           -- Para auditoría
);

CREATE INDEX idx_processed_events_id ON {schema}.processed_events(event_id);
```

**Flujo de error:**
1. Handler procesa evento dentro de `@Transactional`
2. Si falla → RuntimeException → Spring Cloud Stream reintenta (max 3, backoff exponencial)
3. Si sigue fallando → Dead Letter Topic (`{topic}.DLT`)
4. Monitoreo: alertas en DLT para intervención manual

### 5.9 Rebuild del Read Model (Saga de Reconstrucción)

Cuando el read model de Budget necesita reconstruirse (bug, nuevo campo, datos perdidos):

1. Conciliation publica `BulkMovementsLoadedEvent` con metadata del batch
2. Budget consume y solicita un **snapshot completo** via HTTP (fallback sync):
   - `GET /api/conciliation/internal/movement-summary?year=2026` (endpoint interno, no público)
3. Budget trunca su `movement_summary` para ese año y recarga desde snapshot
4. Alternativamente: replay de eventos Kafka desde offset más antiguo

```java
// Endpoint interno en backend-conciliation (no expuesto en Swagger público)
@RestController
@RequestMapping("/internal")
@RequiresPermission("system.internal")
public class InternalController {

    @GetMapping("/movement-summary")
    public List<MovementSummaryDTO> getMovementSummary(
        @RequestParam int year,
        @RequestParam(required = false) String direction
    ) {
        // Retorna datos agregados por CC/concepto/tercero/mes
        // Para reconstrucción del read model de Budget
    }
}
```

### 5.10 Estrategia de Publicación de Eventos en Carga Masiva

**Fecha de decisión**: 2026-02-21
**Resuelve**: Decisión pendiente #8

#### Problema

Al cargar movimientos desde CSV/Excel, el sistema debe notificar a Budget para actualizar su read model (`movement_summary`). Dos extremos posibles:

- **Solo eventos individuales**: 500 movimientos → 500 `MovementClassifiedEvent`. Riesgo de saturar Kafka, backpressure en consumer, y si 1 de 500 falla (DLT) el read model queda parcialmente inconsistente.
- **Solo BulkMovementsLoadedEvent + rebuild HTTP**: Para 3 movimientos es excesivo (truncar y reconstruir toda la tabla de un mes). Introduce acoplamiento temporal con el endpoint HTTP de conciliation.

#### Decisión: Enfoque híbrido con umbral configurable

| Escenario | Mecanismo | Razón |
|-----------|-----------|-------|
| Carga **< 50 movimientos** | N eventos individuales (`MovementClassifiedEvent`) | Read model se actualiza incrementalmente, sin latencia perceptible |
| Carga **>= 50 movimientos** | 1 `BulkMovementsLoadedEvent` + rebuild HTTP | Evita saturar Kafka, consistencia garantizada via rebuild |

#### Configuración del umbral

El umbral se configura en `application.yml` (no en BD ni JSON):

```yaml
# backend-conciliation/src/main/resources/application.yml
conciliation:
  upload:
    bulk-threshold: 50
```

**Justificación de `application.yml`**:
- Es un parámetro **técnico** (no de negocio): el usuario final no necesita cambiarlo
- Rara vez cambia: se ajusta una vez en las primeras semanas y queda estable
- Consistente con el patrón PH360 (ej: `financial.interest.default-annual-rate` en backend-financial)
- No justifica crear tabla en BD (overhead de schema, migración, endpoint CRUD para un solo valor)
- JSON no es patrón de PH360 y agrega complejidad en K8s (volumen o ConfigMap)

#### Implementación en `UploadMovementsUseCaseImpl`

```java
@Service
@RequiredArgsConstructor
public class UploadMovementsUseCaseImpl implements UploadMovementsUseCase {

    @Value("${conciliation.upload.bulk-threshold:50}")
    private int bulkThreshold;

    private final ExcelImportService excelImportService;
    private final MovementRepository repository;
    private final ConciliationEventPublisherPort eventPublisher;

    @Override
    @Transactional
    public UploadResult execute(UploadMovementsCommand command) {
        List<Movement> movements = excelImportService.parse(command.getFile());
        repository.saveAll(movements);

        if (movements.size() < bulkThreshold) {
            // Eventos individuales → read model se actualiza incrementalmente
            movements.forEach(m -> eventPublisher.publish(
                new MovementClassifiedEvent(m)
            ));
        } else {
            // Evento bulk → budget hará rebuild via HTTP (ver sección 5.9)
            eventPublisher.publish(new BulkMovementsLoadedEvent(
                command.getPropertyId(),
                command.getAccountId(),
                movements.size(),
                command.getYear(),
                command.getMonth()
            ));
        }
        return new UploadResult(movements.size());
    }
}
```

#### Consumer en Budget (BulkMovementsLoadedEvent)

El handler de `BulkMovementsLoadedEvent` en budget realiza rebuild parcial (solo el mes afectado, no el año completo):

```java
// Usa modelo funcional (Consumer<Message<T>>), consistente con sección 5.4.
// @StreamListener está deprecado en Spring Cloud Stream 4.x (Spring Boot 3.2.x).
@Bean
public Consumer<Message<String>> handleBulkMovementsLoaded() {
    return message -> {
        BulkMovementsLoadedEvent event = objectMapper.readValue(
            message.getPayload(), BulkMovementsLoadedEvent.class);

        TenantContext.setTenantId(event.propertyId());
        try {
            var summary = conciliationClient.getMovementSummary(
                event.propertyId(), event.year()
            );
            // Trunca solo el mes afectado, no el año completo
            movementSummaryRepository.deleteByPropertyAndYearAndMonth(
                event.propertyId(), event.year(), event.month()
            );
            movementSummaryRepository.saveAll(summary);
        } finally {
            TenantContext.clear();
        }
    };
}
```

---

## 6. Arquitectura de los Microservicios

### 6.1 Estructura Backend

#### backend-conciliation (Movimientos, Extractos, Matching, Clasificación)

```
PH360/backend-conciliation/
├── src/main/java/com/ph360/conciliation/
│   ├── domain/
│   │   ├── aggregate/
│   │   │   ├── movement/               ← Movimiento (encabezado + detalle)
│   │   │   │   ├── Movement.java
│   │   │   │   ├── MovementDetail.java
│   │   │   │   └── MovementStatus.java
│   │   │   ├── bankstatement/           ← Extracto bancario
│   │   │   │   ├── BankStatement.java
│   │   │   │   └── BankStatementLine.java
│   │   │   ├── reconciliation/          ← Conciliación + matching
│   │   │   │   ├── Reconciliation.java
│   │   │   │   └── MovementMatch.java
│   │   │   ├── classification/          ← Reglas de clasificación
│   │   │   │   └── ClassificationRule.java
│   │   │   └── masterdata/              ← Maestros de conciliación
│   │   │       ├── AccountConfig.java   ← Extensión de payment.bank_accounts
│   │   │       ├── CostCenter.java
│   │   │       ├── Concept.java            ← Gasto e ingreso, dependiente de CostCenter
│   │   │       └── ThirdParty.java
│   │   ├── port/
│   │   │   ├── in/                      ← Use Cases (driving ports)
│   │   │   │   ├── LoadMovementsUseCase.java
│   │   │   │   ├── LoadBankStatementUseCase.java
│   │   │   │   ├── ExecuteMatchingUseCase.java
│   │   │   │   ├── ClassifyMovementsUseCase.java
│   │   │   │   └── GetConciliationDashboardUseCase.java
│   │   │   └── out/                     ← Repository + Event publisher ports
│   │   │       ├── MovementRepository.java
│   │   │       ├── BankStatementRepository.java
│   │   │       ├── ReconciliationRepository.java
│   │   │       ├── ClassificationRuleRepository.java
│   │   │       ├── AccountConfigRepository.java
│   │   │       ├── MasterDataRepository.java         ← CC, conceptos, terceros
│   │   │       └── ConciliationEventPublisherPort.java  ← Publica a Kafka
│   │   ├── service/
│   │   │   ├── MatchingAlgorithmService.java   ← Scoring: fecha, valor, descripción
│   │   │   ├── ClassificationService.java      ← 5 niveles: reglas→ref→semántica→valor→FondoRenta
│   │   │   └── ReconciliationService.java      ← Integridad 1-a-1
│   │   ├── valueobject/
│   │   │   ├── MatchScore.java
│   │   │   ├── ClassificationResult.java
│   │   │   └── Money.java
│   │   ├── event/
│   │   │   ├── pubsub/                         ← Eventos cross-BC (Java records)
│   │   │   │   ├── MovementClassifiedEvent.java
│   │   │   │   ├── MovementReclassifiedEvent.java
│   │   │   │   ├── MovementDeletedEvent.java
│   │   │   │   ├── MovementAmountUpdatedEvent.java
│   │   │   │   └── BulkMovementsLoadedEvent.java
│   │   │   └── ReconciliationCompletedEvent.java ← Evento interno
│   │   └── exception/
│   │       ├── MovementNotFoundException.java
│   │       └── InvalidAccountTypeException.java
│   │
│   ├── application/
│   │   ├── usecase/
│   │   │   ├── movement/
│   │   │   │   ├── CreateMovementUseCaseImpl.java
│   │   │   │   ├── ListMovementsUseCaseImpl.java
│   │   │   │   ├── UploadMovementsUseCaseImpl.java
│   │   │   │   └── ClassifyMovementUseCaseImpl.java  ← Publica MovementClassifiedEvent
│   │   │   ├── bankstatement/
│   │   │   │   └── LoadBankStatementUseCaseImpl.java
│   │   │   ├── matching/
│   │   │   │   ├── ExecuteMatchingUseCaseImpl.java
│   │   │   │   └── LinkMovementsUseCaseImpl.java
│   │   │   └── classification/
│   │   │       ├── AutoClassifyUseCaseImpl.java      ← Publica N eventos clasificación
│   │   │       └── SuggestReclassificationUseCaseImpl.java
│   │   ├── eventhandler/
│   │   │   └── BudgetActivatedStreamHandler.java     ← Consume BudgetActivatedEvent
│   │   ├── command/
│   │   │   ├── ClassifyMovementCommand.java
│   │   │   └── ExecuteMatchingCommand.java
│   │   ├── dto/
│   │   │   ├── MovementDTO.java
│   │   │   └── DashboardStatsDTO.java
│   │   └── service/
│   │       ├── PdfExtractorService.java
│   │       ├── ExcelImportService.java
│   │       └── TrmService.java
│   │
│   └── infrastructure/
│       ├── adapter/
│       │   ├── in/
│       │   │   ├── rest/controller/
│       │   │   │   ├── MovementController.java
│       │   │   │   ├── BankStatementController.java
│       │   │   │   ├── ReconciliationController.java
│       │   │   │   ├── ClassificationController.java
│       │   │   │   ├── DashboardController.java       ← Solo stats movimientos
│       │   │   │   ├── AccountConfigController.java
│       │   │   │   ├── CostCenterController.java
│       │   │   │   ├── CatalogController.java
│       │   │   │   └── InternalController.java        ← Endpoint rebuild read model
│       │   │   └── messaging/
│       │   │       └── BudgetActivatedConsumer.java   ← Consumer Spring Cloud Stream
│       │   └── out/
│       │       ├── persistence/                       ← JPA entities + repos + adapters
│       │       ├── messaging/
│       │       │   ├── ConciliationEventPublisherAdapter.java  ← StreamBridge
│       │       │   └── ConciliationEventPublisherNoOpAdapter.java ← Default cuando events deshabilitados
│       │       └── http/
│       │           └── TrmApiClient.java
│       ├── config/
│       └── exception/
│
├── src/main/resources/
│   ├── db/migration/
│   │   ├── V1__create_conciliation_schema.sql
│   │   ├── V2__create_master_tables.sql         ← accounts, cost_centers, concepts, third_parties
│   │   ├── V3__create_movements_tables.sql
│   │   ├── V4__create_bank_statements.sql
│   │   ├── V5__create_reconciliation.sql
│   │   ├── V6__create_classification.sql
│   │   └── V7__create_processed_events.sql      ← Idempotencia
│   ├── application.yml
│   ├── application-local.yml                     ← Kafka bindings
│   └── application-kafka.yml
│
├── src/test/
│   ├── java/com/ph360/conciliation/
│   │   ├── domain/service/
│   │   │   ├── MatchingAlgorithmServiceTest.java
│   │   │   └── ClassificationServiceTest.java
│   │   ├── application/usecase/
│   │   └── infrastructure/adapter/
│   └── resources/test-data/
│
└── pom.xml
```

#### backend-budget (Presupuestos, Reglas, Comparación)

```
PH360/backend-budget/
├── src/main/java/com/ph360/budget/
│   ├── domain/
│   │   ├── aggregate/
│   │   │   ├── budget/
│   │   │   │   ├── Budget.java
│   │   │   │   ├── BudgetDetail.java
│   │   │   │   └── BudgetVersion.java              ← Historial de versiones generadas
│   │   │   ├── budgetrule/
│   │   │   │   └── BudgetRule.java
│   │   │   ├── expensetype/
│   │   │   │   └── ExpenseType.java
│   │   │   └── economicindicator/
│   │   │       └── EconomicIndicator.java
│   │   ├── port/
│   │   │   ├── in/
│   │   │   │   ├── GenerateBudgetUseCase.java
│   │   │   │   ├── CompareBudgetUseCase.java
│   │   │   │   ├── CompareVersionsUseCase.java      ← Comparar dos versiones de presupuesto
│   │   │   │   ├── AdjustBudgetUseCase.java
│   │   │   │   └── GetBudgetDashboardUseCase.java
│   │   │   └── out/
│   │   │       ├── BudgetRepository.java
│   │   │       ├── BudgetDetailRepository.java
│   │   │       ├── BudgetVersionRepository.java
│   │   │       ├── BudgetRuleRepository.java
│   │   │       ├── ExpenseTypeRepository.java
│   │   │       ├── EconomicIndicatorRepository.java
│   │   │       ├── MovementSummaryRepository.java   ← CQRS read model
│   │   │       └── BudgetEventPublisherPort.java    ← Publica a Kafka
│   │   ├── service/
│   │   │   ├── BudgetGenerationService.java         ← Fórmula: base × (1 + (ind + ajuste) / 100)
│   │   │   └── BudgetComparisonService.java         ← Ppto vs Real usando movement_summary
│   │   ├── valueobject/
│   │   │   ├── BudgetComparison.java
│   │   │   └── SemaphoreLevel.java                  ← verde/amarillo/rojo
│   │   ├── event/
│   │   │   └── pubsub/
│   │   │       ├── BudgetActivatedEvent.java
│   │   │       ├── BudgetGeneratedEvent.java
│   │   │       └── BudgetOverspendAlertEvent.java
│   │   └── exception/
│   │       └── BudgetAlreadyExistsException.java
│   │
│   ├── application/
│   │   ├── usecase/
│   │   │   ├── GenerateBudgetUseCaseImpl.java       ← Usa movement_summary (no JOINs directos)
│   │   │   ├── CompareBudgetUseCaseImpl.java        ← FULL OUTER JOIN local
│   │   │   ├── AdjustBudgetUseCaseImpl.java
│   │   │   └── GetBudgetDashboardUseCaseImpl.java
│   │   ├── eventhandler/                            ← Consumers de eventos Conciliation
│   │   │   ├── MovementClassifiedStreamHandler.java ← Actualiza movement_summary
│   │   │   ├── MovementReclassifiedStreamHandler.java
│   │   │   ├── MovementDeletedStreamHandler.java
│   │   │   ├── MovementAmountUpdatedStreamHandler.java
│   │   │   └── BulkMovementsLoadedStreamHandler.java ← Trigger rebuild read model
│   │   ├── command/
│   │   │   └── GenerateBudgetCommand.java
│   │   ├── dto/
│   │   │   ├── BudgetPreviewDTO.java
│   │   │   ├── BudgetComparisonDTO.java
│   │   │   └── BudgetWidgetDTO.java
│   │   └── service/
│   │       └── ReadModelRebuildService.java         ← Reconstrucción via HTTP fallback
│   │
│   └── infrastructure/
│       ├── adapter/
│       │   ├── in/
│       │   │   ├── rest/controller/
│       │   │   │   ├── BudgetController.java
│       │   │   │   ├── BudgetRuleController.java
│       │   │   │   ├── ExpenseTypeController.java
│       │   │   │   ├── EconomicIndicatorController.java
│       │   │   │   └── BudgetDashboardController.java ← Widget presupuesto
│       │   │   └── messaging/                        ← Consumers Spring Cloud Stream
│       │   │       ├── MovementClassifiedConsumer.java
│       │   │       ├── MovementReclassifiedConsumer.java
│       │   │       ├── MovementDeletedConsumer.java
│       │   │       └── MovementAmountUpdatedConsumer.java
│       │   └── out/
│       │       ├── persistence/
│       │       │   ├── entity/
│       │       │   │   ├── BudgetEntity.java
│       │       │   │   ├── BudgetDetailEntity.java
│       │       │   │   ├── MovementSummaryEntity.java   ← CQRS read model
│       │       │   │   └── ProcessedEventEntity.java    ← Idempotencia
│       │       │   ├── repository/
│       │       │   │   ├── BudgetJpaRepository.java
│       │       │   │   ├── MovementSummaryJpaRepository.java
│       │       │   │   └── ProcessedEventJpaRepository.java
│       │       │   ├── adapter/
│       │       │   └── mapper/
│       │       ├── messaging/
│       │       │   ├── BudgetEventPublisherAdapter.java
│       │       │   └── BudgetEventPublisherNoOpAdapter.java
│       │       └── http/
│       │           └── ConciliationApiClient.java    ← HTTP fallback para rebuild (usa RestClient de shared-java, NO OpenFeign)
│       ├── config/
│       └── exception/
│
├── src/main/resources/
│   ├── db/migration/
│   │   ├── V1__create_budget_schema.sql
│   │   ├── V2__create_budgets.sql
│   │   ├── V3__create_budget_versions.sql           ← Historial de versiones
│   │   ├── V4__create_budget_rules.sql
│   │   ├── V5__create_expense_types.sql
│   │   ├── V6__create_economic_indicators.sql
│   │   ├── V7__create_movement_summary.sql          ← CQRS read model
│   │   ├── V8__create_processed_events.sql          ← Idempotencia
│   │   └── V9__seed_expense_types.sql
│   ├── application.yml
│   ├── application-local.yml
│   └── application-kafka.yml
│
├── src/test/
│   ├── java/com/ph360/budget/
│   │   ├── domain/service/
│   │   │   ├── BudgetGenerationServiceTest.java
│   │   │   └── BudgetComparisonServiceTest.java
│   │   ├── application/eventhandler/
│   │   │   └── MovementClassifiedStreamHandlerTest.java
│   │   └── infrastructure/
│   └── resources/test-data/
│
└── pom.xml
```

### 6.2 Schemas de BD (separados por servicio)

```sql
CREATE SCHEMA IF NOT EXISTS conciliation;

-- ═══════════════════════════════════════════════
-- MAESTROS (específicos del módulo de conciliación)
-- ═══════════════════════════════════════════════

-- Tipos de cuenta con permisos
CREATE TABLE conciliation.account_types (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    name            VARCHAR(100) NOT NULL,         -- ej: "Bancaria", "Efectivo", "Tarjeta", "Inversiones"
    can_create      BOOLEAN DEFAULT false,         -- Solo Efectivo = true
    can_edit        BOOLEAN DEFAULT false,
    can_delete      BOOLEAN DEFAULT false,
    can_classify    BOOLEAN DEFAULT true,
    weight_ref      DECIMAL(3,2) DEFAULT 0.40,     -- Peso referencia en clasificación
    weight_desc     DECIMAL(3,2) DEFAULT 0.35,     -- Peso descripción
    weight_val      DECIMAL(3,2) DEFAULT 0.25,     -- Peso valor
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

-- Configuración de cuentas bancarias (extensión de payment.bank_accounts, ver sección 16.4)
CREATE TABLE conciliation.account_config (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    bank_account_id UUID NOT NULL,                     -- FK lógico a payment.bank_accounts.id (no FK real cross-schema)
    account_type_id BIGINT REFERENCES conciliation.account_types(id),
    can_upload      BOOLEAN DEFAULT false,             -- Permite carga de extractos/movimientos
    can_reconcile   BOOLEAN DEFAULT true,              -- Permite conciliación
    display_order   INTEGER DEFAULT 0,                 -- Orden en UI
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(property_id, bank_account_id)
);
CREATE INDEX idx_account_config_bank ON conciliation.account_config(bank_account_id);

-- Centros de costo
CREATE TABLE conciliation.cost_centers (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Conceptos (gasto e ingreso), dependientes de centro de costo
CREATE TABLE conciliation.concepts (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    cost_center_id  BIGINT REFERENCES conciliation.cost_centers(id),
    name            VARCHAR(200) NOT NULL,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- Terceros
CREATE TABLE conciliation.third_parties (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- MOVIMIENTOS
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.movements (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    bank_account_id UUID NOT NULL,                    -- FK lógico a payment.bank_accounts.id
    third_party_id  BIGINT REFERENCES conciliation.third_parties(id),
    date            DATE NOT NULL,
    description     VARCHAR(500),
    reference       VARCHAR(200),
    amount          DECIMAL(18,2) NOT NULL,        -- COP (positivo=ingreso, negativo=egreso)
    usd             DECIMAL(18,2) DEFAULT 0,       -- Monto en USD (cuentas dólar)
    trm             DECIMAL(10,4) DEFAULT 0,       -- Tasa de cambio
    trm_provisional BOOLEAN DEFAULT true,
    cut_date        DATE,                          -- Fecha de corte (ciclo TC)
    source          VARCHAR(50),                   -- 'manual', 'csv', 'pdf'
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conciliation.movement_details (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    movement_id     BIGINT REFERENCES conciliation.movements(id) ON DELETE CASCADE,
    cost_center_id  BIGINT REFERENCES conciliation.cost_centers(id),
    concept_id      BIGINT REFERENCES conciliation.concepts(id),
    third_party_id  BIGINT REFERENCES conciliation.third_parties(id),
    amount          DECIMAL(18,2) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- EXTRACTOS BANCARIOS
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.bank_statements (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    bank_account_id UUID NOT NULL,                     -- FK lógico a payment.bank_accounts.id
    date            DATE NOT NULL,
    description     VARCHAR(500),
    reference       VARCHAR(200),
    amount          DECIMAL(18,2) NOT NULL,
    balance         DECIMAL(18,2),
    source_file     VARCHAR(500),
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- CONCILIACIÓN Y MATCHING
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.reconciliations (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    bank_account_id UUID NOT NULL,                     -- FK lógico a payment.bank_accounts.id
    period_start    DATE NOT NULL,
    period_end      DATE NOT NULL,
    status          VARCHAR(50) DEFAULT 'pending',
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conciliation.movement_matches (
    id                  BIGSERIAL PRIMARY KEY,
    property_id           UUID NOT NULL,
    reconciliation_id   BIGINT REFERENCES conciliation.reconciliations(id),
    movement_id         BIGINT REFERENCES conciliation.movements(id),
    bank_statement_id   BIGINT REFERENCES conciliation.bank_statements(id),
    score_date          DECIMAL(5,4),              -- 0 o 1
    score_amount        DECIMAL(5,4),              -- 0 a 1
    score_description   DECIMAL(5,4),              -- 0 a 1 (SequenceMatcher)
    total_score         DECIMAL(5,4),              -- Ponderado
    status              VARCHAR(50),               -- OK ≥0.95, PROBABLE ≥0.70, NO_MATCH
    linked_manually     BOOLEAN DEFAULT false,
    created_at          TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- CLASIFICACIÓN
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.classification_rules (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    bank_account_id UUID,                              -- FK lógico a payment.bank_accounts.id (nullable = todas las cuentas)
    pattern         VARCHAR(500) NOT NULL,         -- Patrón de búsqueda
    match_type      VARCHAR(20) DEFAULT 'contains' CHECK (match_type IN ('exact', 'contains', 'starts_with')),
    cost_center_id  BIGINT REFERENCES conciliation.cost_centers(id),
    concept_id      BIGINT REFERENCES conciliation.concepts(id),
    third_party_id  BIGINT REFERENCES conciliation.third_parties(id),
    priority        INTEGER DEFAULT 0,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE conciliation.matching_aliases (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    bank_account_id UUID,                              -- FK lógico a payment.bank_accounts.id (nullable = todas las cuentas)
    original        VARCHAR(500) NOT NULL,
    alias           VARCHAR(500) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- ALIASES DE TERCEROS (tercero_descripciones)
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.third_party_aliases (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    third_party_id  BIGINT REFERENCES conciliation.third_parties(id) ON DELETE CASCADE,
    description     TEXT,                              -- Descripción alternativa del tercero
    reference       VARCHAR(255),                      -- Referencia bancaria asociada
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- TIPOS DE MOVIMIENTO (tipo_mov)
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.movement_types (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    name            VARCHAR(100) NOT NULL,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- CACHE TRM (trm_cache)
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.trm_cache (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    date            DATE NOT NULL,
    value           NUMERIC(16,6) NOT NULL,            -- TRM en pesos por USD
    source          VARCHAR(100) DEFAULT 'datos.gov.co',
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(property_id, date)
);

-- ═══════════════════════════════════════════════
-- CONFIGURACIÓN DE MATCHING (configuracion_matching)
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.matching_config (
    id                          BIGSERIAL PRIMARY KEY,
    property_id                 UUID NOT NULL,
    tolerance_amount            NUMERIC(16,2) NOT NULL DEFAULT 100.00,
    min_description_similarity  NUMERIC(3,2) NOT NULL DEFAULT 0.75,
    weight_date                 NUMERIC(3,2) NOT NULL DEFAULT 0.40,
    weight_amount               NUMERIC(3,2) NOT NULL DEFAULT 0.40,
    weight_description          NUMERIC(3,2) NOT NULL DEFAULT 0.20,
    min_score_exact             NUMERIC(3,2) NOT NULL DEFAULT 0.95,
    min_score_probable          NUMERIC(3,2) NOT NULL DEFAULT 0.70,
    transfer_keywords           TEXT[] DEFAULT ARRAY['TRANSFERENCIA','TRASLADO','CTA','VIRTUAL','FONDO','INVERSION'],
    active                      BOOLEAN DEFAULT true,
    created_at                  TIMESTAMP DEFAULT NOW(),
    updated_at                  TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- EXTRACTORES POR CUENTA (cuenta_extractores)
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.account_extractors (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    bank_account_id UUID NOT NULL,                     -- FK lógico a payment.bank_accounts.id
    type            VARCHAR(20) NOT NULL CHECK (type IN ('MOVEMENTS', 'SUMMARY')),
    module          VARCHAR(100) NOT NULL,             -- Clase/módulo extractor (ej: 'BancolombiaPdfExtractor')
    priority        INTEGER DEFAULT 1,
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- FILTROS DE CENTRO DE COSTO (config_filtro_centro_costo)
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.cost_center_filters (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    cost_center_id  BIGINT REFERENCES conciliation.cost_centers(id) ON DELETE CASCADE,
    label           VARCHAR(200) NOT NULL,             -- Etiqueta para UI
    active_by_default BOOLEAN DEFAULT true,            -- Visible por defecto en dashboards
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- VALORES PENDIENTES (config_valor_pendiente)
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.pending_value_config (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    type            VARCHAR(20) NOT NULL CHECK (type IN ('third_party', 'concept', 'cost_center')),
    value_id        BIGINT NOT NULL,                   -- ID del tercero, concepto o CC marcado como "pendiente"
    description     VARCHAR(200) DEFAULT '',
    active          BOOLEAN DEFAULT true,
    created_at      TIMESTAMP DEFAULT NOW()
);

-- ═══════════════════════════════════════════════
-- PERSPECTIVAS DE VISUALIZACIÓN (perspectivas)
-- Agregada v0.0.0008 (2026-02-26)
-- ═══════════════════════════════════════════════

CREATE TABLE conciliation.perspectives (
    id                  BIGSERIAL PRIMARY KEY,
    property_id         UUID NOT NULL,
    name                VARCHAR(100) NOT NULL,             -- Ej: "SLB", "Bosques", "Tita"
    slug                VARCHAR(100) NOT NULL,             -- Identificador URL-safe
    type                VARCHAR(10) NOT NULL CHECK (type IN ('include', 'exclude')),
    cost_center_ids     BIGINT[] DEFAULT '{}',             -- IDs de centros de costo incluidos o excluidos
    always_exclude_ids  BIGINT[] DEFAULT '{}',             -- IDs siempre excluidos (independiente del tipo)
    is_default          BOOLEAN DEFAULT false,             -- Solo una perspectiva es default por property_id
    display_order       INTEGER DEFAULT 0,
    active              BOOLEAN DEFAULT true,
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(property_id, slug)
);

```

#### Schema `budget` (backend-budget)

```sql
CREATE SCHEMA IF NOT EXISTS budget;

-- ═══════════════════════════════════════════════
-- CQRS READ MODEL (alimentado por eventos Kafka)
-- ═══════════════════════════════════════════════

-- Tabla agregada de movimientos, actualizada por eventos de Conciliation
CREATE TABLE budget.movement_summary (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    year            INTEGER NOT NULL,
    month           INTEGER NOT NULL,
    cost_center_id  BIGINT,
    cost_center_name VARCHAR(200),                  -- Desnormalizado del evento
    concept_id      BIGINT,
    concept_name    VARCHAR(200),                    -- Desnormalizado del evento
    third_party_id  BIGINT,
    third_party_name VARCHAR(200),                   -- Desnormalizado del evento
    direction       VARCHAR(10) NOT NULL,            -- 'egreso' | 'ingreso'
    total_amount    DECIMAL(18,2) DEFAULT 0,
    record_count    INTEGER DEFAULT 0,
    last_updated    TIMESTAMP DEFAULT NOW(),
    UNIQUE(property_id, year, month, cost_center_id, concept_id, third_party_id, direction)
);

CREATE INDEX idx_ms_year ON budget.movement_summary(property_id, year);
CREATE INDEX idx_ms_cc ON budget.movement_summary(property_id, year, cost_center_id);

-- Idempotencia para eventos procesados
CREATE TABLE budget.processed_events (
    id              BIGSERIAL PRIMARY KEY,
    event_id        UUID NOT NULL UNIQUE,
    event_type      VARCHAR(200) NOT NULL,
    processed_at    TIMESTAMP DEFAULT NOW(),
    payload         JSONB
);

-- ═══════════════════════════════════════════════
-- PRESUPUESTO
-- ═══════════════════════════════════════════════

CREATE TABLE budget.expense_types (
    id                  BIGSERIAL PRIMARY KEY,
    property_id           UUID NOT NULL,
    name                VARCHAR(100) NOT NULL,
    direction           VARCHAR(10) DEFAULT 'egreso',
    default_indicator   VARCHAR(100),
    keywords            JSONB DEFAULT '[]',
    priority            INTEGER DEFAULT 0,
    active              BOOLEAN DEFAULT true,
    created_at          TIMESTAMP DEFAULT NOW()
);

CREATE TABLE budget.economic_indicators (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    name            VARCHAR(200) NOT NULL,
    year            INTEGER NOT NULL,
    value           DECIMAL(8,4) NOT NULL,
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE budget.budgets (
    id                      BIGSERIAL PRIMARY KEY,
    property_id               UUID NOT NULL,
    year                    INTEGER NOT NULL,
    name                    VARCHAR(200),
    status                  VARCHAR(50) DEFAULT 'draft',
    active                  BOOLEAN DEFAULT false,
    green_threshold         DECIMAL(5,2) DEFAULT 10.00,
    yellow_threshold        DECIMAL(5,2) DEFAULT 25.00,
    min_monthly_threshold   DECIMAL(18,2) DEFAULT 0,
    min_annual_threshold    DECIMAL(18,2) DEFAULT 0,
    non_recurring_threshold INTEGER DEFAULT 4,
    seasonal_threshold      INTEGER DEFAULT 0,
    show_in_millions        BOOLEAN DEFAULT false,
    current_version         INTEGER DEFAULT 1,         -- Versión activa del presupuesto
    created_at              TIMESTAMP DEFAULT NOW(),
    updated_at              TIMESTAMP DEFAULT NOW()
);

-- Historial de versiones generadas por presupuesto
CREATE TABLE budget.budget_versions (
    id                  BIGSERIAL PRIMARY KEY,
    property_id           UUID NOT NULL,
    budget_id           BIGINT REFERENCES budget.budgets(id) ON DELETE CASCADE,
    version             INTEGER NOT NULL,
    lines_generated     INTEGER DEFAULT 0,
    total_budgeted      DECIMAL(18,2) DEFAULT 0,
    source_year         INTEGER,                       -- Año base para la generación
    notes               TEXT,
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(budget_id, version)
);

CREATE TABLE budget.budget_details (
    id              BIGSERIAL PRIMARY KEY,
    property_id       UUID NOT NULL,
    budget_id       BIGINT REFERENCES budget.budgets(id) ON DELETE CASCADE,
    cost_center_id  BIGINT,                        -- ID lógico (no FK cross-schema)
    concept_id      BIGINT,                        -- ID lógico (no FK cross-schema)
    month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    base_amount     DECIMAL(18,2) DEFAULT 0,
    amount          DECIMAL(18,2) DEFAULT 0,
    expense_type    VARCHAR(100),
    direction       VARCHAR(10) DEFAULT 'egreso',
    version         INTEGER DEFAULT 1,              -- Versión del presupuesto a la que pertenece
    created_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(budget_id, cost_center_id, COALESCE(concept_id, 0), month, version)
);

CREATE TABLE budget.budget_rules (
    id                  BIGSERIAL PRIMARY KEY,
    property_id           UUID NOT NULL,
    cost_center_id      BIGINT,                    -- ID lógico (no FK cross-schema)
    concept_id          BIGINT,                    -- ID lógico (no FK cross-schema)
    expense_type        VARCHAR(100),
    indicator_name      VARCHAR(200),
    adjustment_factor   DECIMAL(8,4) DEFAULT 0,        -- Ajuste adicional: base × (1 + (indicator + adjustment) / 100)
    fixed_monthly       DECIMAL(18,2),
    direction           VARCHAR(10) DEFAULT 'egreso',
    created_at          TIMESTAMP DEFAULT NOW(),
    UNIQUE(property_id, cost_center_id, concept_id, direction)
);
```

**Nota**: `budget_details` y `budget_rules` usan `cost_center_id` y `concept_id` como IDs lógicos (no FK cross-schema). Los nombres se desnormalizan desde los eventos o se consultan via HTTP cuando se necesitan.

### 6.3 Frontend: Feature module en Angular

```
PH360/frontend-web/src/app/features/conciliation/
├── movements/
│   ├── movement-list/                  ← MovimientosPage
│   │   ├── movement-list.component.ts
│   │   ├── movement-list.component.html
│   │   └── movement-list.component.scss
│   ├── movement-form/                  ← MovimientoFormPage
│   ├── upload-movements/               ← UploadMovimientosPage
│   └── classify-movements/             ← ClasificarMovimientosPage
├── bank-statements/
│   ├── upload-statement/               ← UploadExtractoPage
│   └── statement-detail/
├── reconciliation/
│   ├── reconciliation-dashboard/       ← ConciliacionPage
│   ├── matching/                       ← ConciliacionMatchingPage
│   └── matching-config/                ← MatchingConfigPage
├── budget/
│   ├── budget-vs-actual/               ← PresupuestoVsRealPage
│   ├── budget-config/                  ← PresupuestoConfigPage
│   ├── budget-execution/               ← EjecucionMensualPage
│   ├── expense-types/                  ← TiposGastoPage
│   ├── economic-indicators/            ← IndicadoresEconomicosPage
│   ├── budget-rules/                   ← ReglasPresupuestoPage
│   └── expense-classification/         ← ClasificacionGastosPreviewPage
├── reports/
│   ├── classification-report/          ← ReporteClasificacionesPage
│   ├── cost-center-report/             ← ReporteEgresosCentroCostoPage
│   ├── third-party-report/             ← ReporteEgresosTerceroPage
│   └── monthly-report/                 ← ReporteIngresosGastosMesPage
├── master-data/
│   ├── accounts/                       ← CuentasPage
│   ├── cost-centers/                   ← CentrosCostosPage
│   ├── concepts/               ← ConceptosPage
│   └── third-parties/                  ← TercerosPage
├── dashboard/
│   ├── conciliation-dashboard/         ← Widget para dashboard principal PH360
│   └── components/
│       ├── budget-widget/              ← DashboardBudgetWidget
│       ├── budget-vs-real/             ← DashboardBudgetVsReal
│       └── budget-3-months/            ← DashboardBudget3Months
├── models/
│   ├── movement.model.ts
│   ├── account-config.model.ts
│   ├── bank-statement.model.ts
│   ├── budget.model.ts
│   ├── budget-rule.model.ts
│   ├── expense-type.model.ts
│   ├── economic-indicator.model.ts
│   ├── classification.model.ts
│   └── matching.model.ts
├── services/
│   ├── movement.service.ts
│   ├── reconciliation.service.ts
│   ├── budget.service.ts
│   ├── classification.service.ts
│   ├── expense-type.service.ts
│   ├── economic-indicator.service.ts
│   ├── budget-rule.service.ts
│   └── catalog.service.ts             ← Maestros del módulo
├── shared/
│   ├── budget-bar-row/                 ← Barra semáforo + Pareto
│   ├── semaphore-badge/                ← Badge verde/amarillo/rojo
│   ├── currency-display/               ← Formato moneda COP/USD
│   ├── drilldown-table/                ← Tabla con drill-down CC→Concepto→Tercero
│   └── data-table/                     ← Si no existe equivalente en PH360 shared
└── conciliation.routes.ts
```

### 6.4 Endpoints API (dos servicios separados)

#### backend-conciliation — Prefijo: `/api/conciliation/`

```
# ─── Movimientos ───────────────────────────────────
POST   /api/conciliation/movements/upload           ← Carga CSV/Excel → publica eventos
GET    /api/conciliation/movements                   ← Lista con filtros + paginación
GET    /api/conciliation/movements/{id}              ← Detalle con clasificación
PUT    /api/conciliation/movements/{id}              ← Editar (solo Efectivo) → publica evento
DELETE /api/conciliation/movements/{id}              ← Eliminar (solo Efectivo) → publica MovementDeletedEvent
POST   /api/conciliation/movements/{id}/classify     ← Clasificar → publica MovementClassifiedEvent
POST   /api/conciliation/movements/auto-classify     ← Auto-clasificar batch → publica N eventos

# ─── Extractos Bancarios ──────────────────────────
POST   /api/conciliation/bank-statements/upload      ← Carga PDF (iText7)
GET    /api/conciliation/bank-statements
GET    /api/conciliation/bank-statements/{id}

# ─── Matching / Conciliación ──────────────────────
POST   /api/conciliation/matching/execute
GET    /api/conciliation/matching/candidates
POST   /api/conciliation/matching/link
DELETE /api/conciliation/matching/{id}
GET    /api/conciliation/reconciliations
GET    /api/conciliation/reconciliations/{id}/summary

# ─── Clasificación ────────────────────────────────
GET    /api/conciliation/classification-rules
POST   /api/conciliation/classification-rules
GET    /api/conciliation/classification/preview
GET    /api/conciliation/classification/suggestions

# ─── Dashboard (solo estadísticas movimientos) ────
GET    /api/conciliation/dashboard/statistics

# ─── Maestros del módulo ─────────────────────────
CRUD   /api/conciliation/account-config              ← Extensión de payment.bank_accounts (ver sección 16.4)
CRUD   /api/conciliation/account-types
CRUD   /api/conciliation/cost-centers
CRUD   /api/conciliation/concepts
CRUD   /api/conciliation/third-parties
CRUD   /api/conciliation/currencies
GET    /api/conciliation/catalogs

# ─── Interno (no expuesto en Swagger público) ────
GET    /api/conciliation/internal/movement-summary   ← Para rebuild del read model de Budget
```

#### backend-budget — Prefijo: `/api/budget/`

```
# ─── Presupuesto ──────────────────────────────────
POST   /api/budget/budgets                            ← Crear
GET    /api/budget/budgets                            ← Lista
GET    /api/budget/budgets/{id}                       ← Detalle
PATCH  /api/budget/budgets/{id}                       ← Actualizar config
DELETE /api/budget/budgets/{id}                       ← Eliminar (solo draft)
POST   /api/budget/budgets/{id}/generate              ← Generar desde movement_summary (read model)
GET    /api/budget/budgets/{id}/preview               ← Preview antes de generar
POST   /api/budget/budgets/{id}/activate              ← Activar → publica BudgetActivatedEvent
GET    /api/budget/budgets/{id}/comparison             ← Ppto vs Real por CC (usa movement_summary)
GET    /api/budget/budgets/{id}/comparison/concepts    ← Drill-down por concepto
GET    /api/budget/budgets/{id}/comparison/third-parties ← Drill-down por tercero
GET    /api/budget/budgets/{id}/comparison/monthly     ← Resumen mensual
POST   /api/budget/budgets/{id}/adjust                ← Ajustes (global %, por CC %, por línea)
GET    /api/budget/budgets/{id}/details               ← Detalle líneas
GET    /api/budget/budgets/{id}/versions              ← Historial de versiones generadas
GET    /api/budget/budgets/{id}/versions/compare      ← Comparar dos versiones (?versionA=1&versionB=2)

# ─── Reglas Presupuesto ───────────────────────────
CRUD   /api/budget/budget-rules
POST   /api/budget/budget-rules/batch

# ─── Tipos de Gasto ──────────────────────────────
CRUD   /api/budget/expense-types

# ─── Indicadores Económicos ──────────────────────
CRUD   /api/budget/economic-indicators

# ─── Dashboard Widget (presupuesto) ──────────────
GET    /api/budget/dashboard/budget-widget            ← Widget consumo mensual (para dashboard conciliación)
GET    /api/budget/dashboard/budget-3months           ← Resumen 3 meses

# ─── Read Model Status ──────────────────────────
GET    /api/budget/internal/read-model-status         ← Estado del read model (último evento procesado)
POST   /api/budget/internal/read-model-rebuild        ← Trigger reconstrucción
```

**Nota**: El frontend Angular llama a **ambas APIs**. El dashboard de conciliación llama `/api/conciliation/dashboard/statistics` + `/api/budget/dashboard/budget-widget` para mostrar el dashboard unificado.

---

## 7. Inventario de Migración

### 7.1 Backend: Servicios Python → Java

| Python Service | Java Equivalent | Complejidad |
|---------------|-----------------|-------------|
| `matching_service.py` | `MatchingAlgorithmService.java` | Alta (algoritmo scoring) |
| `conciliacion_service.py` | `ReconciliationService.java` | Media |
| `clasificacion_service.py` | `ClassificationService.java` | Alta (5 niveles) |
| `presupuesto_generacion_service.py` | `BudgetGenerationService.java` | Alta (fórmulas, tipos gasto) |
| `presupuesto_service.py` | Use cases de Budget | Media (orquestación) |
| `cargar_movimientos_service.py` | `LoadMovementsUseCaseImpl.java` | Baja |
| `cargar_extracto_bancario_service.py` | `LoadBankStatementUseCaseImpl.java` | Alta (coordina extractores) |
| `trm_application_service.py` | `TrmService.java` | Baja (API externa) |

### 7.2 Backend: 27 routers → ~13 controllers

| Routers Python | Controller Java | Notas |
|---------------|-----------------|-------|
| `movimientos.py` | `MovementController` | CRUD + clasificación |
| `archivos.py` + `extractores.py` | `BankStatementController` | Upload PDF/CSV |
| `conciliaciones.py` + `matching.py` | `ReconciliationController` | Matching + vinculación |
| `clasificacion.py` + `reglas.py` | `ClassificationController` | Reglas + auto-clasificación |
| `presupuestos.py` | `BudgetController` | CRUD + generar + comparar |
| `tipos_gasto.py` | `ExpenseTypeController` | CRUD |
| `reglas_presupuesto.py` | `BudgetRuleController` | CRUD + batch |
| `indicadores_economicos.py` | `EconomicIndicatorController` | CRUD |
| `dashboard.py` | `DashboardController` | Stats + widget |
| `cuentas.py` + `tipos_cuenta.py` | `AccountConfigController` | Maestro cuentas |
| `centros_costos.py` + `conceptos.py` + `terceros.py` | `CatalogController` | Maestros bulk |
| `config_filtros_centros_costos.py` + `config_valores_pendientes.py` | Dentro de BudgetController o ConfigController | Config avanzada |
| `perspectivas.py` | `PerspectiveController` | CRUD perspectivas de visualización |

### 7.3 Backend: 28 repos → JPA repos + adapters

Cada repositorio Python (SQL raw con psycopg2) → Spring Data JPA interface + RepositoryAdapter.

Las queries complejas (CTEs, FULL OUTER JOINs en comparación y generación) se implementan con `@Query(nativeQuery = true)` en Spring Data.

### 7.4 Backend: 18 extractores PDF → iText7 adapters

| Extractor Python (pdfplumber) | Adapter Java (iText7) |
|-------------------------------|----------------------|
| `ahorros_extracto.py` | `AhorrosExtractorAdapter` |
| `ahorros_movimientos.py` | `AhorrosMovimientosAdapter` |
| `ahorros_movimientos_excel.py` | `AhorrosExcelAdapter` (Apache POI) |
| `fondorenta_extracto.py` | `FondoRentaExtractorAdapter` |
| `fondorenta_movimientos.py` | `FondoRentaMovimientosAdapter` |
| `fondorenta_movimientos_excel.py` | `FondoRentaExcelAdapter` |
| `mastercard_pesos_extracto.py` | `MasterCardPesosExtractorAdapter` |
| `mastercard_pesos_extracto_anterior.py` | `MasterCardPesosAnteriorAdapter` |
| `mastercard_pesos_extracto_movimientos.py` | `MasterCardPesosMovimientosAdapter` |
| `mastercard_usd_extracto.py` | `MasterCardUsdExtractorAdapter` |
| `mastercard_usd_extracto_anterior.py` | `MasterCardUsdAnteriorAdapter` |
| `mastercard_usd_extracto_movimientos.py` | `MasterCardUsdMovimientosAdapter` |
| `mastercard_movimientos.py` | `MasterCardMovimientosAdapter` |
| `mastercard_movimientos_excel.py` | `MasterCardExcelAdapter` |
| `bancolombia_adapter.py` | `BancolombiaExtractorOrchestrator` (coordina todos) |

### 7.5 Frontend: ~44 React pages → ~31 Angular components

Algunas pages se consolidan (ej: maestros en un módulo con tabs en lugar de 7 páginas separadas).

| React Page | Angular Component | Notas |
|-----------|-------------------|-------|
| `MovimientosPage.tsx` | `movement-list.component` | |
| `MovimientoFormPage.tsx` | `movement-form.component` | |
| `UploadMovimientosPage.tsx` | `upload-movements.component` | |
| `UploadExtractoPage.tsx` | `upload-statement.component` | |
| `ConciliacionPage.tsx` | `reconciliation-dashboard.component` | |
| `ConciliacionMatchingPage.tsx` | `matching.component` | |
| `ClasificarMovimientosPage.tsx` | `classify-movements.component` | |
| `PresupuestoVsRealPage.tsx` | `budget-vs-actual.component` | |
| `PresupuestoConfigPage.tsx` | `budget-config.component` | |
| `TiposGastoPage.tsx` | `expense-types.component` | |
| `IndicadoresEconomicosPage.tsx` | `economic-indicators.component` | |
| `ReglasPresupuestoPage.tsx` | `budget-rules.component` | |
| `EjecucionMensualPage.tsx` | `budget-execution.component` | |
| `ClasificacionGastosPreviewPage.tsx` | `expense-classification.component` | |
| `DashboardPage.tsx` | Integrar en dashboard PH360 | Widgets como sub-componentes |
| `ComparacionVersionesPage.tsx` | `budget-version-compare.component` | Comparación entre versiones de presupuesto |
| `ComparativoCifrasPage.tsx` | `budget-figures-compare.component` | Comparativo de cifras |
| `DescargarMovimientosPage.tsx` | Endpoint backend `GET /api/conciliation/movements/export` | Export movido a backend (Apache POI) |
| `MonedasPage.tsx` | `master-data/currencies` tab | Consolidar con maestros |
| `TiposMovimientoPage.tsx` | `master-data/movement-types` tab | Consolidar con maestros |
| `MatchingConfigPage.tsx` | `matching-config.component` | |
| `PerspectivasPage.tsx` | `perspectives.component` | CRUD de perspectivas de visualización (v0.0.0008) |
| Páginas mantenimiento | `admin/` o excluir | Evaluar si aplican en PH360 |
| ~8 pages maestros | `master-data/` con tabs | Consolidar |
| 5 pages reportes | `reports/` | |

### 7.6 Frontend: React components → Angular

| React Component | Angular Equivalent | Reusar de PH360? |
|----------------|-------------------|-------------------|
| `DataTable` | PH360 ya tiene tabla genérica o `@ph360/shared` | Verificar |
| `Modal` | Angular CDK Dialog o equivalente PH360 | Verificar |
| `BudgetBarRow` | Crear nuevo: `budget-bar-row.component` | No existe |
| `SemaforoBadge` | Crear nuevo: `semaphore-badge.component` | No existe |
| `CurrencyDisplay` | Crear pipe: `currency-format.pipe` | Posible |
| `DrilldownTable` | Crear nuevo: `drilldown-table.component` | No existe |
| `BudgetComparisonBars` | Crear nuevo con Chart.js (ya incluido en PH360) | Chart.js existe |
| `DashboardBudgetWidget` | Crear nuevo: `budget-widget.component` | No existe |
| `PerspectiveSelector` | Crear nuevo: `perspective-selector.component` | No existe. Dropdown global de perspectiva (v0.0.0008) |
| `EjecucionMensualChart` | Crear nuevo: `budget-execution-chart.component` | Chart.js (v0.0.0007) |
| `PresupuestoActionToolbar` | Crear nuevo: `budget-action-toolbar.component` | Toolbar de acciones de presupuesto (v0.0.0007) |
| `SemaphoreProgressBar` | Crear nuevo: `semaphore-progress-bar.component` | Barra de progreso con semáforo (v0.0.0007) |
| `ReglaPresupuestoModal` | Crear nuevo: `budget-rule-modal.component` | Modal CRUD reglas (v0.0.0007) |
| `PresupuestoFormModal` | Crear nuevo: `budget-form-modal.component` | Modal crear/editar presupuesto (v0.0.0007) |
| `PresupuestoDrilldownModal` | Crear nuevo: `budget-drilldown-modal.component` | Modal drill-down detalle (v0.0.0007) |
| `FechaDisplay` | Crear pipe: `date-format.pipe` | Formateo de fechas (v0.0.0008) |

### 7.7 Estrategia de Exports (Excel/PDF)

**Decisión**: Los exports se mueven al **backend (Java)** para consistencia con PH360.

| Librería React (actual) | Reemplazo Java | Endpoint |
|--------------------------|---------------|----------|
| `XLSX` (xlsx.js) — export Excel desde frontend | **Apache POI** — generación en backend | `GET /api/conciliation/movements/export?format=xlsx` |
| `jsPDF` + `jspdf-autotable` — export PDF desde frontend | **iText7** — generación en backend | `GET /api/conciliation/movements/export?format=pdf` |
| `Recharts` (gráficos React) | **Chart.js** (ya incluido en PH360, v4.5.1) | Renderizado en Angular |
| `TanStack Query` (data fetching/caching) | `HttpClient` + Angular Signals + `shareReplay()` | Patrón estándar Angular |

**Endpoints de export a crear:**

```
# backend-conciliation
GET  /api/conciliation/movements/export?format=xlsx|pdf&year=2026&month=1
GET  /api/conciliation/reports/classification/export?format=xlsx|pdf
GET  /api/conciliation/reports/cost-centers/export?format=xlsx|pdf

# backend-budget
GET  /api/budget/budgets/{id}/export?format=xlsx|pdf
GET  /api/budget/budgets/{id}/comparison/export?format=xlsx|pdf
```

**Justificación**: Generar Excel/PDF en el backend permite reutilizar los mismos servicios de datos, no duplicar lógica de formateo, y es consistente con el patrón de descarga de PH360 (ej: supplier-invoice usa Apache POI para Excel).

---

## 8. Reglas de Negocio Críticas a Preservar

### 8.1 Tipos de Cuenta — Permisos
- **Efectivo**: ÚNICO tipo que permite crear/editar/eliminar movimientos manualmente
- **Bancaria/Tarjeta/Inversiones**: Movimientos SOLO desde extracto PDF. Solo permite clasificar

### 8.2 Matching — Integridad 1-a-1
- Cada extracto → máximo 1 movimiento sistema
- Scores: fecha (0/1), valor (0-1), descripción (SequenceMatcher ratio)
- Regla identidad fuerte: fecha+valor exactos → mínimo PROBABLE
- Umbrales: OK ≥0.95, PROBABLE ≥0.70

### 8.3 Clasificación — 5 niveles
1. Reglas estáticas (pattern matching)
2. Referencia exacta (historial misma cuenta)
3. Semántica (similitud descripción)
4. Valor (monto similar → mismo CC/concepto)
5. FondoRenta (regla especial)

### 8.4 Presupuesto — Fórmula de generación
```
monto_ppto = monto_base × (1 + (indicador + factor_ajuste) / 100)
```
- **No Repetitivos**: ≤umbral meses → excluir. NUNCA suman al presupuesto
- **Estacionales**: 12 filas con distribución histórica mensual (NO /12)
- **Fijos**: NO usan indicador. Usan `monto_fijo_mensual` de regla
- **Jerarquía reglas**: CC+Concepto > CC solo > Global > Default (variable/IPC)
- **Semáforo**: verde ≤10%, amarillo 10-25%, rojo >25% variación

### 8.5 Cuentas USD (MasterCard)
- **TRM en 2 fases**: Provisional (API Banco de la República) → Definitiva (al pagar TC)
- Siempre 3 cifras: USD, TRM, COP (= USD × TRM)
- Dashboard/presupuesto siempre usan `valor` (COP)

---

## 9. Fases de Implementación

### Fase 0: Setup de Infraestructura y Ambos Microservicios

**Objetivo**: Tener ambos servicios levantando en K8s con schemas vacíos y comunicación Kafka funcional.

- Crear `PH360/backend-conciliation/` copiando estructura de `backend-financial/`
- Crear `PH360/backend-budget/` copiando estructura de `backend-financial/`
- Configurar `pom.xml` de cada servicio:
  - **backend-conciliation**: shared-java, iText7, Apache POI, Spring Cloud Stream
  - **backend-budget**: shared-java, Spring Cloud Stream
- Configurar `application.yml` de cada servicio:
  - backend-conciliation: schema `conciliation`, context-path `/api/conciliation`, port 30089
  - backend-budget: schema `budget`, context-path `/api/budget`, port 30091
- Crear migraciones Flyway:
  - **conciliation**: V1-V7 (schema, maestros, movimientos, extractos, conciliación, clasificación, processed_events)
  - **budget**: V1-V9 (schema, presupuestos, budget_versions, reglas, tipos gasto, indicadores, movement_summary, processed_events, seed data)
- Configurar K8s manifests: `26-backend-conciliation.yaml`, `27-backend-budget.yaml`
- Verificar topics Kafka creados y ambos servicios conectando al broker
- Agregar feature module Angular en `frontend-web/src/app/features/conciliation/`
- Agregar routes en `frontend-web/src/app/app.routes.ts`
- Agregar entradas en `frontend-web/proxy.conf.json` para desarrollo local:
  - `/api/conciliation` → `http://localhost:30089`
  - `/api/budget` → `http://localhost:30091`

### Fase 1: Maestros + Movimientos (backend-conciliation)

**Objetivo**: CRUD completo de movimientos con publicación de eventos.

- Domain aggregates: Movement, MovementDetail, AccountConfig, CostCenter, Concept, ThirdParty
- JPA entities + Spring Data repositories + MapStruct mappers
- Use cases: CreateMovement, ListMovements, UploadMovements
- **Evento publishing**: Al crear/editar/eliminar movimientos, publicar a Kafka (sin consumidores aún)
- REST controllers + DTOs
- Angular: movement-list, movement-form, upload-movements, master-data pages
- Endpoint interno: `/api/conciliation/internal/movement-summary` (para rebuild futuro)

### Fase 2: Infraestructura de Eventos + Read Model (backend-budget)

**Objetivo**: Budget consume eventos de Conciliation y mantiene su read model actualizado.

- Implementar `ConciliationEventPublisherPort` + `ConciliationEventPublisherAdapter` (StreamBridge) en conciliation
- Implementar event handlers en budget:
  - `MovementClassifiedStreamHandler` → upsert en `movement_summary`
  - `MovementReclassifiedStreamHandler` → compensar (restar old + sumar new)
  - `MovementDeletedStreamHandler` → restar del read model
  - `MovementAmountUpdatedStreamHandler` → actualizar monto
- Implementar `ProcessedEventRepository` en ambos servicios (idempotencia)
- Implementar `ReadModelRebuildService` + `ConciliationApiClient` (HTTP fallback, usar `RestClient` de shared-java — NO OpenFeign)
- **Tests**: Verificar con TestContainers + Kafka embebido que eventos fluyen correctamente
- **Verificación**: Clasificar movimientos en conciliation → verificar que `movement_summary` se actualiza en budget

### Fase 3: Matching + Conciliación (backend-conciliation)

**Objetivo**: Algoritmo de matching funcional con scoring.

- Domain service: `MatchingAlgorithmService` (portar scoring Python → Java)
  - SequenceMatcher → Apache Commons Text `CosineSimilarity` o `LevenshteinDistance`
  - Scoring: fecha (0/1), valor (0-1), descripción (0-1)
  - Regla identidad fuerte: fecha+valor exactos → mínimo PROBABLE
- Use cases: ExecuteMatching, LinkMovements, GetCandidates
- REST controllers
- Angular: reconciliation-dashboard, matching page, matching-config
- **Tests**: Golden data del sistema Python como casos de referencia

### Fase 4: Clasificación (backend-conciliation)

**Objetivo**: Auto-clasificación con 5 niveles + publicación masiva de eventos.

- Domain service: `ClassificationService` (5 niveles: reglas→ref→semántica→valor→FondoRenta)
- Use cases: AutoClassify (batch → publica N `MovementClassifiedEvent`), SuggestReclassification
- REST controllers
- Angular: classify-movements, classification-report
- **Evento**: `MovementClassifiedEvent` se publica para cada movimiento clasificado
- **Verificación**: Auto-clasificar batch → verificar N eventos publicados → read model de budget actualizado

### Fase 5: Presupuesto (backend-budget)

**Objetivo**: Generación y comparación usando el read model (no JOINs directos).

- Domain aggregates: Budget, BudgetDetail, BudgetRule, ExpenseType, EconomicIndicator
- Domain service: `BudgetGenerationService`
  - Fórmula: `monto_ppto = monto_base × (1 + (indicador + factor_ajuste) / 100)`
  - Fuente: `budget.movement_summary` (read model, NO tablas de conciliation)
  - No repetitivos, estacionales, fijos: misma lógica que Python
- Domain service: `BudgetComparisonService`
  - FULL OUTER JOIN entre `budget_details` y `movement_summary` (ambas tablas locales)
- Use cases: GenerateBudget, CompareBudgetVsActual, AdjustBudget
- **Evento publishing**: `BudgetActivatedEvent`, `BudgetOverspendAlertEvent`
- REST controllers
- Angular: budget-vs-actual, budget-config, expense-types, economic-indicators, budget-rules, expense-classification
- **Tests**: Fórmulas con datos del sistema Python como golden data

### Fase 6: Dashboard + Reportes (ambos servicios)

**Objetivo**: Dashboard unificado consumiendo ambas APIs.

- **backend-conciliation**:
  - `DashboardController` → estadísticas de movimientos
  - Consumer de `BudgetActivatedEvent` (opcional: mostrar badge "presupuesto activo")
- **backend-budget**:
  - `BudgetDashboardController` → widget presupuesto, resumen 3 meses
- Angular dashboard: combina llamadas a `/api/conciliation/dashboard/statistics` + `/api/budget/dashboard/budget-widget`
- Reportes: clasificaciones, egresos por CC, egresos por tercero, ingresos/gastos mensual
- Angular: dashboard widgets + report pages

### Fase 7: Extractores PDF (backend-conciliation)

**Objetivo**: Portar extractores Bancolombia, la parte más compleja.

- Portar 18 extractores de pdfplumber (Python) → iText7/Apache PDFBox (Java)
- Cada formato de extracto es un adapter independiente (Strategy pattern)
- `BancolombiaExtractorOrchestrator` coordina la selección del extractor correcto
- Tests exhaustivos con PDFs reales: comparar output Python vs Java línea por línea
- **Evento**: Después de cargar extracto → trigger carga de movimientos → eventos publicados
- **Verificación**: PDF → movimientos creados → eventos enviados → read model actualizado

---

## 10. Configuración K8s

### 10.1 backend-conciliation (puerto 30089)

```yaml
# k8s/local/26-backend-conciliation.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-conciliation
  namespace: ph360
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend-conciliation
  template:
    spec:
      containers:
        - name: backend-conciliation
          image: docker-backend-conciliation:latest
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: ph360-common-config
            - secretRef:
                name: ph360-db-credentials
            - secretRef:
                name: ph360-jwt-secret
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "local,kafka"
            - name: SPRING_CLOUD_STREAM_KAFKA_BINDER_BROKERS
              value: "kafka:9092"
          livenessProbe:
            tcpSocket:
              port: 8080
            initialDelaySeconds: 120
          readinessProbe:
            tcpSocket:
              port: 8080
            initialDelaySeconds: 90
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "1Gi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: backend-conciliation
  namespace: ph360
spec:
  type: ClusterIP
  ports:
    - port: 8080
  selector:
    app: backend-conciliation
---
apiVersion: v1
kind: Service
metadata:
  name: backend-conciliation-external
  namespace: ph360
spec:
  type: NodePort
  ports:
    - port: 8080
      nodePort: 30089
  selector:
    app: backend-conciliation
```

### 10.2 backend-budget (puerto 30091)

```yaml
# k8s/local/27-backend-budget.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend-budget
  namespace: ph360
spec:
  replicas: 1
  selector:
    matchLabels:
      app: backend-budget
  template:
    spec:
      containers:
        - name: backend-budget
          image: docker-backend-budget:latest
          ports:
            - containerPort: 8080
          envFrom:
            - configMapRef:
                name: ph360-common-config
            - secretRef:
                name: ph360-db-credentials
            - secretRef:
                name: ph360-jwt-secret
          env:
            - name: SPRING_PROFILES_ACTIVE
              value: "local,kafka"
            - name: SPRING_CLOUD_STREAM_KAFKA_BINDER_BROKERS
              value: "kafka:9092"
            - name: CONCILIATION_SERVICE_URL
              value: "http://backend-conciliation:8080"   # Para HTTP fallback (rebuild read model)
          livenessProbe:
            tcpSocket:
              port: 8080
            initialDelaySeconds: 120
          readinessProbe:
            tcpSocket:
              port: 8080
            initialDelaySeconds: 90
          resources:
            requests:
              memory: "384Mi"
              cpu: "200m"
            limits:
              memory: "768Mi"
              cpu: "400m"
---
apiVersion: v1
kind: Service
metadata:
  name: backend-budget
  namespace: ph360
spec:
  type: ClusterIP
  ports:
    - port: 8080
  selector:
    app: backend-budget
---
apiVersion: v1
kind: Service
metadata:
  name: backend-budget-external
  namespace: ph360
spec:
  type: NodePort
  ports:
    - port: 8080
      nodePort: 30091
  selector:
    app: backend-budget
```

### 10.3 Kafka Topics (crear en setup)

```yaml
# Los topics se auto-crean con Spring Cloud Stream, pero para producción:
# k8s/local/kafka-topics-conciliation.yaml (o script de inicialización)
topics:
  - name: conciliation.movement.classified
    partitions: 3
    replication-factor: 1
  - name: conciliation.movement.reclassified
    partitions: 3
    replication-factor: 1
  - name: conciliation.movement.deleted
    partitions: 3
    replication-factor: 1
  - name: conciliation.movement.amount-updated
    partitions: 3
    replication-factor: 1
  - name: conciliation.movement.bulk-loaded
    partitions: 1
    replication-factor: 1
  - name: budget.budget.activated
    partitions: 3
    replication-factor: 1
  - name: budget.budget.generated
    partitions: 1
    replication-factor: 1
  - name: budget.alert.overspend
    partitions: 1
    replication-factor: 1
  - name: budget.report.monthly
    partitions: 1
    replication-factor: 1
```

---

## 11. Permisos IAM (separados por servicio)

Nuevos permisos a registrar en el servicio IAM de PH360, agrupados por microservicio:

### 11.1 Permisos `conciliation.*` (backend-conciliation)

```
# Movimientos
conciliation.read.movement
conciliation.create.movement
conciliation.update.movement
conciliation.delete.movement
conciliation.classify.movement

# Extractos Bancarios
conciliation.upload.bankstatement
conciliation.read.bankstatement

# Matching / Conciliación
conciliation.execute.matching
conciliation.link.matching
conciliation.read.reconciliation

# Clasificación
conciliation.read.classificationrule
conciliation.create.classificationrule

# Maestros (cuentas, CC, conceptos, terceros)
conciliation.read.catalog
conciliation.manage.catalog

# Dashboard (solo stats movimientos)
conciliation.read.dashboard

# Interno (system-to-system, para rebuild read model)
system.internal
```

### 11.2 Permisos `budget.*` (backend-budget)

```
# Presupuesto
budget.read.budget
budget.create.budget
budget.update.budget
budget.delete.budget
budget.generate.budget
budget.activate.budget
budget.adjust.budget

# Reglas Presupuesto
budget.read.budgetrule
budget.create.budgetrule
budget.update.budgetrule
budget.delete.budgetrule

# Tipos de Gasto
budget.read.expensetype
budget.create.expensetype
budget.update.expensetype

# Indicadores Económicos
budget.read.indicator
budget.create.indicator
budget.update.indicator

# Dashboard Widget (presupuesto)
budget.read.dashboard

# Read Model (admin)
budget.admin.readmodel
```

---

## 12. Verificación

### 12.1 Por servicio

| Verificación | backend-conciliation | backend-budget |
|-------------|---------------------|----------------|
| `mvn clean test` | Tests pasan, ≥85% cobertura | Tests pasan, ≥85% cobertura |
| `flyway migrate` | Schema `conciliation` OK | Schema `budget` OK |
| Swagger UI | `/api/conciliation/swagger-ui.html` | `/api/budget/swagger-ui.html` |
| JWT + RBAC | Permisos `conciliation.*` | Permisos `budget.*` |
| Multi-property | `property_id` en todas las queries | `property_id` en todas las queries |
| K8s health | `kubectl get pods` → Running | `kubectl get pods` → Running |

### 12.2 Eventos (verificación inter-servicio)

1. **Publicación**: Clasificar un movimiento en conciliation → verificar mensaje en topic `conciliation.movement.classified`
2. **Consumo**: Verificar que budget recibe el evento → `movement_summary` se actualiza con monto correcto
3. **Reclasificación**: Cambiar clasificación → verificar evento `reclassified` → read model compensa (resta old, suma new)
4. **Eliminación**: Eliminar movimiento → verificar evento `deleted` → read model resta monto
5. **Idempotencia**: Enviar mismo evento 2 veces → verificar que `movement_summary` no se duplica (check `processed_events`)
6. **Dead Letter**: Forzar error en consumer → verificar que mensaje va a DLT después de 3 reintentos
7. **Rebuild**: Trigger rebuild via `POST /api/budget/internal/read-model-rebuild` → verificar que read model se reconstruye desde endpoint HTTP de conciliation
8. **Consistencia**: Comparar totales de `movement_summary` en budget vs query directa a `movements` en conciliation → deben coincidir

### 12.3 E2E (flujo completo cross-service)

1. Crear cuentas y maestros → verificar en `/api/conciliation/catalogs`
2. Cargar movimientos (CSV/manual) → verificar eventos publicados
3. Clasificar movimientos → verificar 5 niveles + eventos `MovementClassifiedEvent`
4. **Esperar propagación** → verificar `movement_summary` actualizado en budget
5. Generar presupuesto → verificar que usa `movement_summary` (no tablas conciliation)
6. Comparar presupuesto vs real → verificar semáforo + FULL OUTER JOIN local
7. Cargar extracto PDF → verificar parsing iText7
8. Ejecutar matching → verificar scores
9. Dashboard → verificar que combina `/api/conciliation/dashboard/statistics` + `/api/budget/dashboard/budget-widget`

### 12.4 Frontend

- `ng test` — tests de componentes Angular pasan
- Verificar que servicios Angular llaman a las URLs correctas de cada backend
- Verificar lazy loading del feature module `conciliation`

---

## 13. Riesgos y Mitigaciones

### 13.1 Riesgos de Migración

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|-------------|------------|
| Extractores PDF: iText7 parsea diferente a pdfplumber | Alto | Media | Tests con PDFs reales como golden data. Comparar output Python vs Java línea por línea |
| Algoritmos matching/clasificación: diferencias numéricas | Medio | Baja | Unit tests con casos del sistema Python como datos de referencia |
| Multi-tenancy en datos migrados | Medio | Baja | Script de migración que asigna `property_id` a datos existentes |
| Volumen de trabajo (reescritura de 2 servicios) | Alto | Alta | Implementar por fases; validar cada fase antes de continuar |
| Pérdida de funcionalidad durante migración | Alto | Media | Mantener app Python funcionando hasta que Java esté validado |
| SequenceMatcher (Python) vs equivalente Java | Medio | Media | Usar Apache Commons Text `CosineSimilarity` o implementar manualmente |
| **TailwindCSS 4 → 3.4**: Conciliación actual usa v4, PH360 usa v3.4.17 | Bajo | Alta | Al reescribir en Angular, usar TailwindCSS 3.4 directamente. Las clases de utilidad son compatibles en su mayoría; revisar breaking changes de v4 |

### 13.2 Riesgos de Arquitectura de Eventos

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|-------------|------------|
| **Consistencia eventual**: Read model desfasado respecto a movimientos reales | Medio | Media | Latencia típica <1s. Aceptable para presupuestos (no tiempo real). UI muestra indicador "último sync" |
| **Eventos perdidos**: Kafka broker caído o consumer no disponible | Alto | Baja | Consumer groups con offset tracking. Kafka retiene 7 días. DLT para errores. Rebuild HTTP como fallback |
| **Orden de eventos**: Reclasificación llega antes que clasificación inicial | Medio | Baja | Partition key por `propertyId:movementId` garantiza orden por movimiento. Idempotencia protege contra duplicados |
| **Read model drift**: Acumulación de errores de redondeo en `movement_summary` | Medio | Baja | Rebuild periódico (mensual) desde endpoint HTTP. Verificación cruzada como health check |
| **Complejidad operacional**: 2 servicios + Kafka vs 1 servicio monolítico | Medio | Alta | Spring Cloud Stream abstrae Kafka. Seguir patrón existente de PH360 (Financial↔Payment). Logging correlationId en headers |
| **Testing eventos**: Más difícil de testear que llamadas directas | Medio | Media | TestContainers con Kafka embebido. Tests de integración que verifican flujo completo pub/sub |
| **Carga masiva**: Auto-clasificar 500+ movimientos → 500+ eventos simultáneos | Bajo | Media | **DECIDIDO** (ver sección 5.10): Enfoque híbrido con umbral configurable (`bulk-threshold: 50` en `application.yml`). < umbral → eventos individuales; >= umbral → 1 `BulkMovementsLoadedEvent` + rebuild HTTP parcial (solo mes afectado) |
| **Kafka adapters en PH360**: Los adapters reales con StreamBridge existen en Financial, IAM y Payment, pero están inactivos por perfil. Todos los servicios activos usan NoOp adapters. Conciliation/Budget serán los primeros en **necesitar** Kafka activo en entorno local | Alto | Alta | Arrancar con NoOp adapters (como PH360 actual). Activar Kafka en Fase 2 con `@Profile({"kafka"})` una vez que la infraestructura (broker + topics) esté probada en K8s |

---

## 14. Errores Detectados y Correcciones Aplicadas

**Fecha de revisión**: 2026-02-20
**Método**: Comparación del plan original contra el codebase real de PH360 (`F:\1. Cloud\4. AI\1. Antigravity\PH360`)

### 14.1 Errores Críticos

#### E1. Puertos K8s en conflicto

| | Detalle |
|---|--------|
| **Error** | El plan asignaba `30086` a backend-conciliation y `30087` a backend-budget |
| **Problema** | Esos puertos ya están ocupados en PH360: `30086` = backend-communications, `30087` = backend-maintenance |
| **Puertos ocupados en PH360** | 30080 (frontend), 30081 (IAM), 30082 (financial), 30083 (realestate), 30084 (master), 30085 (payment), 30086 (communications), 30087 (maintenance), 30088 (supplier-invoice/procurement), 30090 (Kafka UI), 30092 (Kafka), 30432 (PostgreSQL), 30050 (PgAdmin) |
| **Corrección** | backend-conciliation → **30089**, backend-budget → **30091** |

#### E2. `PropertyContext` no existe en PH360

| | Detalle |
|---|--------|
| **Error** | El plan introducía una clase `PropertyContext` con métodos `setPropertyId()` / `clear()` como thread-local |
| **Problema** | PH360 no tiene `PropertyContext`. Solo existe `TenantContext` en `libs/shared-java` (`com.ph360.shared.multitenancy.TenantContext`). Crear un `PropertyContext` requeriría bifurcar shared-java y modificar filtros/interceptors compartidos |
| **Patrón real PH360** | `TenantContext` almacena el `property_id` seleccionado (no el `tenant_id` de la compañía). El frontend envía `X-Tenant-ID` = `property_id` via el Property Selector. `TenantFilter` lo extrae al ThreadLocal. `backend-supplier-invoice` (V11) ya eliminó `tenant_id` de todas sus tablas y usa este patrón |
| **Corrección** | Revertido todo el código Java a `TenantContext.setTenantId()` / `TenantContext.clear()`. Agregada sección 3.6 explicando el flujo HTTP completo |

#### E3. Interfaz `DomainEvent` con `getPropertyId()` incorrecto

| | Detalle |
|---|--------|
| **Error** | El plan cambiaba la interfaz `DomainEvent` de `getTenantId()` a `getPropertyId()` |
| **Problema** | La interfaz `DomainEvent` en PH360 tiene `getTenantId()` y es estándar para todos los servicios. Los eventos **cross-BC** (en `domain/event/pubsub/`) son **Java records independientes** que NO implementan `DomainEvent` — estos sí usan `propertyId` directamente |
| **Evidencia** | `SupplierInvoiceImportedEvent` es un record con `propertyId` que no implementa `DomainEvent`. La interfaz `DomainEvent` sigue con `getTenantId()` |
| **Corrección** | Restaurada la interfaz `DomainEvent` con `getTenantId()`. Los records cross-BC mantienen `propertyId`. Comentarios explicativos agregados en el código del plan |

### 14.2 Errores de Severidad Media

#### E4. Resolución tenant → property sin definir

| | Detalle |
|---|--------|
| **Error** | El plan no explicaba cómo el frontend envía `property_id` ni cómo el backend valida que el tenant tiene acceso a esa property |
| **Problema** | Sin este flujo definido, los servicios no sabrían filtrar datos por copropiedad ni validar permisos |
| **Corrección** | Agregada **sección 3.6** con el flujo HTTP completo: Property Selector → header `X-Tenant-ID` → `TenantFilter` → `TenantContext` → `@RequiresPermission(propertyScoped = true)`. Se reutiliza el interceptor y header existentes de PH360, no se crea nada nuevo |

#### E5. Kafka asumido como activo, pero PH360 usa NoOp adapters

| | Detalle |
|---|--------|
| **Error** | El plan asumía Kafka funcionando con `StreamBridge`, topics, consumers, dead letter topics, etc. |
| **Problema** | Los adapters reales con `StreamBridge` **sí existen** en Financial (`FinancialEventPublisherAdapter`, `DomainEventPublisherPubSub`), IAM (`IamEventPublisherAdapter`) y Payment (`AuditEventPublisher`), pero están inactivos por perfil. Todos los servicios activos usan NoOp adapters. Conciliation/Budget serían los primeros en **necesitar** Kafka activo en entorno local |
| **Corrección** | Riesgo documentado en tabla 13.2. Se recomienda arrancar con NoOp adapters (Fase 0-1) y activar Kafka en Fase 2 una vez probada la infraestructura |

#### E6. `@Profile` incorrecto para toggle de eventos

| | Detalle |
|---|--------|
| **Error** | Los adapters de eventos usaban `@Profile({"local", "dev", "prod"})` y `@Profile("noop")` |
| **Problema** | PH360 no usa esos perfiles para controlar eventos. Los NoOp adapters son simplemente el único `@Component` registrado, sin profile |
| **Corrección** | ~~Cambiado a `@ConditionalOnProperty`~~ → **Re-corregido (2026-02-21)**: Usar `@Profile({"kafka"})` en el adapter real (consistente con el patrón de Financial/IAM/Payment que usan `@Profile` para activar adapters con StreamBridge). El NoOp adapter es `@Component` default sin anotación condicional. Se activa Kafka agregando `kafka` al `SPRING_PROFILES_ACTIVE` en K8s |

### 14.3 Errores Menores

#### E7. Versión PostgreSQL incorrecta

| | Detalle |
|---|--------|
| **Error** | Tabla comparativa decía "PostgreSQL 16" para PH360 |
| **Realidad** | PH360 usa PostgreSQL **14+** (driver 42.7.1) |
| **Corrección** | Corregido a "PostgreSQL 14+" en tabla de sección 2 |

#### E8. HTTP Client: sin mención de RestClient

| | Detalle |
|---|--------|
| **Error** | `ConciliationApiClient` (HTTP fallback para rebuild del read model) no especificaba qué client HTTP usar |
| **Problema** | PH360 migró de OpenFeign a **Spring HTTP Interface** con `RestClient` (bean en `RestClientConfig` de shared-java). Usar OpenFeign sería inconsistente |
| **Corrección** | Notas agregadas en `ConciliationApiClient` y `ReadModelRebuildService` especificando "usar RestClient de shared-java, NO OpenFeign" |

#### E9. TailwindCSS v4 → v3.4 sin mención

| | Detalle |
|---|--------|
| **Error** | No se mencionaba que conciliación usa TailwindCSS 4 pero PH360 usa 3.4.17 |
| **Problema** | Al reescribir componentes React→Angular, hay diferencias de API entre v4 y v3.4 (configuración CSS-first vs JS config, etc.) |
| **Corrección** | Riesgo agregado en tabla 13.1: "Adaptar a TailwindCSS 3.4 directamente al migrar. Clases de utilidad mayormente compatibles" |

#### E10. Descripción NoOp adapter incorrecta

| | Detalle |
|---|--------|
| **Error** | El plan decía `ConciliationEventPublisherNoOpAdapter.java ← @Profile("noop")` |
| **Realidad** | En PH360 los NoOp adapters no usan `@Profile`. Son el `@Component` default |
| **Corrección** | Cambiado a "Default cuando events deshabilitados" |

### 14.4 Resumen

| Severidad | Cantidad | IDs |
|-----------|----------|-----|
| Crítico | 3 | E1 (puertos K8s), E2 (PropertyContext), E3 (DomainEvent) |
| Medio | 3 | E4 (flujo HTTP), E5 (Kafka NoOp), E6 (@Profile) |
| Menor | 4 | E7 (PostgreSQL), E8 (RestClient), E9 (TailwindCSS), E10 (NoOp desc) |
| **Total** | **10** | |

**Estado**: Todos corregidos en este documento.

### 14.5 Errores Detectados en Revisión 2026-02-21

**Método**: Verificación cruzada del plan vs código real de PH360 (lectura de archivos K8s, shared-java, adapters de eventos, proxy.conf.json, package.json) y revisión del codebase de conciliación.

#### E11. Versión PostgreSQL incorrecta (conciliación)

| | Detalle |
|---|--------|
| **Error** | Tabla comparativa (sección 2) decía "PostgreSQL 18" para conciliación |
| **Problema** | PostgreSQL 18 no ha sido lanzado. La versión actual estable es PostgreSQL 17 |
| **Corrección** | Cambiado a "PostgreSQL 17" en sección 2 |

#### E12. `@ConditionalOnProperty` no es patrón PH360

| | Detalle |
|---|--------|
| **Error** | La corrección E6 cambió de `@Profile` a `@ConditionalOnProperty(name = "app.events.enabled")` |
| **Problema** | `@ConditionalOnProperty` no se usa en ningún servicio PH360 para toggle de eventos. El patrón real es: `FinancialEventPublisherAdapter` usa `@Profile` para activarse, `FinancialEventPublisherNoOpAdapter` usa `@Component + @Profile({"test", "default"})`. En supplier-invoice, el NoOp es `@Component` sin condicional |
| **Corrección** | Re-corregido: adapters reales usan `@Profile({"kafka"})`, NoOp adapters son `@Component` default. Se activa Kafka agregando `kafka` al `SPRING_PROFILES_ACTIVE` en K8s |

#### E13. Afirmación "NINGÚN servicio tiene Kafka activo" es incorrecta

| | Detalle |
|---|--------|
| **Error** | Plan y E5 afirmaban que los adapters reales con StreamBridge "no están implementados" |
| **Realidad** | Los adapters reales **sí existen** y usan `StreamBridge`: `FinancialEventPublisherAdapter`, `DomainEventPublisherPubSub` (Financial), `IamEventPublisherAdapter` (IAM), `AuditEventPublisher` (Payment). Están inactivos por perfil, no porque no existan |
| **Corrección** | Lenguaje corregido en E5 y tabla de riesgos 13.2 |

#### E14. Conteo de páginas frontend

| | Detalle |
|---|--------|
| **Error** | Sección 7.5 decía "47 React pages" |
| **Realidad** | La exploración del directorio `frontend/src/pages/` encontró ~43 archivos de página |
| **Corrección** | Cambiado a "~43 React pages" |

#### E15. Páginas faltantes en mapeo de migración

| | Detalle |
|---|--------|
| **Error** | Tabla de migración React→Angular no incluía varias páginas existentes |
| **Páginas faltantes** | `ComparacionVersionesPage`, `ComparativoCifrasPage`, `DescargarMovimientosPage`, `MonedasPage`, `TiposMovimientoPage`, `MatchingConfigPage`, páginas de mantenimiento |
| **Corrección** | Agregadas a la tabla de migración en sección 7.5 |

### 14.6 Omisiones Detectadas en Revisión 2026-02-21

#### O1. `proxy.conf.json` sin entradas para nuevos servicios

| | Detalle |
|---|--------|
| **Omisión** | Fase 0 no mencionaba agregar las rutas proxy del frontend para los nuevos backends |
| **Impacto** | Sin estas entradas, el frontend Angular no puede comunicarse con los backends en desarrollo local |
| **Corrección** | Agregado a Fase 0: `/api/conciliation` → `http://localhost:30089`, `/api/budget` → `http://localhost:30091` |

#### O2. Tabla `budget_versions` no incluida

| | Detalle |
|---|--------|
| **Omisión** | La app conciliación tiene versionado de presupuestos (`presupuesto_versiones`, `version` en `presupuesto_detalle`, `ComparacionVersionesPage`). El schema budget del plan no lo incluía |
| **Corrección** | Agregada tabla `budget.budget_versions`, columna `version` en `budget_details`, columna `current_version` en `budgets`. Agregados `BudgetVersion.java`, `BudgetVersionRepository`, `CompareVersionsUseCase`, y endpoints `/versions` y `/versions/compare` |

#### O3. Estrategia de exports sin definir

| | Detalle |
|---|--------|
| **Omisión** | Conciliación usa `XLSX`, `jsPDF`, `Recharts`, `TanStack Query` en frontend sin equivalentes documentados |
| **Decisión** | Exports Excel/PDF se mueven al **backend (Java)** con Apache POI e iText7. Consistente con PH360 |
| **Corrección** | Agregada sección 7.7 con estrategia de exports y endpoints dedicados |

#### O4. Conflicto puerto 30088 en PH360

| | Detalle |
|---|--------|
| **Hallazgo** | `backend-supplier-invoice` y `backend-procurement` ambos usan NodePort **30088** en los manifests K8s (`27-backend-procurement.yaml` y `28-backend-supplier-invoice.yaml`) |
| **Impacto** | Si ambos se despliegan simultáneamente, solo uno será accesible. No afecta directamente a conciliation/budget (usan 30089/30091), pero es un problema existente de PH360 |
| **Acción** | Documentado como contexto. No requiere corrección en este plan |

### 14.7 Resumen Actualizado

| Severidad | Revisión 2026-02-20 | Revisión 2026-02-21 | Total |
|-----------|---------------------|---------------------|-------|
| Crítico | 3 (E1, E2, E3) | 0 | 3 |
| Medio | 3 (E4, E5, E6) | 2 (E12, E13) | 5 |
| Menor | 4 (E7, E8, E9, E10) | 3 (E11, E14, E15) | 7 |
| Omisiones | 0 | 4 (O1, O2, O3, O4) | 4 |
| **Total** | **10** | **9** | **19** |

**Estado**: Todos corregidos en este documento.

### 14.8 Correcciones Revisión 2026-02-21 (Inventario de tablas)

**Método**: Comparación campo a campo del inventario de tablas de conciliación (sección 1.1) contra los schemas PH360 (sección 6.2).

#### O5. 7 tablas de conciliación sin equivalente en schema 6.2

| | Detalle |
|---|--------|
| **Omisión** | El schema `conciliation` (sección 6.2) solo definía 12 tablas. Faltaban 7 tablas maestras/configuración de la app original |
| **Tablas faltantes** | `tercero_descripciones`, `tipo_mov`, `trm_cache`, `configuracion_matching`, `cuenta_extractores`, `config_filtro_centro_costo`, `config_valor_pendiente` |
| **Corrección** | Agregadas al schema `conciliation` (sección 6.2) como: `third_party_aliases`, `movement_types`, `trm_cache`, `matching_config`, `account_extractors`, `cost_center_filters`, `pending_value_config`. Todas incluyen `property_id`. Schema conciliation pasa de 12 a **20 tablas** (19 + `perspectives` agregada en revisión 2026-02-26) |

#### E16. `conceptos` listaba equivalente PH360 incorrecto

| | Detalle |
|---|--------|
| **Error** | Sección 16.3 fila #4 listaba `financial.billing_concepts` como equivalente de `conceptos` |
| **Problema** | `conceptos` son categorías de gasto e ingreso dependientes de centro de costo (ej: CC "Servicios" → "Agua"; CC "Ingresos" → "Arriendo"). `billing_concepts` son conceptos de facturación a copropietarios. Dominios completamente distintos |
| **Corrección** | Equivalente cambiado a `—`. Justificación actualizada |

#### E17. `terceros` listaba equivalente PH360 incorrecto

| | Detalle |
|---|--------|
| **Error** | Sección 16.3 fila #5 listaba `iam.identities` como equivalente de `terceros` |
| **Problema** | `terceros` son proveedores/pagadores en extractos bancarios (EPM, EAAB, vigilancia). `identities` son usuarios con login en el sistema. Sin relación |
| **Corrección** | Equivalente cambiado a `—`. Justificación actualizada |

#### D1. Tabla `monedas` excluida del schema PH360

| | Detalle |
|---|--------|
| **Decisión** | `monedas` no se migra como tabla independiente |
| **Justificación** | La moneda se resuelve vía `payment.bank_accounts.currency` (VARCHAR(3), ej: 'COP', 'USD'). No se necesita una entidad gestionable con PK propia |

#### E18. `expense_concepts` renombrado y corregido

| | Detalle |
|---|--------|
| **Error** | La tabla `conciliation.expense_concepts` (sección 6.2) tenía dos problemas: (1) el nombre implicaba solo gastos, pero los conceptos también pueden ser de ingresos; (2) no tenía FK a `cost_centers`, cuando en el diseño original `conceptos.centro_costo_id` es dependiente del centro de costo |
| **Corrección** | Tabla renombrada a `conciliation.concepts`. Agregada columna `cost_center_id BIGINT REFERENCES cost_centers(id)` y `active BOOLEAN`. Clase Java renombrada de `ExpenseConcept.java` a `Concept.java`. Endpoint renombrado de `/expense-concepts` a `/concepts`. Justificación en sección 16.3 actualizada con ejemplos de ingreso (CC "Ingresos" → "Arriendo") |

#### E19. 6 campos "evaluar" confirmados e incluidos en schemas

| | Detalle |
|---|--------|
| **Contexto** | El mapeo campo a campo (sección 1.3) marcaba 6 campos como "evaluar si agregar" porque no estaban en los schemas de la sección 6.2 |
| **Campos confirmados** | (1) `cost_centers.active`, (2) `third_parties.active`, (3) `account_types.active`, (4) `expense_types.active` — soft-delete para todas las maestras. (5) `classification_rules.match_type` — VARCHAR(20) con CHECK (exact, contains, starts_with). (6) `budget_rules.adjustment_factor` — DECIMAL(8,4) para factor de ajuste económico |
| **Corrección** | Los 6 campos agregados a schemas SQL en sección 6.2. Mapeo en sección 1.3 actualizado: columnas ahora muestran nombre PH360 y tipo en vez de "evaluar" |

### 14.9 Resumen Actualizado

| Severidad | Rev. 2026-02-20 | Rev. 2026-02-21 (schemas) | Rev. 2026-02-21 (inventario) | Rev. 2026-02-22 (campos) | Total |
|-----------|-----------------|---------------------------|------------------------------|--------------------------|-------|
| Crítico | 3 (E1-E3) | 0 | 0 | 0 | 3 |
| Medio | 3 (E4-E6) | 2 (E12, E13) | 3 (E16, E17, E18) | 1 (E19) | 9 |
| Menor | 4 (E7-E10) | 3 (E11, E14, E15) | 0 | 0 | 7 |
| Omisiones | 0 | 4 (O1-O4) | 1 (O5) | 0 | 5 |
| Decisiones | 0 | 0 | 1 (D1) | 0 | 1 |
| **Total** | **10** | **9** | **5** | **1** | **25** |

**Estado**: Todos corregidos en este documento.

### 14.10 Correcciones Revisión 2026-02-26 (Alineación con v0.0.0007-v0.0.0010)

**Método**: Comparación del plan contra los cambios del codebase entre v0.0.0006 (2026-02-16) y v0.0.0010 (2026-02-26). Commits: 586dca7, a6e3cfa, a45cfb5, 94ce79a.

#### O6. Tabla `perspectivas` no incluida en el plan

| | Detalle |
|---|--------|
| **Omisión** | La app agregó una tabla `perspectivas` (v0.0.0008) con sistema completo: modelo de dominio, repositorio, API router (`perspectivas.py`), servicio frontend (`perspectiva.service.ts`), hook (`usePerspectiva.ts`), componente selector (`PerspectiveSelector.tsx`) y página CRUD (`PerspectivasPage.tsx`). El plan no la incluía |
| **Impacto** | La tabla `perspectivas` permite definir "vistas" de centros de costo (tipo incluir/excluir) para filtrar dashboards y reportes. Es usada transversalmente en dashboard, presupuesto vs real, reportes de egresos, etc. |
| **Corrección** | Tabla #27 agregada al inventario (sección 1.1), mapeo a `conciliation.perspectives` (sección 1.2, fila #20), mapeo campo a campo (sección 1.3, tabla 27), schema SQL (sección 6.2), inventario 16.1/16.3/16.7, migración frontend 7.5/7.6, conteo de routers 7.2. Schema conciliation pasa de 19 a **20 tablas** |

#### E20. Campo `indicador_codigo` renombrado a `indicador_nombre`

| | Detalle |
|---|--------|
| **Error** | El plan referenciaba `indicador_codigo` como columna de `reglas_presupuesto` (sección 1.3, tabla 22) |
| **Realidad** | La migración `migration_direccion_presupuesto.sql` (v0.0.0007) cambió la columna a `indicador_nombre`. La BD actual confirma: `indicador_nombre character varying` |
| **Corrección** | Mapeo actualizado en sección 1.3: `indicador_nombre → indicator_name` |

#### O7. Nuevos componentes frontend no reflejados en inventario de migración

| | Detalle |
|---|--------|
| **Omisión** | Entre v0.0.0007 y v0.0.0008 se agregaron ~12 nuevos componentes React no incluidos en las secciones 7.5 y 7.6: `EjecucionMensualChart`, `PresupuestoActionToolbar`, `SemaphoreProgressBar`, `ReglaPresupuestoModal`, `PresupuestoFormModal`, `PresupuestoDrilldownModal`, `NuevaLineaPresupuestoModal`, `MesesDrilldownModal`, `PerspectiveSelector`, `FechaDisplay`, `DarkStatCard`, `BudgetAccumulatedChart` |
| **Corrección** | Componentes clave agregados a secciones 7.5 y 7.6 |

### 14.11 Resumen Actualizado

| Severidad | Rev. 2026-02-20 | Rev. 2026-02-21 | Rev. 2026-02-22 | Rev. 2026-02-26 | Total |
|-----------|-----------------|-----------------|-----------------|-----------------|-------|
| Crítico | 3 (E1-E3) | 0 | 0 | 0 | 3 |
| Medio | 3 (E4-E6) | 5 (E12-E13, E16-E18) | 1 (E19) | 1 (E20) | 10 |
| Menor | 4 (E7-E10) | 3 (E11, E14, E15) | 0 | 0 | 7 |
| Omisiones | 0 | 5 (O1-O5) | 0 | 2 (O6, O7) | 7 |
| Decisiones | 0 | 1 (D1) | 0 | 0 | 1 |
| **Total** | **10** | **14** | **1** | **3** | **28** |

**Estado**: Todos corregidos en este documento.

---

## 15. Decisiones Pendientes

1. ~~**¿Migrar datos existentes?**~~ — **DECIDIDO**: No migrar datos. Se empieza de cero en PH360. Los maestros (CC, conceptos, terceros, tipos gasto, reglas, indicadores) se crean por copropiedad con `property_id` desde el inicio (ver sección 3.5). Los movimientos históricos se pueden recargar desde Excel/PDF via `POST /api/conciliation/movements/upload` si es necesario.
2. ~~**¿Qué property_id usar?**~~ — **DECIDIDO** (ver sección 3.5): Se usa `property_id` como eje de datos. El `tenant_id` solo se usa para autenticación/permisos. La relación tenant↔property se gestiona en IAM.
3. ~~**¿Integrar con backend-financial?**~~ — **DECIDIDO**: Integrar en fase posterior. Se documenta el evento `CreditCardPaymentProcessedEvent` (`financial.payment.cc-processed`) con payload: `property_id`, `card_last4`, `usd_amount`, `cop_amount`, `trm_applied`, `payment_date`. Conciliation consume, actualiza monto USD→COP y publica `MovementAmountUpdatedEvent` (ya diseñado en sección 5.1). No se implementa hasta que backend-financial publique eventos reales (actualmente usa NoOp adapters).
4. ~~**¿Dashboard PH360 o dashboard independiente?**~~ — **DECIDIDO**: Ambos. Widgets resumen en el dashboard principal de PH360 (estado conciliación del mes, presupuesto vs real acumulado, alertas sobregasto) + página de dashboard detallado propia en `/conciliation/dashboard` con gráficos de tendencia, drill-down por CC y comparativo mensual.
5. ~~**¿Sidebar de PH360?**~~ — **DECIDIDO**: Secciones separadas. "Conciliación" y "Presupuestos" como secciones independientes al mismo nivel que "Financiero", "Proveedores", etc. Cada una tiene suficientes sub-páginas para justificar su propia sección. No se mezclan con "Financiero" existente (que maneja facturación de copropietarios).
6. ~~**¿Maestros compartidos entre servicios?**~~ — **DECIDIDO**: Desnormalizar en eventos. Los eventos Kafka incluyen `cost_center_name`, `concept_name`, `third_party_name` además de los IDs. Budget es autónomo sin queries HTTP cross-service. Si un maestro cambia de nombre, los registros históricos se actualizan con el rebuild periódico (ver sección 5.9 y decisión #7).
7. ~~**¿Rebuild automático o manual?**~~ — **DECIDIDO**: Job nocturno automático con detección de drift. Configuración en `application.yml` de backend-budget: `budget.read-model.drift-threshold: 0.0001` (0.01%) y `budget.read-model.rebuild-cron: "0 0 2 * * *"` (2:00 AM diario). El job itera cada `property_id` activo, compara totales `movement_summary` (budget) vs endpoint interno de conciliation, y ejecuta rebuild **solo para la property_id con desfase > threshold**. También disponible manualmente via `POST /api/budget/internal/read-model-rebuild`.
8. ~~**¿Eventos en batch o individuales?**~~ — **DECIDIDO** (ver sección 5.10): Enfoque híbrido con umbral configurable en `application.yml` (`bulk-threshold: 50`). Cargas pequeñas publican eventos individuales; cargas >= umbral publican 1 `BulkMovementsLoadedEvent` + rebuild HTTP parcial.
9. ~~**¿Cuentas independientes o extensión de payment?**~~ — **DECIDIDO** (ver sección 16): Reusar `payment.bank_accounts` como tabla base + tabla de extensión `conciliation.account_config` con campos específicos de conciliación (tipo_cuenta_id, pesos matching, permisos). Los FKs en schemas de conciliación usan `bank_account_id UUID` referenciando `payment.bank_accounts.id`.
10. ~~**¿Integrar con payment.bank_transactions?**~~ — **DECIDIDO**: Integración futura. `payment.bank_transactions` y `conciliation.bank_statements` son conceptos similares pero operan en dominios diferentes: payment reconcilia pagos de copropietarios vs facturas (FIFO), conciliación reconcilia gastos operativos. En fase futura, conciliación podría consumir `BankTransactionImportedEvent` de payment. No se implementa en fases 0-7.

---

## 16. Análisis de Maestros y Configuración: Conciliación vs PH360

**Fecha**: 2026-02-21
**Propósito**: Identificar qué tablas maestras/configuración ya existen en PH360, cuáles son nuevas, y cómo se resuelven los solapamientos.

### 16.1 Inventario: Tablas Maestro/Config de Conciliación

| # | Tabla | Dominio | Tipo | Columnas clave |
|---|-------|---------|------|----------------|
| 1 | `cuentas` | Conciliación | Maestro | cuentaid, cuenta, numero_cuenta, tipo_cuenta_id, permite_carga, permite_conciliar |
| 2 | `tipo_cuenta` | Conciliación | Config | id, nombre, pesos matching (referencia/descripcion/valor), permisos (crear/editar/borrar/clasificar) |
| 3 | `centro_costos` | Conciliación | Maestro | centro_costo_id, centro_costo, activa |
| 4 | `conceptos` | Conciliación | Maestro | conceptoid, concepto, centro_costo_id, activa |
| 5 | `terceros` | Conciliación | Maestro | terceroid, tercero, activa |
| 6 | `tercero_descripciones` | Conciliación | Maestro | id, terceroid, descripcion, referencia |
| 7 | `monedas` | Conciliación | Maestro | monedaid, isocode, moneda, activa |
| 8 | `tipo_mov` | Conciliación | Maestro | tipomovid, tipomov, activa |
| 9 | `tipos_gasto` | Presupuesto | Config | id, tipo, indicador_default, excluir_presupuesto, direccion, keywords (JSONB), prioridad |
| 10 | `indicadores_economicos` | Presupuesto | Config | id, anio, indicador, valor_porcentaje, rango_min/max_smlv |
| 11 | `configuracion_matching` | Conciliación | Config | id, tolerancia_valor, pesos (fecha/valor/descripcion), scores mínimos, palabras clave traslado |
| 12 | `matching_alias` | Conciliación | Config | id, cuenta_id, patron, reemplazo |
| 13 | `cuenta_extractores` | Conciliación | Config | id, cuenta_id, tipo (MOVIMIENTOS/RESUMEN), modulo, orden |
| 14 | `config_valor_pendiente` | Conciliación | Config | id, tipo, valor_id, descripcion |
| 15 | `config_filtro_centro_costo` | Conciliación | Config | id, centro_costo_id, etiqueta, activo_por_defecto |
| 16 | `reglas_presupuesto` | Presupuesto | Config | id, centro_costo_id, concepto_id, tipo_gasto, indicador_nombre, monto_fijo_mensual, factor_ajuste, direccion |
| 17 | `perspectivas` | Conciliación | Config | id, nombre, slug, tipo (incluir/excluir), centro_costo_ids, siempre_excluir_ids, es_defecto, orden, activa |

### 16.2 Inventario: Maestros/Config relevantes en PH360

| Servicio | Tabla | Tipo | Columnas clave | Relevancia |
|----------|-------|------|----------------|------------|
| backend-master | `countries` | Catálogo | iso_code_2, name, currency_code | Baja |
| backend-master | `service_category_catalog` | Catálogo | category_code, category_name (jerárquico) | Baja (distinto de centros de costo) |
| backend-iam | `tenants` | Maestro | id, name, status | Alta (autenticación) |
| backend-iam | `permissions` | Config | domain, action, resource, code | Media (RBAC) |
| backend-financial | `billing_concepts` | Maestro | concept_code, concept_name, concept_type, calculation_method | Media (distinto de conceptos de gasto) |
| **backend-payment** | **`bank_accounts`** | **Maestro** | **id (UUID), bank_name, account_type, account_number, currency, property_id** | **Alta (solapamiento)** |
| **backend-payment** | **`bank_transactions`** | **Transaccional** | **transaction_date, description, reference, debit/credit_amount, reconciliation_status** | **Alta (integración futura)** |
| backend-realestate | `properties` | Maestro | id (UUID), name, identification_code, address | Alta (eje de datos) |
| backend-supplier-invoice | `tax_codes`, `tax_rates` | Catálogo | code, name, percentage | Baja |

### 16.3 Tabla Comparativa: Decisiones

| # | Tabla Conciliación | Equivalente PH360 | Decisión | Justificación |
|---|-------------------|-------------------|----------|---------------|
| 1 | `cuentas` | `payment.bank_accounts` | **Extensión** | Reusar bank_accounts + crear `conciliation.account_config` (ver 16.4) |
| 2 | `tipo_cuenta` | — | **Nuevo** | Permisos y pesos de matching exclusivos de conciliación |
| 3 | `centro_costos` | — | **Nuevo** | Ejes de clasificación de gasto de la copropiedad. Distinto de service_category_catalog (categorías de servicio vs áreas de gasto) |
| 4 | `conceptos` | — | **Nuevo** | Conceptos de gasto e ingreso, dependientes de centro de costo (ej: CC "Servicios" → "Agua"; CC "Ingresos" → "Arriendo"). Tabla PH360: `conciliation.concepts` con FK a `cost_centers`. Sin equivalente previo en PH360. `financial.billing_concepts` es facturación a copropietarios — dominio completamente distinto |
| 5 | `terceros` | — | **Nuevo** | Proveedores/pagadores en extractos bancarios (EPM, EAAB, vigilancia). Sin equivalente en PH360. `iam.identities` son usuarios con login — dominio completamente distinto |
| 6 | `tercero_descripciones` | — | **Nuevo** | Aliases para matching. Sin equivalente |
| 7 | `monedas` | `master.countries.currency_code` | **Nuevo** | currency_code es atributo del país, no entidad gestionable con PK |
| 8 | `tipo_mov` | — | **Nuevo** | Tipos de movimiento bancario. Sin equivalente |
| 9 | `tipos_gasto` | — | **Nuevo** | Clasificación presupuestal (Fijo, Variable, Salarial, Estacional) |
| 10 | `indicadores_economicos` | — | **Nuevo** | IPC, SMLV, rangos salariales por año. Datos macroeconómicos colombianos |
| 11 | `configuracion_matching` | — | **Nuevo** | Config algoritmo scoring. payment tiene scores pero no tabla de configuración |
| 12 | `matching_alias` | — | **Nuevo** | Reglas de normalización por cuenta |
| 13 | `cuenta_extractores` | — | **Nuevo** | Mapeo cuenta a extractor PDF Bancolombia |
| 14 | `config_valor_pendiente` | — | **Nuevo** | Marca valores como pendientes de clasificación |
| 15 | `config_filtro_centro_costo` | — | **Nuevo** | Filtros de exclusión para dashboards |
| 16 | `reglas_presupuesto` | — | **Nuevo** | Reglas de generación por CC/concepto |
| 17 | `perspectivas` | — | **Nuevo** | Filtros de visualización por contexto. Sin equivalente en PH360 (concepto específico de conciliación personal) |

### 16.4 Detalle: Extensión `cuentas` → `account_config`

**Decisión**: Reusar `payment.bank_accounts` + crear `conciliation.account_config`.

```sql
-- Reemplaza la tabla conciliation.accounts del schema original (sección 6.2)
CREATE TABLE conciliation.account_config (
    id              BIGSERIAL PRIMARY KEY,
    property_id     UUID NOT NULL,
    bank_account_id UUID NOT NULL,                    -- FK lógico a payment.bank_accounts.id (no FK real cross-schema)
    account_type_id BIGINT REFERENCES conciliation.account_types(id),
    can_upload      BOOLEAN DEFAULT false,            -- Permite carga de extractos/movimientos
    can_reconcile   BOOLEAN DEFAULT true,             -- Permite conciliación
    display_order   INTEGER DEFAULT 0,                -- Orden en UI
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(property_id, bank_account_id)
);
CREATE INDEX idx_account_config_bank ON conciliation.account_config(bank_account_id);
```

**Flujo**:
1. El usuario crea cuenta bancaria en `payment.bank_accounts` (nombre, número, tipo, moneda)
2. En conciliación, al configurar la cuenta, se crea `account_config` vinculado al `bank_account_id`
3. El usuario configura: tipo_cuenta (permisos), habilitar carga, habilitar conciliación
4. Movimientos, extractos y reconciliaciones referencian `bank_account_id UUID`

**Impacto en schemas (sección 6.2)**:
- `conciliation.movements` → `bank_account_id UUID` (antes: `account_id BIGINT`)
- `conciliation.bank_statements` → `bank_account_id UUID`
- `conciliation.reconciliations` → `bank_account_id UUID`
- `conciliation.classification_rules` → `bank_account_id UUID`
- `conciliation.matching_aliases` → `bank_account_id UUID`

### 16.5 Integración Futura: `payment.bank_transactions`

| Aspecto | `bank_statements` (conciliación) | `bank_transactions` (payment) |
|---------|----------------------------------|-------------------------------|
| **Propósito** | Conciliar gastos operativos | Reconciliar pagos copropietarios vs facturas (FIFO) |
| **Fuente** | PDF/Excel Bancolombia (iText7) | Importación directa o API bancaria |
| **Campos comunes** | fecha, descripcion, referencia, valor, saldo | transaction_date, description, reference, debit/credit_amount, balance |
| **Campos únicos** | raw_text, numero_linea, source_file | reconciliation_status, confidence_score, matched_payment_id |

**Estado**: No implementar en fases 0-7. En fase futura, conciliación podría consumir `BankTransactionImportedEvent` de payment como fuente alternativa de datos bancarios.

### 16.6 Maestros PH360 que se consumen (solo lectura)

| Tabla PH360 | Mecanismo | Para qué |
|-------------|-----------|----------|
| `realestate.properties` | `property_id` en header | Eje de datos (sección 3.5) |
| `payment.bank_accounts` | FK lógico `bank_account_id` UUID | Datos cuenta (nombre, número, moneda) |
| `iam.tenants` | JWT | Autenticación |
| `iam.permissions` | `@RequiresPermission` | Autorización RBAC |

### 16.7 Resumen

| Categoría | Cantidad | Detalle |
|-----------|----------|---------|
| **Nuevo** (crear en conciliation/budget) | 15 | tipo_cuenta, centro_costos, conceptos, terceros, tercero_descripciones, monedas, tipo_mov, tipos_gasto, indicadores_economicos, configuracion_matching, matching_alias, cuenta_extractores, config_valor_pendiente, config_filtro_centro_costo, reglas_presupuesto, perspectivas |
| **Extensión** de PH360 | 1 | account_config (extiende payment.bank_accounts) |
| **Reusar** de PH360 (lectura) | 4 | properties, bank_accounts, tenants, permissions |
| **Integración futura** | 1 | bank_transactions (fase posterior) |

---

## Anexo A. Inventario Completo de Tablas — PH360

**Fecha**: 2026-02-21
**Total**: 38 tablas en 7 microservicios

### A.1 Tablas Maestras / Configuración (20)

**1. `iam.tenants`** — Registro central de tenants (compañías administradoras)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK |
| name | VARCHAR(200) | NOT NULL |
| identification_code | VARCHAR(50) | NOT NULL, UNIQUE |
| address | VARCHAR(500) | nullable |
| city | VARCHAR(100) | nullable |
| state | VARCHAR(100) | nullable |
| country | VARCHAR(100) | NOT NULL |
| email | VARCHAR(255) | NOT NULL |
| phone | VARCHAR(20) | nullable |
| logo | VARCHAR(500) | nullable |
| plan | VARCHAR(50) | NOT NULL (FREE, BASIC, PROFESSIONAL, ENTERPRISE) |
| status | VARCHAR(50) | NOT NULL (ACTIVE, INACTIVE, TRIAL, SUSPENDED) |
| settings | JSONB | nullable |
| slug | VARCHAR(100) | UNIQUE WHERE NOT NULL |
| created_at | TIMESTAMP(6) | NOT NULL |
| updated_at | TIMESTAMP(6) | NOT NULL |

**2. `iam.identities`** — Identidades globales (usuarios del sistema)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| email | VARCHAR(255) | NOT NULL, UNIQUE |
| password_hash | VARCHAR(255) | NOT NULL |
| first_name | VARCHAR(100) | nullable |
| last_name | VARCHAR(100) | nullable |
| phone | VARCHAR(20) | nullable |
| identification_type | VARCHAR(20) | nullable |
| identification_number | VARCHAR(50) | nullable |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'ACTIVE' (PENDING_ACTIVATION, ACTIVE, SUSPENDED, DELETED) |
| email_verified | BOOLEAN | DEFAULT FALSE |
| last_login_at | TIMESTAMPTZ | nullable |
| failed_login_attempts | INTEGER | DEFAULT 0 |
| locked_until | TIMESTAMPTZ | nullable |
| created_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMPTZ | nullable (soft delete) |

**3. `iam.roles`** — Roles RBAC (system + tenant-specific)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK |
| name | VARCHAR(100) | NOT NULL, UNIQUE(name, tenant_id) |
| description | VARCHAR(500) | nullable |
| is_system_role | BOOLEAN | NOT NULL |
| tenant_id | UUID | nullable (NULL = system role) |
| created_at | TIMESTAMP(6) | NOT NULL |
| updated_at | TIMESTAMP(6) | NOT NULL |

**4. `iam.permissions`** — Catálogo de permisos (domain.action.resource)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| domain | VARCHAR(50) | NOT NULL |
| action | VARCHAR(50) | NOT NULL |
| resource | VARCHAR(100) | NOT NULL |
| label | VARCHAR(255) | NOT NULL |
| description | TEXT | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMP(6) | DEFAULT now() |
| updated_at | TIMESTAMP(6) | DEFAULT now() |
| — | — | UNIQUE(domain, action, resource) |

**5. `iam.role_permissions`** — Asignación de permisos a roles

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| role_id | UUID | PK, FK → roles ON DELETE CASCADE |
| permission | VARCHAR(200) | PK |

**6. `realestate.properties`** — Copropiedades (eje de datos)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| name | VARCHAR(200) | NOT NULL |
| identification_code | VARCHAR(50) | NOT NULL, UNIQUE(identification_code, tenant_id) |
| type | VARCHAR(50) | NOT NULL (RESIDENTIAL, COMMERCIAL, MIXED_USE) |
| status | VARCHAR(50) | DEFAULT 'ACTIVE' (ACTIVE, INACTIVE, UNDER_CONSTRUCTION) |
| address | VARCHAR(500) | NOT NULL |
| city | VARCHAR(100) | NOT NULL |
| state | VARCHAR(100) | nullable |
| country | VARCHAR(100) | DEFAULT 'Colombia' |
| total_units | INTEGER | NOT NULL, CHECK > 0 |
| residential_units | INTEGER | nullable |
| commercial_units | INTEGER | nullable |
| total_area | DECIMAL(12,2) | NOT NULL, CHECK > 0 |
| constructed_area | DECIMAL(12,2) | nullable |
| common_area | DECIMAL(12,2) | nullable |
| legal_representative | VARCHAR(200) | nullable |
| legal_representative_id | VARCHAR(50) | nullable |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**7. `realestate.units`** — Unidades (apartamentos, locales, parqueaderos)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK |
| property_id | UUID | FK → properties ON DELETE CASCADE, NOT NULL |
| unit_number | VARCHAR(50) | NOT NULL, UNIQUE(unit_number, property_id) |
| type | VARCHAR(50) | NOT NULL (RESIDENTIAL, COMMERCIAL, PARKING, STORAGE) |
| status | VARCHAR(50) | DEFAULT 'VACANT' (VACANT, OCCUPIED, RENTED, UNDER_MAINTENANCE) |
| area | DECIMAL(10,2) | NOT NULL, CHECK > 0 |
| coefficient | DECIMAL(10,8) | NOT NULL, CHECK 0..1 |
| owner_id | UUID | nullable |
| owner_name | VARCHAR(200) | nullable |
| floor | INTEGER | nullable, CHECK >= 0 |
| bedrooms | INTEGER | nullable, CHECK >= 0 |
| bathrooms | INTEGER | nullable, CHECK >= 0 |
| parking_spaces | INTEGER | nullable, CHECK >= 0 |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**8. `realestate.owners`** — Propietarios con info extendida

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| user_id | UUID | NOT NULL |
| property_id | UUID | FK → properties ON DELETE CASCADE, NOT NULL |
| owner_type | owner_type_enum | DEFAULT 'individual' (individual, company, trust, government) |
| company_name | VARCHAR(255) | nullable |
| tax_id | VARCHAR(50) | nullable |
| legal_representative | VARCHAR(255) | nullable |
| emergency_contact_name | VARCHAR(255) | nullable |
| emergency_contact_phone | VARCHAR(20) | nullable |
| emergency_contact_email | VARCHAR(255) | nullable |
| mailing_address | TEXT | nullable |
| mailing_city | VARCHAR(100) | nullable |
| mailing_state | VARCHAR(100) | nullable |
| mailing_country | VARCHAR(100) | DEFAULT 'Colombia' |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| — | — | UNIQUE(user_id, property_id) |

**9. `financial.billing_concepts`** — Conceptos de facturación

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| property_id | UUID | NOT NULL |
| concept_code | VARCHAR(20) | NOT NULL, UNIQUE(tenant_id, property_id, concept_code) |
| concept_name | VARCHAR(255) | NOT NULL |
| description | TEXT | nullable |
| concept_type | concept_type_enum | NOT NULL (basic_administration, special_fund, extraordinary_quota, interest_penalty, adjustment, credit_balance) |
| calculation_method | calculation_method_enum | NOT NULL (by_coefficient, fixed_amount, percentage, installment_plan) |
| base_amount | DECIMAL(12,2) | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| apply_coefficient | BOOLEAN | DEFAULT TRUE |
| frequency | billing_frequency | DEFAULT 'monthly' |
| start_date | DATE | nullable |
| end_date | DATE | nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| version | BIGINT | DEFAULT 0 |

**10. `financial.extraordinary_quotas`** — Cuotas extraordinarias (asamblea)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| property_id | UUID | NOT NULL |
| quota_code | VARCHAR(50) | NOT NULL, UNIQUE(tenant_id, property_id, quota_code) |
| description | TEXT | NOT NULL |
| total_amount | DECIMAL(12,2) | NOT NULL, CHECK > 0 |
| assembly_act_id | UUID | nullable |
| approval_date | DATE | NOT NULL |
| effective_date | DATE | NOT NULL, CHECK >= approval_date |
| number_of_installments | INTEGER | NOT NULL, CHECK 1..12 |
| installment_amount | DECIMAL(12,2) | NOT NULL, CHECK > 0 |
| allow_early_payment | BOOLEAN | DEFAULT FALSE |
| early_payment_discount | DECIMAL(12,2) | DEFAULT 0 |
| status | quota_status | DEFAULT 'draft' (draft, approved, active, completed, cancelled) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| version | BIGINT | DEFAULT 0 |

**11. `payment.bank_accounts`** — Cuentas bancarias por copropiedad

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| property_id | UUID | NOT NULL |
| bank_name | VARCHAR(100) | NOT NULL |
| account_type | account_type_enum | NOT NULL (SAVINGS, CHECKING, PAYROLL) |
| account_number | VARCHAR(50) | NOT NULL, UNIQUE(tenant_id, property_id, account_number) |
| account_name | VARCHAR(255) | NOT NULL |
| currency | VARCHAR(3) | DEFAULT 'COP' |
| is_primary | BOOLEAN | DEFAULT FALSE |
| is_active | BOOLEAN | DEFAULT TRUE |
| opening_balance | NUMERIC(15,2) | DEFAULT 0 |
| current_balance | NUMERIC(15,2) | DEFAULT 0 |
| last_reconciliation_date | DATE | nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| version | BIGINT | DEFAULT 0 |

**12. `master.countries`** — Catálogo ISO 3166-1 de países

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| iso_code_2 | CHAR(2) | NOT NULL, UNIQUE |
| iso_code_3 | CHAR(3) | NOT NULL, UNIQUE |
| name | VARCHAR(255) | NOT NULL |
| name_es | VARCHAR(255) | nullable |
| phone_code | VARCHAR(10) | nullable |
| currency_code | CHAR(3) | nullable |
| flag_emoji | VARCHAR(10) | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**13. `master.states`** — Departamentos/estados por país

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| country_id | UUID | FK → countries ON DELETE CASCADE, NOT NULL |
| state_code | VARCHAR(10) | NOT NULL, UNIQUE(country_id, state_code) |
| name | VARCHAR(255) | NOT NULL |
| name_es | VARCHAR(255) | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**14. `master.cities`** — Ciudades por departamento

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| state_id | UUID | FK → states ON DELETE CASCADE, NOT NULL |
| city_code | VARCHAR(20) | nullable |
| name | VARCHAR(255) | NOT NULL |
| name_es | VARCHAR(255) | nullable |
| postal_code | VARCHAR(20) | nullable |
| is_capital | BOOLEAN | DEFAULT FALSE |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| — | — | UNIQUE(state_id, name) |

**15. `master.phone_formats`** — Formatos telefónicos por país

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| country_code | CHAR(2) | FK → countries(iso_code_2) ON DELETE CASCADE, NOT NULL |
| format | VARCHAR(50) | NOT NULL |
| placeholder | VARCHAR(50) | NOT NULL |
| min_length | INTEGER | DEFAULT 7 |
| max_length | INTEGER | DEFAULT 15 |
| is_mobile | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**16. `master.property_type_catalog`** — Tipos de propiedad

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| type_code | VARCHAR(20) | NOT NULL, UNIQUE |
| type_name | VARCHAR(100) | NOT NULL |
| type_name_es | VARCHAR(100) | nullable |
| description | TEXT | nullable |
| default_configuration | JSONB | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**17. `master.unit_type_catalog`** — Tipos de unidad

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| type_code | VARCHAR(20) | NOT NULL, UNIQUE |
| type_name | VARCHAR(100) | NOT NULL |
| type_name_es | VARCHAR(100) | nullable |
| description | TEXT | nullable |
| typical_area_range | VARCHAR(50) | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**18. `master.service_category_catalog`** — Categorías de servicio (jerárquico)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT uuid_generate_v4() |
| category_code | VARCHAR(20) | NOT NULL, UNIQUE |
| category_name | VARCHAR(100) | NOT NULL |
| category_name_es | VARCHAR(100) | nullable |
| parent_category_id | UUID | FK → self ON DELETE SET NULL, nullable |
| description | TEXT | nullable |
| typical_hourly_rate_min | DECIMAL(10,2) | nullable |
| typical_hourly_rate_max | DECIMAL(10,2) | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

**19. `communications.email_templates`** — Plantillas de email personalizables

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | nullable (NULL = global) |
| template_code | VARCHAR(100) | NOT NULL, UNIQUE(tenant_id, template_code) |
| template_name | VARCHAR(255) | NOT NULL |
| description | TEXT | nullable |
| subject_template | VARCHAR(500) | NOT NULL |
| html_template | TEXT | NOT NULL |
| text_template | TEXT | nullable |
| notification_type | notification_type | nullable |
| required_variables | TEXT[] | DEFAULT '{}' |
| optional_variables | TEXT[] | DEFAULT '{}' |
| version | INTEGER | DEFAULT 1 |
| is_active | BOOLEAN | DEFAULT TRUE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| created_by | UUID | nullable |
| updated_by | UUID | nullable |

**20. `communications.email_provider_config`** — Configuración de proveedores de email

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | nullable (NULL = global) |
| provider_name | VARCHAR(50) | NOT NULL (SENDGRID, SES, CONSOLE) |
| is_primary | BOOLEAN | DEFAULT FALSE |
| is_fallback | BOOLEAN | DEFAULT FALSE |
| config_data | JSONB | DEFAULT '{}' |
| daily_limit | INTEGER | nullable |
| hourly_limit | INTEGER | nullable |
| current_daily_count | INTEGER | DEFAULT 0 |
| current_hourly_count | INTEGER | DEFAULT 0 |
| limits_reset_at | TIMESTAMPTZ | nullable |
| is_active | BOOLEAN | DEFAULT TRUE |
| last_health_check_at | TIMESTAMPTZ | nullable |
| last_health_status | VARCHAR(20) | nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### A.2 Tablas Transaccionales (16)

**21. `iam.tenant_memberships`** — Relación identidad↔tenant

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| identity_id | UUID | FK → identities ON DELETE CASCADE, NOT NULL |
| tenant_id | UUID | FK → tenants ON DELETE CASCADE, NOT NULL |
| display_name | VARCHAR(100) | nullable |
| avatar_url | VARCHAR(500) | nullable |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'ACTIVE' (PENDING, ACTIVE, SUSPENDED, REMOVED) |
| invited_by | UUID | FK → identities, nullable |
| invited_at | TIMESTAMPTZ | nullable |
| joined_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |
| created_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMPTZ | DEFAULT CURRENT_TIMESTAMP |
| — | — | UNIQUE(identity_id, tenant_id) |

**22. `iam.user_roles`** — Asignación de roles a usuarios

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK |
| user_id | UUID | FK → tenant_memberships ON DELETE CASCADE, NOT NULL |
| role_id | UUID | FK → roles ON DELETE CASCADE, NOT NULL |
| membership_id | UUID | FK → tenant_memberships ON DELETE CASCADE, nullable |
| property_id | UUID | nullable (NULL = global role) |
| granted_by | UUID | NOT NULL |
| granted_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| expires_at | TIMESTAMP | nullable (NULL = permanent) |
| role | VARCHAR(255) | nullable |
| — | — | UNIQUE(user_id, role_id, property_id) |

**23. `iam.security_audit_logs`** — Auditoría de seguridad

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK |
| user_id | UUID | nullable |
| tenant_id | UUID | nullable |
| action | VARCHAR(100) | NOT NULL |
| resource | VARCHAR(50) | NOT NULL |
| resource_id | VARCHAR(100) | nullable |
| result | VARCHAR(20) | NOT NULL, CHECK (SUCCESS, FAILURE, SUSPICIOUS) |
| ip_address | VARCHAR(45) | NOT NULL |
| user_agent | VARCHAR(500) | NOT NULL |
| details | JSONB | nullable |
| timestamp | TIMESTAMP(6) | NOT NULL |

**24. `iam.password_reset_tokens`** — Tokens de recuperación de contraseña

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | BIGSERIAL | PK |
| token | VARCHAR(255) | NOT NULL, UNIQUE |
| user_id | UUID | FK → users_legacy, NOT NULL |
| expiry_date | TIMESTAMP | NOT NULL |
| used | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |

**25. `iam.users_legacy`** — Usuarios legacy (backward compatibility)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| email | VARCHAR(255) | NOT NULL, UNIQUE(tenant_id, email) |
| password_hash | VARCHAR(255) | NOT NULL |
| first_name | VARCHAR(100) | NOT NULL |
| last_name | VARCHAR(100) | NOT NULL |
| status | VARCHAR(50) | NOT NULL (PENDING_ACTIVATION, ACTIVE, INACTIVE, LOCKED, SUSPENDED) |
| last_login_at | TIMESTAMP | nullable |
| phone | VARCHAR(20) | nullable |
| identification_number | VARCHAR(100) | nullable |
| identification_type | VARCHAR(50) | nullable |
| email_verified | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| deleted_at | TIMESTAMP | nullable (soft delete) |

**26. `iam.user_roles_legacy`** — Roles legacy

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| user_id | UUID | PK, FK → users_legacy ON DELETE CASCADE |
| role | VARCHAR(100) | PK |
| expires_at | TIMESTAMPTZ | nullable |
| property_id | UUID | nullable |

**27. `realestate.unit_ownerships`** — Relaciones de propiedad (co-ownership)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| unit_id | UUID | FK → units ON DELETE CASCADE, NOT NULL |
| owner_id | UUID | FK → owners ON DELETE CASCADE, NOT NULL |
| ownership_percentage | DECIMAL(5,2) | DEFAULT 100.00, CHECK > 0 AND <= 100 |
| start_date | DATE | DEFAULT CURRENT_DATE |
| end_date | DATE | nullable (NULL = activo) |
| is_primary_owner | BOOLEAN | DEFAULT FALSE |
| ownership_document | VARCHAR(500) | nullable |
| notes | TEXT | nullable |
| created_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| updated_at | TIMESTAMP | DEFAULT CURRENT_TIMESTAMP |
| — | — | UNIQUE(unit_id, owner_id, start_date) |

**28. `financial.invoices`** — Facturas mensuales por unidad

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| property_id | UUID | NOT NULL |
| unit_id | UUID | NOT NULL |
| invoice_number | VARCHAR(50) | NOT NULL, UNIQUE(tenant_id, property_id, invoice_number) |
| billing_period | DATE | NOT NULL (YYYY-MM-01) |
| issue_date | DATE | NOT NULL |
| due_date | DATE | NOT NULL, CHECK >= issue_date |
| subtotal | DECIMAL(12,2) | NOT NULL, DEFAULT 0 |
| tax_amount | DECIMAL(12,2) | NOT NULL, DEFAULT 0 |
| total_amount | DECIMAL(12,2) | NOT NULL, CHECK >= 0 |
| outstanding_balance | DECIMAL(12,2) | NOT NULL, CHECK 0..total_amount |
| status | invoice_status | DEFAULT 'pending' (draft, pending, sent, paid, overdue, cancelled, partially_paid) |
| payment_reference | VARCHAR(100) | nullable |
| notes | TEXT | nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| version | BIGINT | DEFAULT 0 |

**29. `financial.invoice_line_items`** — Líneas de detalle de factura

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| invoice_id | UUID | FK → invoices ON DELETE CASCADE, NOT NULL |
| billing_concept_id | UUID | NOT NULL |
| description | VARCHAR(255) | NOT NULL |
| quantity | DECIMAL(10,2) | DEFAULT 1, CHECK > 0 |
| unit_price | DECIMAL(12,2) | NOT NULL, CHECK >= 0 |
| total_amount | DECIMAL(12,2) | NOT NULL, CHECK >= 0 |
| coefficient_applied | DECIMAL(8,6) | nullable, CHECK 0..1 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |

**30. `financial.payments`** — Pagos recibidos de copropietarios

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| property_id | UUID | NOT NULL |
| invoice_id | UUID | FK → invoices, nullable |
| payment_number | VARCHAR(50) | NOT NULL, UNIQUE(tenant_id, property_id, payment_number) |
| amount | DECIMAL(12,2) | NOT NULL, CHECK > 0 |
| payment_method | payment_method_enum | NOT NULL |
| payment_date | DATE | NOT NULL |
| bank_reference | VARCHAR(100) | nullable |
| bank_account_id | UUID | nullable |
| payer_name | VARCHAR(255) | nullable |
| payer_identification | VARCHAR(50) | nullable |
| payment_gateway_id | VARCHAR(100) | nullable |
| gateway_response | JSONB | nullable |
| status | payment_status | DEFAULT 'pending' |
| reconciled | BOOLEAN | DEFAULT FALSE |
| reconciliation_date | DATE | nullable |
| notes | TEXT | nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| version | BIGINT | DEFAULT 0 |

**31. `payment.payments`** — Registro de pagos (schema payment)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| property_id | UUID | NOT NULL |
| unit_id | UUID | NOT NULL |
| invoice_id | UUID | nullable |
| payment_number | VARCHAR(50) | NOT NULL, UNIQUE(tenant_id, property_id, payment_number) |
| amount | NUMERIC(15,2) | NOT NULL, CHECK > 0 |
| payment_method | payment_method_enum | NOT NULL (CASH, BANK_TRANSFER, CREDIT_CARD, DEBIT_CARD, CHECK, ELECTRONIC_PAYMENT, PSE, NEQUI, DAVIPLATA) |
| payment_date | DATE | NOT NULL |
| bank_reference | VARCHAR(100) | nullable |
| bank_account_id | UUID | FK → bank_accounts, nullable |
| payer_name | VARCHAR(255) | nullable |
| payer_identification | VARCHAR(50) | nullable |
| payment_gateway_id | VARCHAR(100) | nullable |
| gateway_response | JSONB | nullable |
| status | payment_status_enum | DEFAULT 'PENDING' |
| reconciled | BOOLEAN | DEFAULT FALSE |
| reconciliation_date | DATE | nullable |
| notes | TEXT | nullable |
| currency | VARCHAR(3) | DEFAULT 'COP' |
| deleted | BOOLEAN | DEFAULT FALSE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| created_by | VARCHAR(50) | NOT NULL |
| version | BIGINT | DEFAULT 0 |

**32. `payment.bank_transactions`** — Transacciones bancarias con AI matching

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| transaction_id | UUID | NOT NULL |
| tenant_id | UUID | NOT NULL |
| bank_account_id | UUID | FK → bank_accounts, NOT NULL |
| transaction_date | DATE | NOT NULL |
| value_date | DATE | nullable |
| description | TEXT | NOT NULL |
| reference | VARCHAR(100) | nullable |
| debit_amount | NUMERIC(19,4) | nullable, CHECK (solo debit o credit) |
| credit_amount | NUMERIC(19,4) | nullable |
| balance | NUMERIC(15,2) | nullable |
| balance_amount | NUMERIC(19,4) | nullable |
| balance_currency | VARCHAR(3) | nullable |
| credit_currency | VARCHAR(3) | nullable |
| debit_currency | VARCHAR(3) | nullable |
| transaction_type | transaction_type_enum | nullable (DEBIT, CREDIT, FEE, INTEREST, ADJUSTMENT) |
| payment_id | UUID | FK → payments, nullable |
| matched_payment_id | UUID | nullable |
| reconciled | BOOLEAN | DEFAULT FALSE |
| reconciliation_date | DATE | nullable |
| reconciliation_status | reconciliation_status_enum | DEFAULT 'PENDING' (PENDING, MATCHED_AUTO, MATCHED_MANUAL, UNMATCHED) |
| confidence_score | NUMERIC(3,2) | nullable, CHECK 0..1 |
| matched_by | VARCHAR(50) | nullable |
| matched_at | TIMESTAMPTZ | nullable |
| imported_at | TIMESTAMPTZ | DEFAULT NOW() |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| version | BIGINT | DEFAULT 0 |
| — | — | UNIQUE(tenant_id, bank_account_id, reference) |

**33. `payment.payment_allocations`** — Aplicación FIFO de pagos a facturas

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| payment_id | UUID | FK → payments ON DELETE CASCADE, NOT NULL |
| invoice_id | UUID | NOT NULL |
| allocated_amount | NUMERIC(12,2) | NOT NULL, CHECK > 0 |
| allocation_date | DATE | NOT NULL |
| allocated_to_interest | NUMERIC(15,2) | DEFAULT 0, CHECK >= 0 |
| allocated_to_principal | NUMERIC(15,2) | DEFAULT 0, CHECK >= 0 |
| source_type | VARCHAR(30) | DEFAULT 'MANUAL_PAYMENT' (MANUAL_PAYMENT, BANK_TRANSACTION, CREDIT_BALANCE_AUTO) |
| correlation_id | UUID | nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| created_by | VARCHAR(50) | NOT NULL |
| allocated_by | VARCHAR(255) | NOT NULL |
| currency | VARCHAR(3) | DEFAULT 'COP' |
| version | BIGINT | DEFAULT 0 |
| — | — | CHECK(allocated_amount = allocated_to_interest + allocated_to_principal) |

**34. `payment.credit_notes`** — Notas crédito

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| property_id | UUID | NOT NULL |
| unit_id | UUID | nullable |
| invoice_id | UUID | nullable (required si is_generic=false) |
| payment_id | UUID | FK → payments, nullable |
| credit_note_number | VARCHAR(50) | NOT NULL, UNIQUE(tenant_id, property_id, credit_note_number) |
| amount | NUMERIC(12,2) | NOT NULL, CHECK > 0 |
| currency | VARCHAR(3) | DEFAULT 'COP' |
| reason | TEXT | NOT NULL |
| is_generic | BOOLEAN | DEFAULT FALSE |
| status | VARCHAR(20) | DEFAULT 'PENDING' (PENDING, APPLIED, FAILED) |
| status_message | VARCHAR(500) | nullable |
| issue_date | DATE | DEFAULT CURRENT_DATE, CHECK <= CURRENT_DATE |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |
| created_by | VARCHAR(50) | NOT NULL |
| version | BIGINT | DEFAULT 0 |

**35. `supplier_invoice.supplier_invoices`** — Facturas de proveedores (UBL 2.1 / DIAN)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | BIGSERIAL | PK |
| tenant_id | UUID | NOT NULL |
| property_id | UUID | nullable |
| invoice_date | DATE | NOT NULL |
| nit | VARCHAR(50) | NOT NULL |
| supplier_name | VARCHAR(500) | NOT NULL |
| invoice_number | VARCHAR(100) | NOT NULL, UNIQUE(tenant_id, nit, invoice_number) |
| subtotal | DECIMAL(18,2) | NOT NULL, DEFAULT 0 |
| discounts | DECIMAL(18,2) | DEFAULT 0 |
| taxes | DECIMAL(18,2) | DEFAULT 0 |
| retentions | DECIMAL(18,2) | DEFAULT 0 |
| other_taxes | DECIMAL(18,2) | DEFAULT 0 |
| total | DECIMAL(18,2) | NOT NULL |
| other_concepts | JSONB | nullable |
| pdf_filename | VARCHAR(500) | nullable |
| xml_filename | VARCHAR(500) | nullable |
| created_at | TIMESTAMP | DEFAULT NOW() |
| updated_at | TIMESTAMP | DEFAULT NOW() |
| version | BIGINT | DEFAULT 0 |

**36. `communications.notification_logs`** — Log de notificaciones enviadas

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| id | UUID | PK |
| tenant_id | UUID | NOT NULL |
| notification_type | notification_type | NOT NULL (EMAIL_VERIFICATION, PASSWORD_RESET, INVOICE_GENERATED, PAYMENT_RECEIVED, PAYMENT_REMINDER, GENERAL_ANNOUNCEMENT) |
| channel | channel | DEFAULT 'EMAIL' (EMAIL, SMS, PUSH, WHATSAPP) |
| priority | priority | DEFAULT 'NORMAL' (CRITICAL, HIGH, NORMAL, LOW) |
| recipient_email | VARCHAR(255) | NOT NULL |
| recipient_name | VARCHAR(255) | nullable |
| subject | VARCHAR(500) | NOT NULL |
| template_name | VARCHAR(100) | nullable |
| template_variables | JSONB | DEFAULT '{}' |
| status | email_status | DEFAULT 'PENDING' (PENDING, QUEUED, SENT, DELIVERED, OPENED, CLICKED, BOUNCED, FAILED, RETRY) |
| provider_message_id | VARCHAR(255) | nullable |
| provider_name | VARCHAR(50) | nullable |
| retry_count | INTEGER | DEFAULT 0 |
| max_retries | INTEGER | DEFAULT 3 |
| next_retry_at | TIMESTAMPTZ | nullable |
| last_error_message | TEXT | nullable |
| error_details | JSONB | nullable |
| sent_at | TIMESTAMPTZ | nullable |
| delivered_at | TIMESTAMPTZ | nullable |
| opened_at | TIMESTAMPTZ | nullable |
| clicked_at | TIMESTAMPTZ | nullable |
| bounced_at | TIMESTAMPTZ | nullable |
| failed_at | TIMESTAMPTZ | nullable |
| reference_type | VARCHAR(50) | nullable |
| reference_id | UUID | nullable |
| metadata | JSONB | DEFAULT '{}' |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() |

### A.3 Tablas de Event Sourcing / Idempotencia (2)

**37. `payment.payment_events`** — Event store completo (audit trail)

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| event_id | UUID | PK, DEFAULT gen_random_uuid() |
| tenant_id | UUID | NOT NULL |
| aggregate_id | UUID | NOT NULL |
| aggregate_type | VARCHAR(50) | NOT NULL, CHECK (Payment, BankTransaction, CreditNote, PaymentAllocation) |
| property_id | UUID | NOT NULL |
| event_type | event_type_enum | NOT NULL (PaymentRegistered, PaymentApplied, PaymentReversed, CreditNoteIssued, PaymentAllocated, BankTransactionMatched, PaymentFailed, PaymentRefunded) |
| event_version | INTEGER | DEFAULT 1 |
| payload | JSONB | NOT NULL |
| metadata | JSONB | nullable |
| occurred_at | TIMESTAMPTZ | DEFAULT NOW() |
| user_id | VARCHAR(50) | nullable |

**38. `payment.processed_events`** — Idempotencia de sagas Kafka

| Columna | Tipo | Restricciones |
|---------|------|---------------|
| event_id | UUID | PK |
| event_type | VARCHAR(100) | NOT NULL |
| event_action | VARCHAR(100) | NOT NULL |
| source_service | VARCHAR(50) | NOT NULL |
| kafka_topic | VARCHAR(100) | NOT NULL |
| kafka_partition | INTEGER | nullable |
| kafka_offset | BIGINT | nullable |
| tenant_id | UUID | NOT NULL |
| aggregate_id | UUID | NOT NULL |
| aggregate_type | VARCHAR(50) | NOT NULL |
| processed_at | TIMESTAMPTZ | DEFAULT NOW() |
| processed_by | VARCHAR(100) | NOT NULL |
| event_payload | JSONB | nullable |
| created_at | TIMESTAMPTZ | DEFAULT NOW() |
| created_by | VARCHAR(100) | NOT NULL |

### A.4 Resumen por Microservicio

| Microservicio | Schema | Maestras | Transaccionales | Event Store | Total |
|--------------|--------|----------|-----------------|-------------|-------|
| backend-iam | public | 5 | 6 | — | 11 |
| backend-financial | financial | 2 | 3 | — | 5 |
| backend-payment | payment | 1 | 4 | 2 | 7 |
| backend-realestate | realestate | 3 | 1 | — | 4 |
| backend-master | master | 7 | — | — | 7 |
| backend-communications | communications | 2 | 1 | — | 3 |
| backend-supplier-invoice | supplier_invoice | — | 1 | — | 1 |
| **Total** | **7** | **20** | **16** | **2** | **38** |
