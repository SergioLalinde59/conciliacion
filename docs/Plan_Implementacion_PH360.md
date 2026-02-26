# Plan de Implementación por Etapas: Conciliación + Presupuestos en PH360

**Fecha**: 2026-02-22
**Estado**: Propuesta
**Referencia**: [Plan_Integracion_PH360.md](Plan_Integracion_PH360.md) — schemas SQL, mapeos campo a campo, payloads de eventos, decisiones de arquitectura

---

## Contexto

La app `conciliacion/` (Python 3.11/FastAPI + React 19) contiene dos dominios de negocio:

- **Conciliación bancaria**: movimientos, extractos PDF, matching inteligente, clasificación automática
- **Presupuestos**: generación inteligente, reglas por tipo de gasto, indicadores económicos, comparación presupuesto vs real

Estos dominios se migran a **PH360** (Java 21/Spring Boot 3.2.1 + Angular 20) como dos microservicios nuevos:

| Servicio | Puerto K8s | Context Path | Schema BD | Responsabilidad |
|----------|-----------|--------------|-----------|-----------------|
| `backend-conciliation` | 30089 | `/api/conciliation` | `conciliation` (19 tablas) | Movimientos, extractos, matching, clasificación, maestros |
| `backend-budget` | 30091 | `/api/budget` | `budget` (10 tablas) | Presupuestos, reglas, tipos gasto, indicadores, comparación |

**Comunicación**: Coreografía por eventos Kafka/CQRS. Budget mantiene un read model (`movement_summary`) alimentado por eventos de Conciliation.

**Modelo de referencia**: Copiar estructura de `backend-supplier-invoice/` (servicio más reciente de PH360, usa `property_id`, hexagonal limpio).

---

## Diagrama de Dependencias entre Fases

```
Fase 0 (Scaffolding)
  │
  ▼
Fase 1 (Maestros + Movimientos)
  │
  ├──────────┬──────────┐
  ▼          ▼          ▼
Fase 2     Fase 3     Fase 7
(Eventos)  (Matching)  (PDF Extractors)
  │          │          ║ paralelo
  ▼          │          ║
Fase 4      │          ║
(Clasif.)   │          ║
  │          │          ║
  ▼          │          ║
Fase 5      │          ║
(Ppto)      │          ║
  │          │          ║
  └────┬─────┘          ║
       ▼                ║
     Fase 6             ║
     (Dashboard)        ║
```

---

## Fase 0: Scaffolding de Infraestructura

**Objetivo**: Ambos servicios arrancan, Flyway crea schemas, K8s listo, Angular module creado.
**Complejidad**: Media | **~42 archivos**

### 0.1 backend-conciliation — Crear proyecto

Copiar estructura de `PH360/backend-supplier-invoice/` y adaptar:

| Archivo | Copiar/Adaptar de | Cambios |
|---------|-------------------|---------|
| `pom.xml` | `backend-supplier-invoice/pom.xml` | artifactId=`backend-conciliation`, agregar iText7 7.2.5, Apache POI 5.2.5, Apache Commons Text, Spring Cloud Stream |
| `Dockerfile` | Mismo patrón | Nombre del JAR |
| `ConciliationApplication.java` | `SupplierInvoiceApplication.java` | Paquete `com.ph360.conciliation` |
| `application.yml` | Mismo patrón | schema=`conciliation`, context-path=`/api/conciliation`, app name |
| `application-local.yml` | Nuevo | Kafka output bindings para 4 topics de movimientos |
| `application-kafka.yml` | Nuevo | Perfil kafka con StreamBridge |
| `SecurityConfig.java` | Copiar patrón | Scan `com.ph360.shared` |
| `GlobalExceptionHandler.java` | Copiar patrón | Tipos de excepción del dominio |

### 0.2 Flyway Migrations — Schema `conciliation`

SQL completo disponible en Plan_Integracion_PH360.md sección 6.2.

| Migración | Tablas |
|-----------|--------|
| `V1__create_conciliation_schema.sql` | `CREATE SCHEMA IF NOT EXISTS conciliation` |
| `V2__create_master_tables.sql` | `account_types`, `account_config`, `cost_centers`, `concepts`, `third_parties`, `third_party_aliases`, `movement_types` |
| `V3__create_config_tables.sql` | `matching_config`, `matching_aliases`, `account_extractors`, `classification_rules`, `cost_center_filters`, `pending_value_config`, `trm_cache` |
| `V4__create_movements_tables.sql` | `movements`, `movement_details` |
| `V5__create_bank_statements.sql` | `bank_statements` |
| `V6__create_reconciliation.sql` | `reconciliations`, `movement_matches` |
| `V7__create_processed_events.sql` | `processed_events` |

**Total**: 19 tablas. Todas incluyen `property_id UUID NOT NULL`.

### 0.3 backend-budget — Crear proyecto

Mismo patrón que conciliation:

| Archivo | Cambios clave |
|---------|---------------|
| `pom.xml` | artifactId=`backend-budget`, Spring Cloud Stream (sin iText7) |
| `application.yml` | schema=`budget`, context-path=`/api/budget` |
| `application-local.yml` | 4 consumer functions + 2 output bindings |

