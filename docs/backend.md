# Arquitectura Backend - Conciliacion Bancaria (Mvtos)

## Stack Tecnologico

- **Framework:** FastAPI 0.109.2
- **Lenguaje:** Python 3.11
- **Base de Datos:** PostgreSQL 18 Alpine
- **Adaptador BD:** psycopg2-binary 2.9.9
- **Validacion:** Pydantic 2.6.1
- **Servidor:** Uvicorn 0.27.1 (ASGI)
- **Contenedor:** Docker

## Arquitectura Hexagonal

El backend sigue estrictamente el patron de Arquitectura Hexagonal (Ports & Adapters), donde el dominio es el nucleo sin dependencias externas.

```
Backend/src/
├── domain/                  # NUCLEO - Logica pura, sin dependencias externas
│   ├── models/              # Entidades del dominio (dataclasses)
│   ├── ports/               # Interfaces abstractas (ABC) - Puertos
│   ├── services/            # Servicios de dominio (algoritmos puros)
│   └── exceptions.py        # Jerarquia de excepciones del dominio
│
├── application/             # ORQUESTACION - Coordina dominio e infraestructura
│   └── services/            # Casos de uso de la aplicacion
│
└── infrastructure/          # ADAPTADORES - Implementaciones concretas
    ├── api/                 # Adaptador HTTP
    │   ├── main.py          # Punto de entrada FastAPI
    │   ├── dependencies.py  # Inyeccion de dependencias (Depends)
    │   ├── exception_handlers.py  # Mapeo excepciones -> HTTP status
    │   ├── schemas.py       # Esquemas Pydantic de request/response
    │   └── routers/         # Endpoints REST (26 routers)
    │
    ├── database/            # Adaptador de persistencia
    │   ├── connection.py    # Pool de conexiones PostgreSQL
    │   └── postgres_*.py    # Repositorios (implementan ports)
    │
    ├── extractors/          # Adaptador de archivos bancarios
    │   ├── utils.py         # Utilidades compartidas de parsing
    │   ├── bancolombia_adapter.py  # Adapter principal
    │   ├── fondorenta.py    # Extractor FondoRenta
    │   └── bancolombia/     # Extractores por producto bancario
    │
    ├── external/            # Adaptadores de servicios externos
    │   └── datos_gov_trm_provider.py  # Proveedor TRM (datos.gov.co)
    │
    └── logging/             # Configuracion de logs
        └── config.py        # Logger centralizado con rotacion
```

## Flujo de una Peticion HTTP

```
Request HTTP
    → Router (infrastructure/api/routers/)
        → Dependencies (infrastructure/api/dependencies.py)
            → Repository (infrastructure/database/postgres_*_repository.py)
                implementa → Port (domain/ports/*_repository.py)
                    usa → Model (domain/models/*.py)
            → Service (application/services/ o domain/services/)
        ← Response
```

## Capa de Dominio

### Modelos (27 entidades)

| Modelo | Archivo | Descripcion |
|--------|---------|-------------|
| Movimiento | `models/movimiento.py` | Encabezado de movimiento bancario |
| MovimientoDetalle | `models/movimiento_detalle.py` | Desglose contable del movimiento |
| MovimientoExtracto | `models/movimiento_extracto.py` | Movimiento del extracto bancario |
| MovimientoMatch | `models/movimiento_match.py` | Resultado del matching sistema vs extracto |
| Cuenta | `models/cuenta.py` | Cuenta bancaria |
| CuentaExtractor | `models/cuenta_extractor.py` | Configuracion de extractor por cuenta |
| TipoCuenta | `models/tipo_cuenta.py` | Tipo de cuenta (ahorros, corriente, etc.) |
| Moneda | `models/moneda.py` | Moneda (COP, USD) |
| TipoMov | `models/tipo_mov.py` | Tipo de movimiento (ingreso, egreso) |
| Tercero | `models/tercero.py` | Proveedor/Cliente |
| TerceroDescripcion | `models/tercero_descripcion.py` | Descripcion asociada a tercero |
| CentroCosto | `models/centro_costo.py` | Centro de costo |
| Concepto | `models/concepto.py` | Concepto contable |
| Conciliacion | `models/conciliacion.py` | Estado de conciliacion por periodo |
| ConfiguracionMatching | `models/configuracion_matching.py` | Configuracion del algoritmo de matching |
| MatchingAlias | `models/matching_alias.py` | Alias para matching de terceros |
| ReglaClasificacion | `models/regla_clasificacion.py` | Regla automatica de clasificacion |
| ConfigFiltroCC | `models/config_filtro_centro_costo.py` | Filtro de centro de costo |
| ConfigValorPendiente | `models/config_valor_pendiente.py` | Configuracion de valores pendientes |
| Presupuesto | `models/presupuesto.py` | Presupuesto |
| PresupuestoDetalle | `models/presupuesto_detalle.py` | Linea de presupuesto |
| ReglaPresupuesto | `models/regla_presupuesto.py` | Regla de calculo presupuestal |
| TipoGasto | `models/tipo_gasto.py` | Categoria de gasto |
| IndicadorEconomico | `models/indicador_economico.py` | Indicador economico (IPC, etc.) |
| GeneracionResult | `models/generacion_result.py` | Resultado de generacion de presupuesto |
| Trm | `models/trm.py` | Tasa representativa del mercado |

