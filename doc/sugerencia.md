# Sugerencias de Mejora - Conciliacion Bancaria (Mvtos)

Documento generado tras revision exhaustiva del proyecto (~517 archivos).

---

## Resumen Ejecutivo

| Categoria | Hallazgos | Impacto |
|-----------|-----------|---------|
| Componentes repetidos (Frontend) | 18 modales CRUD con 70-90% codigo identico | Alto |
| Componentes repetidos (Backend) | 22 extractores con logica duplicada al 50%+ | Alto |
| Archivos sin uso | 5 archivos/directorios eliminables | Medio |
| Archivos sobredimensionados | 12 archivos con 600-1600 lineas | Medio |
| Documentacion faltante | backend.md y frontend.md no existian | Alto |
| Testing | Sin suite formal de tests | Alto |

---

## A. Componentes Repetidos - Frontend

### A1. Modales CRUD duplicados (PRIORIDAD ALTA)

**Problema:** 18 modales de formulario con estructura casi identica: `useState` por campo, `useEffect` para cargar datos, `handleSubmit`, y `Modal` con `Input` + botones Save/Cancel.

**Archivos afectados:**
- `frontend/src/components/organisms/CentroCostoModal.tsx`
- `frontend/src/components/organisms/MonedaModal.tsx`
- `frontend/src/components/organisms/TipoMovimientoModal.tsx`
- `frontend/src/components/organisms/TerceroModal.tsx`
- `frontend/src/components/organisms/ConceptoModal.tsx`
- `frontend/src/components/organisms/ConfigValorPendienteModal.tsx`
- `frontend/src/components/organisms/ConfigFiltroCentroCostoModal.tsx`
- `frontend/src/components/organisms/CuentaModal.tsx`
- Y 10 modales mas...

**Accion sugerida:** Crear componente generico `CrudFormModal` que reciba configuracion de campos como props:
```tsx
<CrudFormModal
  title="Centro de Costo"
  fields={[
    { name: 'nombre', label: 'Nombre', type: 'text', required: true },
    { name: 'descripcion', label: 'Descripcion', type: 'text' }
  ]}
  onSave={handleSave}
  data={selectedItem}
/>
```

**Complejidad:** Media | **Reduccion estimada:** ~500 lineas duplicadas

---

### A2. Tablas legacy con HTML hardcodeado (PRIORIDAD ALTA)

**Problema:** Existen dos enfoques para tablas: DataTable generico (moderno) vs HTML `<table>` hardcodeado (legacy).

**Archivos a migrar:**
- `frontend/src/components/organisms/MonedasTable.tsx` - HTML hardcodeado
- `frontend/src/components/organisms/TiposMovimientoTable.tsx` - HTML hardcodeado

**Referencia del patron correcto:**
- `frontend/src/components/organisms/CentrosCostosTable.tsx` - Usa DataTable correctamente

**Complejidad:** Simple | **Reduccion estimada:** ~80 lineas

---

### A3. ClassificationModal sin refactorizar (PRIORIDAD MEDIA)

**Problema:** `ClassificationModal.tsx` usa HTML de modal hardcodeado en lugar del componente base `Modal.tsx`.

**Archivo:** `frontend/src/components/organisms/ClassificationModal.tsx`

**Accion:** Refactorizar para usar `Modal.tsx` como los demas modales.

**Complejidad:** Simple

---

### A4. Sistema dual de cache (PRIORIDAD MEDIA)

**Problema:** Coexisten dos sistemas de cache:
1. `appCache` singleton (`utils/cache.ts` + `hooks/useCachedData.ts`)
2. React Query (`@tanstack/react-query`)

**Accion:** Migrar todo el uso de `appCache` / `useCachedData` a React Query y eliminar los archivos:
- `frontend/src/utils/cache.ts`
- `frontend/src/hooks/useCachedData.ts`

**Complejidad:** Media

---

### A5. Alias deprecado (PRIORIDAD BAJA)