### 0.4 Flyway Migrations — Schema `budget`

| Migración | Tablas |
|-----------|--------|
| `V1__create_budget_schema.sql` | `CREATE SCHEMA IF NOT EXISTS budget` |
| `V2__create_budgets.sql` | `budgets` |
| `V3__create_budget_versions.sql` | `budget_versions` |
| `V4__create_budget_details.sql` | `budget_details` |
| `V5__create_budget_rules.sql` | `budget_rules` |
| `V6__create_expense_types.sql` | `expense_types` |
| `V7__create_economic_indicators.sql` | `economic_indicators` |
| `V8__create_movement_summary.sql` | `movement_summary` (CQRS read model) |
| `V9__create_processed_events.sql` | `processed_events` |
| `V10__seed_expense_types.sql` | INSERT: Fijo, Variable, Salarial, Estacional, No Repetitivo |

**Total**: 10 tablas (8 de negocio + 2 técnicas).

### 0.5 Kubernetes

| Archivo | Puerto |
|---------|--------|
| `k8s/local/29-backend-conciliation.yaml` | NodePort **30089** |
| `k8s/local/30-backend-budget.yaml` | NodePort **30091**, env `CONCILIATION_SERVICE_URL=http://backend-conciliation:8080` |

Actualizar `kustomization.yaml` para incluir ambos recursos.

### 0.6 Frontend Angular

| Archivo | Cambio |
|---------|--------|
| `features/conciliation/conciliation.routes.ts` | Crear — copiar patrón de `supplier-invoice/` |
| `features/conciliation/services/` | Servicios base con `ApiService` + `PropertyContextService` |
| `app.routes.ts` | Agregar lazy load para `/conciliation` y `/budget` |
| `proxy.conf.json` | Agregar `/api/conciliation` → `localhost:30089`, `/api/budget` → `localhost:30091` |

### 0.7 Verificación

- [ ] `mvn clean compile` pasa en ambos servicios
- [ ] `GET /actuator/health` responde 200 en ambos
- [ ] `\dt conciliation.*` muestra 19 tablas en PostgreSQL
- [ ] `\dt budget.*` muestra 10 tablas en PostgreSQL
- [ ] Swagger UI accesible: `/api/conciliation/swagger-ui.html`, `/api/budget/swagger-ui.html`
- [ ] K8s: `kubectl get pods` → ambos Running
- [ ] `ng serve` arranca sin errores, proxy responde (404 OK, no 502)

---

## Fase 1: Maestros + Movimientos CRUD (backend-conciliation)

**Objetivo**: CRUD completo de movimientos con datos maestros. Eventos NoOp (log sin enviar a Kafka).
**Complejidad**: Alta | **~77 archivos**
**Depende de**: Fase 0

### 1.1 Domain Layer

**Aggregates** (`domain/aggregate/`):

| Aggregate | Fuente Python | Campos clave |
|-----------|--------------|--------------|
| `masterdata/AccountConfig` | `domain/models/cuenta.py` | propertyId UUID, bankAccountId UUID, accountTypeId, canUpload, canReconcile |
| `masterdata/AccountType` | `domain/models/tipo_cuenta.py` | Permisos (canCreate, canEdit, canDelete, canClassify) + pesos matching (weightRef, weightDesc, weightVal) |
| `masterdata/CostCenter` | `domain/models/centro_costo.py` | id, propertyId, name, active |
| `masterdata/Concept` | `domain/models/concepto.py` | FK a CostCenter, gasto E ingreso |
| `masterdata/ThirdParty` | `domain/models/tercero.py` | id, propertyId, name, active |
| `masterdata/ThirdPartyAlias` | `domain/models/tercero_descripcion.py` | description, reference (para matching) |
| `masterdata/MovementType` | `domain/models/tipo_mov.py` | Catálogo simple |
| `movement/Movement` | `domain/models/movimiento.py` | **Aggregate root**. bankAccountId UUID, date, description, reference, amount, usd, trm, trmProvisional, source |
| `movement/MovementDetail` | `domain/models/movimiento_detalle.py` | costCenterId, conceptId, thirdPartyId, amount |
| `movement/MovementStatus` | Nuevo | Enum: PENDING, CLASSIFIED, RECONCILED |

**Regla de negocio crítica**: `AccountType` controla permisos. Solo tipo "Efectivo" (`canCreate=true`) permite crear/editar/eliminar movimientos manualmente. Bancaria/Tarjeta/Inversiones solo permiten clasificar.

**Value Objects**: `Money.java` (BigDecimal amount + String currency)

**Ports**:

```
domain/port/in/
├── CreateMovementUseCase.java
├── ListMovementsUseCase.java
├── UpdateMovementUseCase.java
├── DeleteMovementUseCase.java
└── UploadMovementsUseCase.java

domain/port/out/
├── MovementRepository.java
├── MovementDetailRepository.java
├── AccountConfigRepository.java
├── MasterDataRepository.java          ← CC, conceptos, terceros
└── ConciliationEventPublisherPort.java ← 5 métodos: publishMovementClassified, Reclassified, Deleted, AmountUpdated, BulkLoaded
```