### Puertos (Interfaces Abstractas - 22 ports)

Cada puerto define el contrato que debe implementar un adaptador:

- `movimiento_repository.py`, `movimiento_extracto_repository.py`, `movimiento_vinculacion_repository.py`
- `cuenta_repository.py`, `cuenta_extractor_repository.py`
- `moneda_repository.py`, `tipo_mov_repository.py`, `tipo_cuenta_repository.py`
- `tercero_repository.py`, `tercero_descripcion_repository.py`
- `centro_costo_repository.py`, `concepto_repository.py`
- `conciliacion_repository.py`, `configuracion_matching_repository.py`, `matching_alias_repository.py`
- `reglas_repository.py`, `config_filtro_centro_costo_repository.py`, `config_valor_pendiente_repository.py`
- `presupuesto_repository.py`, `presupuesto_detalle_repository.py`, `presupuesto_generacion_repository.py`, `presupuesto_comparacion_repository.py`
- `tipo_gasto_repository.py`, `indicador_economico_repository.py`, `regla_presupuesto_repository.py`
- `trm_repository.py`, `trm_provider.py`
- `extracto_reader.py` (puerto para lectores de extractos)

### Servicios de Dominio (4 servicios)

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| MatchingService | `services/matching_service.py` | Algoritmo de matching sistema vs extracto (similitud hibrida) |
| ConciliacionService | `services/conciliacion_service.py` | Logica de conciliacion y estado de periodos |
| DateRangeService | `services/date_range_service.py` | Calculo de rangos de fechas para periodos |
| PresupuestoGeneracionService | `services/presupuesto_generacion_service.py` | Generacion automatica de presupuestos |

### Excepciones (20 clases)

Jerarquia desde `DomainException`:
- `EntityNotFoundException` (404)
- `ValidationException` (400)
- `DatabaseException` (500)
- `FileProcessingException` (400)
- `BusinessRuleException` (422)

## Capa de Aplicacion

### Servicios de Aplicacion (8 servicios)

| Servicio | Archivo | Responsabilidad |
|----------|---------|-----------------|
| ClasificacionService | `clasificacion_service.py` (781 lineas) | Motor de clasificacion multi-regla |
| PresupuestoService | `presupuesto_service.py` (421 lineas) | Gestion completa de presupuestos |
| CargarExtractoBancarioService | `cargar_extracto_bancario_service.py` (413 lineas) | Carga de extractos bancarios |
| CargarMovimientosService | `cargar_movimientos_service.py` (337 lineas) | Carga masiva de movimientos |
| MatchingValidationService | `matching_validation_service.py` | Validacion de matches |
| MantenimientoService | `mantenimiento_service.py` | Operaciones de mantenimiento |
| ProcesadorArchivosService | `procesador_archivos_service.py` | **[DEPRECATED]** Fachada legacy |
| TrmApplicationService | `trm_application_service.py` | Gestion de TRM |

## Capa de Infraestructura

### Routers API (26 endpoints)

| Router | Prefijo | Descripcion |
|--------|---------|-------------|
| movimientos | `/api/movimientos` | CRUD de movimientos del sistema |
| cuentas | `/api/cuentas` | Cuentas bancarias |
| monedas | `/api/monedas` | Monedas |
| tipos_movimiento | `/api/tipos-movimiento` | Tipos de movimiento |
| terceros | `/api/terceros` | Terceros (proveedores/clientes) |
| tercero_descripciones | `/api/tercero-descripciones` | Descripciones de terceros |
| centros_costos | `/api/centros-costos` | Centros de costo |
| conceptos | `/api/conceptos` | Conceptos contables |
| catalogos | `/api/catalogos` | Datos maestros combinados |
| clasificacion | `/api/clasificacion` | Clasificacion de movimientos |
| archivos | `/api/archivos` | Carga/descarga de archivos |
| reglas | `/api/reglas` | Reglas de clasificacion |
| config_filtros_centros_costos | `/api/config-filtros-centros-costos` | Filtros de centros de costo |
| config_valores_pendientes | `/api/config-valores-pendientes` | Valores pendientes |
| conciliaciones | `/api/conciliaciones` | Conciliacion bancaria |
| extractores | `/api/extractores` | Configuracion de extractores |
| matching | `/api/matching` | Algoritmo de matching |
| dashboard | `/api/dashboard` | Estadisticas y metricas |
| admin | `/api/admin` | Administracion y reset |
| mantenimiento | `/api/mantenimiento` | Operaciones de mantenimiento |
| tipos_cuenta | `/api/tipos-cuenta` | Tipos de cuenta |
| presupuestos | `/api/presupuestos` | Gestion de presupuestos |
| tipos_gasto | `/api/tipos-gasto` | Categorias de gasto |
| indicadores_economicos | `/api/indicadores-economicos` | Indicadores (IPC, etc.) |
| reglas_presupuesto | `/api/reglas-presupuesto` | Reglas presupuestales |
| trm | `/api/trm` | Tasa representativa del mercado |