**Problema:** `hooks/useCatalogo.ts` exporta `useCatalogo` como alias deprecated de `useCatalogos`.

**Accion:** Buscar todos los usos de `useCatalogo`, migrar a `useCatalogos`, y eliminar el alias.

**Complejidad:** Simple

---

## B. Componentes Repetidos - Backend

### B1. Extractores bancarios con logica duplicada (PRIORIDAD ALTA)

**Problema:** 19 archivos de extractores en `Backend/src/infrastructure/extractors/bancolombia/` con funciones repetidas como `parsear_valor()` y `_extraer_movimientos_desde_texto()`.

**Accion sugerida:**
1. Consolidar funciones comunes en `extractors/utils.py` (ya existente)
2. Crear clase base `BaseExtractor` con metodos template
3. Cada extractor solo define las diferencias especificas

**Complejidad:** Compleja | **Reduccion estimada:** ~300-400 lineas duplicadas

---

### B2. Repositorios con CRUD identico (PRIORIDAD MEDIA)

**Problema:** 27 repositorios PostgreSQL implementan los mismos metodos CRUD con estructura identica.

**Archivos:** Todos los `Backend/src/infrastructure/database/postgres_*_repository.py`

**Accion:** Crear `BasePostgresRepository` con metodos genericos:
```python
class BasePostgresRepository:
    def obtener_todos(self): ...
    def obtener_por_id(self, id): ...
    def crear(self, entity): ...
    def actualizar(self, entity): ...
    def eliminar(self, id): ...
```

**Complejidad:** Compleja (requiere cuidado con queries especializadas)

---

### B3. Funciones de transformacion dispersas (PRIORIDAD MEDIA)

**Problema:** Parsing de fechas, monedas y normalizacion de texto dispersos en:
- `extractors/utils.py`
- Extractores individuales
- `clasificacion_service.py`

**Accion:** Centralizar en modulo compartido (e.g., `domain/services/text_utils.py` o `infrastructure/shared/text_utils.py`)

**Complejidad:** Media

---

## C. Archivos Sin Uso / Legacy

### C1-C3. Frontend - Eliminar inmediatamente

| Archivo | Razon |
|---------|-------|
| `frontend/src/components/molecules/ExtractoResumenCinta.tsx` | 0 imports en todo el proyecto |
| `frontend/src/components/molecules/EditableCurrencyCell.tsx` | 0 imports en todo el proyecto |
| `frontend/src/style.css` | Template CSS de Vite, no importado. Proyecto usa Tailwind |

### C4-C5. Backend - Directorios legacy

| Directorio | Razon |
|------------|-------|
| `Backend/routes/` (1 archivo) | Fuera de arquitectura hexagonal, no importado por `src/` |
| `Backend/services/` (1 archivo) | Fuera de arquitectura hexagonal, no importado por `src/` |

Estos directorios contienen codigo legacy pre-hexagonal. La funcionalidad ya fue migrada a `src/`.

### C6. Servicio deprecated

**Archivo:** `Backend/src/application/services/procesador_archivos_service.py`
- Marcado como `[DEPRECATED / FACADE]`
- Aun importado por `archivos.py` y `conciliaciones.py`
- **Accion:** Evaluar si los routers pueden migrar a servicios especificos, luego eliminar

### C7. Scripts one-time

**Directorio:** `Backend/scripts/` (89 archivos)
- Mayoria son scripts de migracion y debug ejecutados una sola vez
- **Accion:** Mover los ya ejecutados a `Backend/scripts/archive/`

---

## D. Archivos Sobredimensionados

### Frontend