**Events** (`domain/event/pubsub/` — Java records, NO implementan DomainEvent):

| Evento | Payload clave (del Plan doc sección 5.2) |
|--------|------------------------------------------|
| `MovementClassifiedEvent` | propertyId, movementId, detailId, costCenterId, costCenterName, conceptId, conceptName, thirdPartyId, thirdPartyName, amount, date, direction, accountId, occurredOn |
| `MovementReclassifiedEvent` | propertyId, detailId, old CC/concept/third, new CC/concept/third, amount, date, direction |
| `MovementDeletedEvent` | propertyId, movementId, detailIds[], amounts[] |
| `MovementAmountUpdatedEvent` | propertyId, detailId, oldAmount, newAmount |
| `BulkMovementsLoadedEvent` | propertyId, bankAccountId, count, year, month |

### 1.2 Application Layer

| Use Case | Fuente Python | Notas |
|----------|--------------|-------|
| `CreateMovementUseCaseImpl` | `cargar_movimientos_service.py` | Valida permisos AccountType (solo Efectivo puede crear manual). Publica evento NoOp |
| `ListMovementsUseCaseImpl` | Router `movimientos.py` | Paginación + filtros (bankAccountId, year, month) |
| `UpdateMovementUseCaseImpl` | Mismo | Valida `canEdit` |
| `DeleteMovementUseCaseImpl` | Mismo | Valida `canDelete`. Publica MovementDeletedEvent |
| `UploadMovementsUseCaseImpl` | `cargar_movimientos_service.py` | Apache POI para Excel/CSV. Estrategia híbrida (threshold `bulk-threshold: 50` en application.yml) |

Servicios: `ExcelImportService.java` — parser Excel/CSV con Apache POI

### 1.3 Infrastructure Layer

**JPA Entities** (17 entities para TODAS las tablas del schema `conciliation`):

Patrón a copiar de `SupplierInvoiceEntity.java`:
- `@Entity`, `@Table(name = "...", schema = "conciliation")`
- BIGSERIAL PK con `@GeneratedValue(strategy = GenerationType.IDENTITY)`
- `UUID propertyId` con `@Column(name = "property_id")`

**JPA Repositories**: Interfaces `extends JpaRepository<Entity, Long>`. Custom `@Query` para filtros con `property_id`.

**MapStruct Mappers**: `MovementMapper`, `MasterDataMapper`, `AccountConfigMapper`

**Repository Adapters**: Implementan ports del dominio. Patrón de `SupplierInvoiceRepositoryAdapter.java`.

**NoOp Event Publisher**: `ConciliationEventPublisherNoOpAdapter.java` — `@Component` default (sin anotación de perfil). Solo logea.

**REST Controllers**:

| Controller | Endpoints | Permiso IAM |
|-----------|-----------|-------------|
| `MovementController` | GET/POST/PUT/DELETE `/movements`, POST `/movements/upload`, POST `/movements/{id}/classify` | `conciliation.*.movement` |
| `AccountConfigController` | CRUD `/account-config`, CRUD `/account-types` | `conciliation.manage.catalog` |
| `CostCenterController` | CRUD `/cost-centers` | `conciliation.manage.catalog` |
| `CatalogController` | CRUD `/concepts`, `/third-parties`, `/movement-types`, GET `/catalogs` | `conciliation.*.catalog` |
| `InternalController` | GET `/internal/movement-summary` | `system.internal` |

### 1.4 Frontend Angular

| Componente | Portar de (React) |
|-----------|-------------------|
| `movements/movement-list/` | `MovimientosPage.tsx` |
| `movements/movement-form/` | `MovimientoFormPage.tsx` |
| `movements/upload-movements/` | `UploadMovimientosPage.tsx` |
| `master-data/accounts/` | `CuentasPage.tsx` |
| `master-data/cost-centers/` | `CentrosCostosPage.tsx` |
| `master-data/concepts/` | `ConceptosPage.tsx` |
| `master-data/third-parties/` | `TercerosPage.tsx` |

Servicios: `movement.service.ts`, `catalog.service.ts`
Modelos: `movement.model.ts`, `account-config.model.ts`

### 1.5 Testing

- **Unit tests**: Domain aggregates (Movement valida permisos AccountType). Jerarquía CostCenter/Concept.
- **Integration tests**: Repository adapters con TestContainers (PostgreSQL). Verificar Flyway + JPA.
- **Controller tests**: MockMvc para cada endpoint. Verificar `@RequiresPermission`.
- **Target**: ≥85% cobertura en domain + application.

### 1.6 Verificación

- [ ] Crear CC, concepto, tercero via API → verificar en BD
- [ ] Crear movimiento en cuenta "Efectivo" → 201 Created
- [ ] Intentar crear en cuenta "Bancaria" → 400 InvalidAccountTypeException
- [ ] Upload Excel → movimientos creados, NoOp logea eventos
- [ ] Listar con filtros → respuesta paginada correcta
- [ ] Swagger muestra todos los endpoints con schemas