### Repositorios PostgreSQL (27 implementaciones)

Cada uno implementa su puerto correspondiente usando psycopg2 directo (sin ORM):

- `postgres_movimiento_repository.py` (1,607 lineas - el mas grande)
- `postgres_cuenta_repository.py`, `postgres_moneda_repository.py`
- `postgres_tipo_mov_repository.py`, `postgres_tipo_cuenta_repository.py`
- `postgres_tercero_repository.py`, `postgres_tercero_descripcion_repository.py`
- `postgres_centro_costo_repository.py`, `postgres_concepto_repository.py`
- `postgres_conciliacion_repository.py`, `postgres_movimiento_extracto_repository.py`
- `postgres_movimiento_vinculacion_repository.py`
- `postgres_configuracion_matching_repository.py`, `postgres_matching_alias_repository.py`
- `postgres_reglas_repository.py`
- `postgres_config_filtro_centro_costo_repository.py`, `postgres_config_valor_pendiente_repository.py`
- `postgres_cuenta_extractor_repository.py`
- `postgres_presupuesto_repository.py`, `postgres_presupuesto_detalle_repository.py`
- `postgres_presupuesto_generacion_repository.py`, `postgres_presupuesto_comparacion_repository.py`
- `postgres_tipo_gasto_repository.py`, `postgres_indicador_economico_repository.py`
- `postgres_regla_presupuesto_repository.py`
- `postgres_trm_repository.py`

### Extractores Bancarios (19 archivos en bancolombia/)

Organizados por producto bancario y tipo de archivo:

**Ahorros:**
- `ahorros_extracto.py` - PDF extracto bancario
- `ahorros_extracto_movimientos.py` - Movimientos del extracto PDF
- `ahorros_movimientos.py` - Movimientos CSV/TXT
- `ahorros_movimientos_excel.py` - Movimientos Excel

**FondoRenta:**
- `fondorenta_extracto.py` - PDF extracto
- `fondorenta_extracto_movimientos.py` - Movimientos del extracto
- `fondorenta_movimientos.py` - Movimientos CSV/TXT
- `fondorenta_movimientos_excel.py` - Movimientos Excel

**Mastercard COP:**
- `mastercard_pesos_extracto.py` - PDF extracto actual
- `mastercard_pesos_extracto_anterior.py` - PDF extracto formato anterior
- `mastercard_pesos_extracto_movimientos.py` - Movimientos del extracto
- `mastercard_pesos_extracto_anterior_movimientos.py` - Movimientos formato anterior

**Mastercard USD:**
- `mastercard_usd_extracto.py` - PDF extracto actual
- `mastercard_usd_extracto_anterior.py` - PDF extracto formato anterior
- `mastercard_usd_extracto_movimientos.py` - Movimientos del extracto
- `mastercard_usd_extracto_anterior_movimientos.py` - Movimientos formato anterior

**Mastercard compartido:**
- `mastercard_movimientos.py` - Movimientos CSV/TXT
- `mastercard_movimientos_excel.py` - Movimientos Excel

**Utilidades compartidas:**
- `utils.py` - `parsear_fecha()`, `parsear_valor()`, `obtener_nombre_mes()`, etc.

### Conexion a Base de Datos

- Pool de conexiones con lazy initialization
- `connection.py`: `get_connection_pool()`, `get_db_connection()`, `close_all_connections()`
- Configuracion: min=1, max=10 conexiones
- Timezone: America/Bogota

## Inyeccion de Dependencias

Centralizada en `dependencies.py` usando `FastAPI.Depends`:

```python
# Patron: Puerto -> Adaptador via Depends
def get_movimiento_repository(conn=Depends(get_db_connection)) -> MovimientoRepository:
    return PostgresMovimientoRepository(conn)
```

Cada router recibe sus dependencias como parametros del endpoint, nunca las instancia directamente.

## Convenciones

- Archivos y carpetas: `snake_case`
- Clases: `PascalCase`
- Funciones y metodos: `snake_case`
- Type hints obligatorios en todas las firmas
- Docstrings para funciones publicas
- Logs estructurados via `logger` centralizado
- Excepciones de dominio mapeadas automaticamente a HTTP status codes