| Archivo | Lineas | Accion Sugerida |
|---------|--------|-----------------|
| `pages/PresupuestoDetallePage.tsx` | 956 | Extraer: tabla de detalle, formulario de ajuste, seccion de resumen |
| `pages/UploadExtractoPage.tsx` | 931 | Extraer: formulario de upload, preview de datos, resumen |
| `pages/ClasificarMovimientosPage.tsx` | 925 | Extraer: filtros, tabla de clasificacion, panel de acciones |
| `organisms/PreviewDataModal.tsx` | 754 | Extraer tabla de preview como sub-componente |
| `organisms/MovimientoModal.tsx` | 747 | Extraer logica a hook `useMovimientoForm`; dividir en secciones |
| `organisms/ClasificacionDetalleModal.tsx` | 746 | Extraer secciones como sub-componentes |
| `organisms/PresupuestoGenerarModal.tsx` | 615 | Extraer formulario y preview |
| `organisms/PresupuestoAjusteModal.tsx` | 615 | Extraer formulario y tabla |

### Backend

| Archivo | Lineas | Accion Sugerida |
|---------|--------|-----------------|
| `database/postgres_movimiento_repository.py` | 1,607 | Separar queries lectura vs escritura |
| `api/routers/matching.py` | 977 | Dividir en sub-routers (config, execution, validation) |
| `api/routers/movimientos.py` | 803 | Evaluar division por responsabilidad |
| `application/services/clasificacion_service.py` | 781 | Extraer algoritmos a metodos especializados |

---

## E. Testing

| # | Mejora | Prioridad | Complejidad |
|---|--------|-----------|-------------|
| E1 | Tests unitarios para utilidades (parsear_fecha, parsear_valor, normalizacion) | Alta | Simple |
| E2 | Suite pytest para servicios de aplicacion (clasificacion, presupuesto, matching) | Alta | Compleja |
| E3 | Tests de integracion para endpoints principales (movimientos CRUD, conciliacion) | Media | Compleja |

Actualmente solo existen scripts ad-hoc en `Backend/scripts/` y `Backend/tests/`, sin framework formal de testing.

---

## F. Seguridad

| # | Problema | Accion |
|---|---------|--------|
| F1 | Password de BD visible en `.env` | Usar Docker secrets o vault de credenciales |

---

## G. Limpieza de Codigo

| # | Problema | Accion |
|---|---------|--------|
| G1 | ~24 bloques de codigo comentado | Eliminar (historia disponible en git) |
| G2 | Archivos `__pycache__` en repositorio | Verificar .gitignore |

---

## Orden de Ejecucion Recomendado

### Fase 1 - Quick Wins (1-2 dias)
1. Eliminar archivos frontend sin uso (C1, C2, C3)
2. Eliminar directorios legacy backend (C4, C5)
3. Eliminar alias deprecated `useCatalogo` (A5)
4. Limpiar codigo comentado (G1)

### Fase 2 - Consolidacion Frontend (3-5 dias)
5. Migrar tablas legacy a DataTable (A2)
6. Refactorizar ClassificationModal (A3)
7. Crear CrudFormModal generico y migrar modales (A1)
8. Refactorizar MovimientoModal: extraer hook (D - MovimientoModal)

### Fase 3 - Consolidacion Backend (3-5 dias)
9. Consolidar extractores bancarios con BaseExtractor (B1)
10. Centralizar funciones de transformacion (B3)
11. Evaluar y eliminar procesador_archivos_service.py (C6)

### Fase 4 - Mejoras Estructurales (5-7 dias)
12. Migrar de cache dual a React Query unico (A4)
13. Crear BasePostgresRepository (B2)
14. Dividir archivos sobredimensionados (D)

### Fase 5 - Testing (continuo)
15. Tests unitarios de utilidades (E1)
16. Tests de servicios de aplicacion (E2)
17. Mejorar manejo de credenciales (F1)

---

## Verificacion

Para validar cada cambio:
- **Archivos eliminados:** `docker compose up` debe levantar sin errores
- **Componentes refactorizados:** Verificar visualmente en navegador que la UI se ve igual
- **Backend consolidado:** Probar endpoints afectados con curl/Postman
- **Tests:** Ejecutar suite completa despues de cada cambio