---

## Fase 2: Infraestructura de Eventos + CQRS Read Model

**Objetivo**: Activar Kafka. Conciliation publica eventos reales. Budget consume y mantiene `movement_summary`.
**Complejidad**: Alta | **~25 archivos**
**Depende de**: Fase 1

### 2.1 Activar Kafka Adapter (backend-conciliation)

**Crear** `ConciliationEventPublisherAdapter.java`:
- `@Component @Profile({"kafka"})` — se activa agregando `kafka` a `SPRING_PROFILES_ACTIVE`
- Usa `StreamBridge` (patrón de `FinancialEventPublisherAdapter`)
- Partition key: `propertyId:movementId` (garantiza orden por movimiento)
- Headers: `event_type`, `event_version`, `source`, `property_id`
- Código ejemplo en Plan doc sección 5.3

El NoOp adapter de Fase 1 permanece como default cuando Kafka no está activo.

### 2.2 Event Consumers (backend-budget)

| Handler | Función | Lógica |
|---------|---------|--------|
| `MovementClassifiedStreamHandler` | `Consumer<Message<String>>` | Deserializa, verifica idempotencia (`ProcessedEventRepository`), upsert en `movement_summary`, `TenantContext.setTenantId(event.propertyId())` |
| `MovementReclassifiedStreamHandler` | Compensación | Restar clasificación anterior + sumar nueva en read model |
| `MovementDeletedStreamHandler` | Resta | Restar monto del read model |
| `MovementAmountUpdatedStreamHandler` | Delta | Actualizar diferencia de monto |
| `BulkMovementsLoadedStreamHandler` | Rebuild parcial | Llama `ConciliationApiClient` → trunca solo mes afectado → recarga |

Patrón: modelo funcional `Consumer<Message<T>>` (Spring Cloud Stream 4.x). Código en Plan doc sección 5.4.

### 2.3 Read Model Infrastructure (backend-budget)

| Archivo | Propósito |
|---------|-----------|
| `MovementSummaryEntity.java` | JPA entity para `budget.movement_summary` |
| `MovementSummaryJpaRepository.java` | `@Query` para INSERT ON CONFLICT UPDATE (upsert nativo) |
| `ProcessedEventEntity.java` | JPA entity para `budget.processed_events` |
| `ProcessedEventJpaRepository.java` | `existsByEventId(UUID)` |
| `MovementSummaryRepositoryAdapter.java` | Implementa port del dominio |
| `ReadModelRebuildService.java` | HTTP fallback: llama conciliation, trunca mes, recarga |
| `ConciliationApiClient.java` | Usa `RestClient` de shared-java (NO OpenFeign). Llama `GET /api/conciliation/internal/movement-summary?year=X` |

### 2.4 Testing

- **Crítico**: Integration test con Kafka embebido (TestContainers). Publicar `MovementClassifiedEvent` en conciliation → verificar `movement_summary` actualizado en budget.
- **Idempotencia**: Mismo eventId 2 veces → sin duplicación.
- **Compensación**: Reclasificación resta old + suma new correctamente.
- **Rebuild**: BulkMovementsLoaded → ConciliationApiClient llamado → rebuild solo del mes.

### 2.5 Verificación

- [ ] Arrancar ambos servicios con perfil `kafka`
- [ ] Clasificar movimiento → mensaje visible en Kafka UI topic `conciliation.movement.classified`
- [ ] `budget.movement_summary` tiene fila nueva/actualizada
- [ ] Reclasificar → compensación correcta en read model
- [ ] Eliminar movimiento → monto restado
- [ ] Enviar mismo evento 2 veces → `processed_events` previene duplicado
- [ ] Upload 60+ movimientos → `BulkMovementsLoadedEvent` → rebuild parcial
- [ ] Comparar totales `movement_summary` vs query directa a `movements` → deben coincidir

---

## Fase 3: Matching + Conciliación

**Objetivo**: Portar algoritmo de scoring Python → Java. Workflow completo de matching.
**Complejidad**: Alta | **~44 archivos**
**Depende de**: Fase 1 (Fase 2 recomendada)

### 3.1 Fuente Crítica

`Backend/src/domain/services/matching_service.py` — Contiene el algoritmo completo de scoring.

### 3.2 Domain Services

**`MatchingAlgorithmService.java`** — Servicio puro de dominio, sin dependencias:

| Método Python | Método Java | Lógica |
|--------------|-------------|--------|
| `calcular_score_fecha` | `calculateDateScore` | 0 o 1 (fecha exacta) |
| `calcular_score_valor` | `calculateAmountScore` | 0-1 (diferencia relativa con tolerancia de `matching_config`) |
| `calcular_score_descripcion` | `calculateDescriptionScore` | 0-1. **Reemplazar** Python `difflib.SequenceMatcher` con Apache Commons Text (`CosineSimilarity` o `LevenshteinDistance`) |
| `ejecutar_matching` | `executeMatching` | Combina scores con pesos configurables |

