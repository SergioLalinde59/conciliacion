# Proyecto Conciliacion Bancaria

Sistema de conciliacion bancaria con arquitectura hexagonal.

## REGLAS CRITICAS

1. **NUNCA exponer credenciales** - Usar siempre variables de entorno (.env)
2. **Arquitectura Hexagonal estricta** - Respetar capas Domain > Application > Infrastructure
3. **El dominio NO depende de infraestructura** - Los servicios de dominio son puros
4. **Inyeccion de dependencias** - Usar FastAPI Depends, no instanciar directamente

## Stack Tecnologico

- **Backend:** FastAPI + Python 3.11 + PostgreSQL + psycopg2
- **Frontend:** React 19 + TypeScript + Vite + TanStack Query + Tailwind CSS
- **Contenedores:** Docker Compose

## Arquitectura Backend

```
Backend/src/
├── domain/           # Capa de Dominio (logica pura, sin dependencias externas)
│   ├── models/       # Entidades (dataclasses)
│   ├── ports/        # Interfaces abstractas (ABC)
│   ├── services/     # Servicios de dominio (algoritmos puros)
│   └── exceptions.py
├── application/      # Capa de Aplicacion (orquestacion)
│   └── services/     # Coordinan repositorios y servicios de dominio
└── infrastructure/   # Capa de Infraestructura (adaptadores)
    ├── api/          # FastAPI routers, schemas, dependencies
    ├── database/     # Repositorios PostgreSQL (implementan ports)
    ├── extractors/   # Parsers de extractos bancarios
    └── logging/      # Configuracion de logs
```

### Patron de Repositorios

```python
# Puerto (domain/ports/) - Interfaz abstracta
class MovimientoRepository(ABC):
    @abstractmethod
    def guardar(self, movimiento: Movimiento) -> Movimiento:
        pass

# Adaptador (infrastructure/database/) - Implementacion concreta
class PostgresMovimientoRepository(MovimientoRepository):
    def __init__(self, connection):
        self._conn = connection
```

### Inyeccion de Dependencias

```python
# infrastructure/api/dependencies.py
def get_movimiento_repository(conn=Depends(get_db_connection)) -> MovimientoRepository:
    return PostgresMovimientoRepository(conn)

# En routers - SIEMPRE usar Depends
@router.post("/")
def crear(repo: MovimientoRepository = Depends(get_movimiento_repository)):
    pass
```

## Arquitectura Frontend

```
frontend/src/
├── components/
│   ├── atoms/        # Componentes base (Button, Input, Badge)
│   ├── molecules/    # Combinaciones (Modal, Cards)
│   ├── organisms/    # Complejos (Tablas, Formularios)
│   └── templates/    # Layouts
├── pages/            # Vistas (React Router)
├── services/         # HTTP clients y logica
├── context/          # Context API (SettingsContext)
└── utils/            # Funciones utilitarias
```

### Patrones Frontend

- **React Query** para estado remoto (staleTime: 5min)
- **Context API** para estado global
- **Atomic Design** para componentes
- **Servicios centralizados** en `services/api.ts`

## Variables de Entorno

Configuradas en `.env` (NO versionar):

```
DB_HOST=host.docker.internal
DB_PORT=5433
DB_NAME=Mvtos
DB_USER=postgres
DB_PASSWORD=***
HOST_MOVIMIENTOS=path/to/movimientos
HOST_EXTRACTOS=path/to/extractos
HOST_BACKUPS=path/to/backups
```

## Convenciones de Codigo

### Python
- Archivos/carpetas: `snake_case`
- Clases: `PascalCase`
- Funciones: `snake_case`
- Type hints obligatorios
- Docstrings para funciones publicas

### TypeScript/React
- Componentes: `PascalCase.tsx`
- Servicios: `camelCase.ts`
- Named exports para componentes
- Interfaces: `PascalCase` (ButtonProps)

## Modelos de Dominio Principales

- `Movimiento` - Encabezado de movimiento bancario
- `MovimientoDetalle` - Desglose contable
- `MovimientoExtracto` - Movimiento del extracto bancario
- `MovimientoMatch` - Resultado del matching
- `Tercero` - Proveedor/Cliente
- `Cuenta` - Cuenta bancaria
- `Concepto` - Concepto contable
- `CentroCosto` - Centro de costo

## Endpoints Principales

```
/api/movimientos      - CRUD movimientos
/api/cuentas          - Cuentas bancarias
/api/terceros         - Terceros
/api/conciliaciones   - Matching y conciliacion
/api/dashboard        - Estadisticas
/api/archivos         - Carga de archivos
```

## Base de Datos

- PostgreSQL 18 Alpine
- Pool de conexiones: min=1, max=10
- Timezone: America/Bogota

## Documentacion Adicional

Ver carpeta `Arquitectura/` para documentacion detallada (no versionada).