**Reglas críticas**:
- **Identidad fuerte**: fecha + valor exactos → mínimo PROBABLE (≥0.70)
- **Umbrales**: OK ≥0.95, PROBABLE ≥0.70, NO_MATCH <0.70
- **1-a-1**: Cada extracto → máximo 1 movimiento sistema (y viceversa)

**`ReconciliationService.java`** — Integridad 1-a-1. Una vez matched, ninguno de los dos puede ser matched de nuevo.

**Value Objects**: `MatchScore` (record: scoreDate, scoreAmount, scoreDescription, totalScore, status)

**Aggregates**:
- `Reconciliation` — bankAccountId, periodStart, periodEnd, status
- `MovementMatch` — FK a movement + bankStatement + reconciliation, scores, linkedManually
- `BankStatement` — bankAccountId, date, description, reference, amount, balance, sourceFile

### 3.3 Application + Infrastructure

| Componente | Detalle |
|-----------|---------|
| Use Cases | `ExecuteMatchingUseCaseImpl`, `LinkMovementsUseCaseImpl`, `GetMatchCandidatesUseCase` |
| JPA Entities | `BankStatementEntity`, `ReconciliationEntity`, `MovementMatchEntity` |
| Controllers | `ReconciliationController` (POST execute, GET candidates, POST link, DELETE), `BankStatementController` (GET list, POST upload placeholder para Fase 7) |

### 3.4 Frontend Angular

| Componente | Portar de |
|-----------|-----------|
| `reconciliation/reconciliation-dashboard/` | `ConciliacionPage.tsx` |
| `reconciliation/matching/` | `ConciliacionMatchingPage.tsx` |
| `reconciliation/matching-config/` | `MatchingConfigPage.tsx` |

### 3.5 Testing — Golden Data

**Crítico**: Extraer 10-20 escenarios reales del sistema Python como fixtures JSON en `src/test/resources/test-data/matching-golden-data.json`. Verificar scores IDÉNTICOS entre Python y Java.

Edge cases: cuentas USD (ajuste tolerancia), detección traslados (keywords), regla identidad (fecha+valor exactos), precisión del reemplazo de SequenceMatcher.

### 3.6 Verificación

- [ ] Crear movimientos y extractos del mismo periodo
- [ ] Ejecutar matching → scores calculados correctamente
- [ ] Verificar constraint 1-a-1 (mismo extracto no puede matchear dos movimientos)
- [ ] Link manual → linkedManually=true, scores guardados
- [ ] Comparar top-10 resultados con sistema Python para mismos datos

---

## Fase 4: Clasificación (5 Niveles)

**Objetivo**: Auto-clasificación multi-nivel + publicación masiva de eventos.
**Complejidad**: Alta | **~25 archivos**
**Depende de**: Fase 1 + Fase 2

### 4.1 Fuente Crítica

`Backend/src/application/services/clasificacion_service.py`

### 4.2 Domain Service

**`ClassificationService.java`** — 5 niveles en orden de prioridad:

| Nivel | Nombre | Lógica |
|-------|--------|--------|
| 1 | **Reglas estáticas** | Pattern matching en `classification_rules` (exact/contains/starts_with), ordenado por prioridad |
| 2 | **Referencia exacta** | Historial: misma cuenta + misma referencia → mismo CC/concepto/tercero |
| 3 | **Semántica** | Similitud de descripción (Apache Commons Text). Busca en historial de movimientos clasificados |
| 4 | **Valor** | Monto similar (±tolerancia) → mismo CC/concepto |
| 5 | **FondoRenta** | Regla especial: movimientos de fondo de inversión → CC/concepto predefinido |

**Value Object**: `ClassificationResult` (record: level 1-5, costCenterId, conceptId, thirdPartyId, confidence)

### 4.3 Application + Infrastructure

| Componente | Detalle |
|-----------|---------|
| `AutoClassifyUseCaseImpl` | Batch: itera no-clasificados, aplica 5 niveles, guarda detalle, publica eventos. Respeta threshold bulk (< 50 → eventos individuales, ≥ 50 → BulkMovementsLoadedEvent) |
| `ClassifyMovementUseCaseImpl` | Clasificación individual (trigger manual) → publica `MovementClassifiedEvent` |
| `SuggestReclassificationUseCaseImpl` | Retorna sugerencias sin side effects |
| `ClassificationController` | GET/POST `/classification-rules`, POST `/movements/auto-classify`, GET `/classification/preview`, GET `/classification/suggestions` |

### 4.4 Frontend

`movements/classify-movements/` — portar de `ClasificarMovimientosPage.tsx`

### 4.5 Testing

- Golden data: 20+ resultados de clasificación del sistema Python como fixtures.
- Test cada nivel aislado (rules, reference, semantic, amount, FondoRenta).
- **Integración eventos**: Auto-clasificar 10 movimientos → 10 `MovementClassifiedEvent` publicados → `movement_summary` actualizado.
- **Threshold batch**: Auto-clasificar 60 → `BulkMovementsLoadedEvent` en vez de eventos individuales.

### 4.6 Verificación

- [ ] Crear reglas → clasificar movimiento → CC/concepto/tercero asignado correctamente
- [ ] Auto-clasificar batch de 20 → todos clasificados + eventos publicados
- [ ] Reclasificar → `MovementReclassifiedEvent` → compensación en read model
- [ ] Comparar resultados con sistema Python para 50 movimientos

---

## Fase 5: Presupuesto (backend-budget)

**Objetivo**: Generación desde read model, comparación vs real, reglas, versiones.
**Complejidad**: Alta | **~68 archivos**
**Depende de**: Fase 2 (read model poblado) + Fase 4 (movimientos clasificados)

### 5.1 Fuentes Críticas

- `Backend/src/domain/services/presupuesto_generacion_service.py`
- `Backend/src/application/services/presupuesto_service.py`

### 5.2 Domain Layer

**Aggregates**:

| Aggregate | Campos clave |
|-----------|-------------|
| `Budget` | year, name, status (draft/active/cerrado), greenThreshold (≤10%), yellowThreshold (10-25%), umbrales mínimos, currentVersion, showInMillions |
| `BudgetDetail` | budgetId, costCenterId, conceptId, month, baseAmount, amount, expenseType, direction, version |
| `BudgetVersion` | budgetId, version, linesGenerated, totalBudgeted, sourceYear, notes |
| `BudgetRule` | costCenterId, conceptId, expenseType, indicatorName, adjustmentFactor, fixedMonthly, direction |
| `ExpenseType` | name, direction, defaultIndicator, keywords (JSONB), priority |
| `EconomicIndicator` | name, year, value |

**`BudgetGenerationService.java`** — Fórmula central:

```
monto_presupuestado = monto_base × (1 + (indicador + factor_ajuste) / 100)
```

Reglas por tipo de gasto:

| Tipo | Comportamiento |
|------|---------------|
| **Variable** | Usa indicador económico (default IPC). Fórmula estándar |
| **Fijo** | NO usa indicador. Usa `monto_fijo_mensual` de la regla directamente |
| **Salarial** | Indicador salarial específico por rango SMLV |
| **Estacional** | 12 filas con distribución histórica mensual (NO divide /12) |
| **No Repetitivo** | Si aparece en ≤ umbral meses → EXCLUIR. NUNCA suma al presupuesto |

**Jerarquía de reglas**: CC+Concepto > CC solo > Global > Default (variable/IPC)

**Fuente de datos**: `budget.movement_summary` (read model CQRS, NO tablas de conciliation)

**`BudgetComparisonService.java`**:
- FULL OUTER JOIN entre `budget_details` y `movement_summary` (ambas tablas locales en budget)
- Calcula varianza absoluta y porcentual
- Asigna semáforo: GREEN ≤10%, YELLOW 10-25%, RED >25%

**Value Objects**: `BudgetComparison`, `SemaphoreLevel` (enum: GREEN, YELLOW, RED)

**Events**: `BudgetActivatedEvent`, `BudgetOverspendAlertEvent`, `BudgetGeneratedEvent`

### 5.3 Application + Infrastructure

| Componente | Detalle |
|-----------|---------|
| `GenerateBudgetUseCaseImpl` | Lee `movement_summary`, aplica reglas + fórmula, guarda `budget_details` + `budget_version` |
| `CompareBudgetUseCaseImpl` | Llama `BudgetComparisonService` con `budget_details` y `movement_summary` |
| `CompareVersionsUseCaseImpl` | Join dos versiones del mismo presupuesto |
| `AdjustBudgetUseCaseImpl` | Ajustes: global %, por CC %, por línea. Incrementa versión |
| NoOp + Kafka event publishers | Para `BudgetActivatedEvent`, `BudgetOverspendAlertEvent` |
| `BudgetController` | CRUD + generate + compare + adjust + versions + export |
| `BudgetRuleController` | CRUD + batch |
| `ExpenseTypeController` | CRUD |
| `EconomicIndicatorController` | CRUD |

Endpoints completos en Plan doc sección 6.4.

### 5.4 Frontend Angular

| Componente | Portar de |
|-----------|-----------|
| `budget/budget-vs-actual/` | `PresupuestoVsRealPage.tsx` |
| `budget/budget-config/` | `PresupuestoConfigPage.tsx` |
| `budget/budget-execution/` | `EjecucionMensualPage.tsx` |
| `budget/expense-types/` | `TiposGastoPage.tsx` |
| `budget/economic-indicators/` | `IndicadoresEconomicosPage.tsx` |
| `budget/budget-rules/` | `ReglasPresupuestoPage.tsx` |
| `budget/expense-classification/` | `ClasificacionGastosPreviewPage.tsx` |

**Componentes shared nuevos** (no existen en PH360):

| Componente | Propósito |
|-----------|-----------|
| `shared/budget-bar-row/` | Barra semáforo con progreso visual |
| `shared/semaphore-badge/` | Badge verde/amarillo/rojo |
| `shared/drilldown-table/` | Tabla con drill-down CC → Concepto → Tercero |

Servicios: `budget.service.ts`, `expense-type.service.ts`, `economic-indicator.service.ts`, `budget-rule.service.ts`

### 5.5 Testing — Golden Data

- **Crítico**: Tests de fórmula con datos del sistema Python. Verificar montos exactos para cada tipo de gasto.
- **No Repetitivos**: Verificar que items con ≤ umbral meses se excluyen.
- **Estacionales**: Verificar 12 filas preservan proporciones históricas mensuales.
- **Jerarquía reglas**: Regla CC+Concepto overrides CC solo, overrides default.
- **Comparación**: FULL OUTER JOIN produce varianza y semáforo correctos.
- **Versiones**: Generar v1, ajustar, generar v2, comparar v1 vs v2.

### 5.6 Verificación

- [ ] Crear expense types, indicadores económicos, reglas presupuesto
- [ ] Generar presupuesto 2026 usando `movement_summary` de 2025 → fórmula aplicada correctamente
- [ ] Comparar presupuesto vs real → semáforo: verde ≤10%, amarillo 10-25%, rojo >25%
- [ ] Ajustar presupuesto global +5% → nueva versión creada
- [ ] Comparar v1 vs v2 → deltas correctos
- [ ] Activar presupuesto → `BudgetActivatedEvent` publicado

---

## Fase 6: Dashboard + Reportes

**Objetivo**: Dashboard unificado consumiendo ambas APIs. Endpoints de export Excel/PDF.
**Complejidad**: Media | **~26 archivos**
**Depende de**: Fases 1-5

### 6.1 Backend

**backend-conciliation**:

| Componente | Detalle |
|-----------|---------|
| `DashboardController` | `GET /dashboard/statistics` — totales movimientos, % clasificados, % conciliados, por cuenta |
| Consumer de `BudgetActivatedEvent` | Opcional: mostrar badge "presupuesto activo" en dashboard |

**backend-budget**:

| Componente | Detalle |
|-----------|---------|
| `BudgetDashboardController` | `GET /dashboard/budget-widget` — consumo mensual vs presupuesto con semáforo |
| | `GET /dashboard/budget-3months` — resumen últimos 3 meses |

**Exports** (Apache POI + iText7):

| Endpoint | Formato |
|----------|---------|
| `GET /api/conciliation/movements/export?format=xlsx\|pdf&year=2026&month=1` | Movimientos |
| `GET /api/conciliation/reports/classification/export?format=xlsx\|pdf` | Reporte clasificación |
| `GET /api/conciliation/reports/cost-centers/export?format=xlsx\|pdf` | Egresos por CC |
| `GET /api/budget/budgets/{id}/export?format=xlsx\|pdf` | Presupuesto |
| `GET /api/budget/budgets/{id}/comparison/export?format=xlsx\|pdf` | Ppto vs Real |

### 6.2 Frontend Angular

| Componente | Fuente |
|-----------|--------|
| `dashboard/conciliation-dashboard/` | `DashboardPage.tsx` — llama AMBAS APIs |
| `dashboard/components/budget-widget/` | Widget consumo mensual |
| `dashboard/components/budget-vs-real/` | Gráfico Chart.js (ya incluido en PH360 v4.5.1) |
| `dashboard/components/budget-3-months/` | Resumen 3 meses |
| `reports/classification-report/` | Reporte de clasificaciones |
| `reports/cost-center-report/` | Egresos por centro de costo |
| `reports/third-party-report/` | Egresos por tercero |
| `reports/monthly-report/` | Ingresos/gastos mensual |

Pipe: `currency-format.pipe.ts` (formateo COP/USD)

### 6.3 Verificación

- [ ] Dashboard carga stats de conciliation + widget presupuesto de budget
- [ ] Export Excel → archivo descarga con columnas correctas
- [ ] Export PDF → reporte formateado
- [ ] Reportes muestran drill-down CC → Concepto → Tercero

---

## Fase 7: Extractores PDF

**Objetivo**: Portar 18 extractores Bancolombia de pdfplumber (Python) a iText7 (Java).
**Complejidad**: Muy Alta | **~48 archivos**
**Depende de**: Fase 3 (schema `bank_statements` existe)
**Puede ejecutarse en paralelo con Fases 2-5**

### 7.1 Fuente

`Backend/src/infrastructure/extractors/bancolombia/` — 18 archivos Python con lógica de parsing específica por formato.

### 7.2 Infrastructure

**Interface común**:

```java
public interface BankStatementExtractor {
    List<BankStatementLine> extract(InputStream pdfStream);
    boolean canHandle(String module);
}
```

**18 Adapters** (cada uno `@Component` en `infrastructure/adapter/in/pdf/`):

| Grupo | Adaptadores Java | Fuente Python |
|-------|-----------------|---------------|
| **Ahorros** | `AhorrosExtractorAdapter`, `AhorrosMovimientosAdapter`, `AhorrosExcelAdapter` (Apache POI) | `ahorros_extracto.py`, `ahorros_movimientos.py`, `ahorros_movimientos_excel.py` |
| **FondoRenta** | `FondoRentaExtractorAdapter`, `FondoRentaMovimientosAdapter`, `FondoRentaExcelAdapter` | `fondorenta_extracto.py`, `fondorenta_movimientos.py`, `fondorenta_movimientos_excel.py` |
| **MasterCard COP** | `MasterCardPesosExtractorAdapter`, `MasterCardPesosAnteriorAdapter`, `MasterCardPesosMovimientosAdapter` | `mastercard_pesos_extracto.py`, `*_anterior.py`, `*_movimientos.py` |
| **MasterCard USD** | `MasterCardUsdExtractorAdapter`, `MasterCardUsdAnteriorAdapter`, `MasterCardUsdMovimientosAdapter` | `mastercard_usd_extracto.py`, `*_anterior.py`, `*_movimientos.py` |
| **MasterCard general** | `MasterCardMovimientosAdapter`, `MasterCardExcelAdapter` | `mastercard_movimientos.py`, `*_excel.py` |
| **Combinados** | `MasterCardPesosAnteriorMovimientosAdapter`, `MasterCardUsdAnteriorMovimientosAdapter` | Combinados de los anteriores |

**Orquestador**: `BancolombiaExtractorOrchestrator.java` — selecciona extractor correcto según configuración en tabla `account_extractors`.

**Utilidades**: `PdfParsingUtils.java` — parsing de números colombianos (1.234.567,89), fechas (DD/MM/YYYY, DD-MMM-YYYY), limpieza de texto.

**TRM**: `TrmService.java` + `TrmApiClient.java` — consulta TRM en API datos.gov.co (SOCRATA). Cache en tabla `trm_cache`.

### 7.3 Use Case

`LoadBankStatementUseCaseImpl.java`:
1. Recibe PDF/Excel
2. Selecciona extractor vía `BancolombiaExtractorOrchestrator`
3. Parsea archivo → lista de `BankStatementLine`
4. Guarda en `bank_statements`
5. Opcionalmente trigger matching automático
6. Publica eventos (respeta threshold bulk)

### 7.4 Frontend

`bank-statements/upload-statement/` — portar de `UploadExtractoPage.tsx`
`bank-statements/statement-detail/` — detalle de extracto cargado

### 7.5 Testing — Golden Data (CRÍTICO)

**Riesgo más alto de la migración**. iText7 parsea PDFs diferente a pdfplumber.

- Usar PDFs reales como fixtures en `src/test/resources/test-data/pdf-golden/`
- Para cada extractor: parsear mismo PDF con Python y Java, comparar output línea por línea
- Guardar outputs esperados como fixtures JSON
- Edge cases: PDFs multi-página, formatos irregulares, extractos USD con TRM

### 7.6 Verificación

- [ ] Upload PDF ahorros Bancolombia → movimientos extraídos correctamente
- [ ] Upload MasterCard COP → montos, fechas, descripciones coinciden con output Python
- [ ] Upload MasterCard USD → triplet USD/TRM/COP extraído correctamente
- [ ] Post-upload: eventos publicados → read model actualizado
- [ ] Comparar 5 PDFs entre Python y Java → <1% discrepancia

---

## Resumen

| Fase | Complejidad | Archivos | Riesgo principal |
|------|------------|----------|------------------|
| 0 — Scaffolding | Media | ~42 | Ambos servicios arrancando correctamente |
| 1 — Maestros + Movimientos | Alta | ~77 | Volumen de entidades (17 tablas, 15+ JPA entities) |
| 2 — Eventos + CQRS | Alta | ~25 | Primera integración cross-service, idempotencia |
| 3 — Matching | Alta | ~44 | Precisión del reemplazo de SequenceMatcher |
| 4 — Clasificación | Alta | ~25 | Algoritmo 5 niveles, publicación batch |
| 5 — Presupuesto | Alta | ~68 | Fórmula generación, no-repetitivos/estacionales/fijos |
| 6 — Dashboard + Reportes | Media | ~26 | Integración de ambas APIs, exports |
| 7 — PDF Extractors | Muy Alta | ~48 | 18 extractores, iText7 vs pdfplumber |
| **Total** | | **~355** | |

---

## Archivos Críticos de Referencia

| Archivo | Para qué |
|---------|----------|
| `PH360/backend-supplier-invoice/pom.xml` | Template para pom.xml de ambos servicios |
| `PH360/backend-supplier-invoice/.../SupplierInvoiceRepositoryAdapter.java` | Patrón hexagonal de persistencia |
| `PH360/backend-supplier-invoice/.../SupplierInvoiceEntity.java` | Patrón JPA entity con schema |
| `PH360/backend-supplier-invoice/.../SupplierInvoiceMapper.java` | Patrón MapStruct |
| `conciliacion/Backend/src/domain/services/matching_service.py` | Algoritmo de scoring (Fase 3) |
| `conciliacion/Backend/src/domain/services/presupuesto_generacion_service.py` | Fórmula generación (Fase 5) |
| `conciliacion/Backend/src/application/services/clasificacion_service.py` | 5 niveles clasificación (Fase 4) |
| `conciliacion/Backend/src/infrastructure/extractors/bancolombia/` | 18 extractores PDF (Fase 7) |
| `conciliacion/doc/Plan_Integracion_PH360.md` | Schemas SQL completos, payloads eventos, endpoints API, decisiones de arquitectura |