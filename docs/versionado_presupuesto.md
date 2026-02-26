# Versionado de Presupuesto

**Fecha**: 2026-02-15
**Objetivo**: Preservar historial de generaciones al regenerar un presupuesto, sin borrar líneas anteriores.

---

## Problema Original

El endpoint `/regenerar` **eliminaba** todas las líneas de detalle antes de crear las nuevas. Si el presupuesto se generó con código viejo (ej: estacionales no se repartían en 12 meses), al regenerar se perdía la versión anterior sin posibilidad de comparar o auditar cambios.

## Solución

Al regenerar se crea una **nueva versión** (v2, v3...) sin borrar las anteriores. Reportes y dashboard siempre usan la versión más reciente. Un dropdown en la UI permite consultar el historial.

---

## 1. Esquema de Base de Datos

### Migración: `Sql/migration_version_presupuesto.sql`

```sql
-- Columna version_actual en presupuestos
ALTER TABLE presupuestos ADD COLUMN IF NOT EXISTS version_actual INTEGER NOT NULL DEFAULT 1;

-- Columna version en presupuesto_detalle
ALTER TABLE presupuesto_detalle ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;

-- Índice compuesto para filtrar por version
CREATE INDEX IF NOT EXISTS idx_pdetalle_version
    ON presupuesto_detalle(presupuesto_id, version);

-- Unique index actualizado (incluye version)
CREATE UNIQUE INDEX uq_pdetalle_linea ON presupuesto_detalle(
    presupuesto_id, centro_costo_id, COALESCE(concepto_id, 0),
    COALESCE(tercero_id, 0), mes, version
);

-- Tabla de metadatos de versiones
CREATE TABLE IF NOT EXISTS presupuesto_versiones (
    id SERIAL PRIMARY KEY,
    presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notas TEXT,
    lineas_generadas INTEGER DEFAULT 0,
    total_presupuestado NUMERIC(16,2) DEFAULT 0,
    anio_fuente INTEGER,
    UNIQUE (presupuesto_id, version)
);
```

### Diagrama de Relaciones

```
presupuestos (version_actual=2)
  │
  ├── presupuesto_detalle (version=1)  ← líneas originales
  ├── presupuesto_detalle (version=2)  ← líneas regeneradas
  │
  ├── presupuesto_versiones (version=1, lineas=913, total=$765M)
  └── presupuesto_versiones (version=2, lineas=950, total=$780M)
```

---

## 2. Flujo de Regeneración

```
Usuario: Click "Regenerar" (botón RefreshCcw en PresupuestosPage)
  │
  ├── Abre PresupuestoGenerarModal (mode='regenerar')
  │   ├── Step 1: Configuración (año fuente, umbrales, CC excluidos)
  │   ├── Step 2: Vista previa (previsualizar resultado)
  │   └── Step 3: Ejecutar regeneración
  │
  └── POST /api/presupuestos/{id}/regenerar
      │
      ├── 1. Validar estado (borrador o activo)
      ├── 2. INCREMENT version_actual → nueva_version
      ├── 3. Si activo → temporalmente borrador
      ├── 4. generar_desde_anio_anterior(version=nueva_version)
      │   ├── Clasificar gastos por tipo
      │   ├── Aplicar indicadores económicos
      │   ├── INSERT INTO presupuesto_detalle (version=nueva_version)
      │   └── INSERT INTO presupuesto_versiones (metadatos)
      ├── 5. Re-activar presupuesto
      └── 6. Retornar resultado con version number
```

**Clave**: Las líneas de versiones anteriores **nunca se eliminan**.

---

## 3. Cómo se Filtra por Versión

Todas las queries de resumen, comparación y reportes usan una subquery para obtener siempre la versión actual:

```sql
AND pd.version = (SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)
```

Esto aplica en:
- Resúmenes por CC, concepto, tercero, mensual
- Comparación presupuesto vs real (4 CTEs)
- Ajustes globales y por CC
- Widget de dashboard

Constante en el repo de detalle:
```python
_VERSION_ACTUAL_SQ = "(SELECT version_actual FROM presupuestos WHERE id = pd.presupuesto_id)"
```

---

## 4. Backend — Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `domain/models/presupuesto.py` | `+version_actual: int = 1` |
| `domain/models/presupuesto_detalle.py` | `+version: int = 1` |
| `domain/models/presupuesto_version.py` | **NUEVO** — dataclass con metadatos |
| `domain/ports/presupuesto_repository.py` | `+incrementar_version()` abstracto |
| `domain/ports/presupuesto_detalle_repository.py` | `+version` param, `+obtener_versiones()`, `+guardar_version()` |
| `database/postgres_presupuesto_repository.py` | `version_actual` en CRUD, `incrementar_version()` |
| `database/postgres_presupuesto_detalle_repository.py` | Reescrito: version en inserts/queries/resúmenes/ajustes |
| `database/postgres_presupuesto_comparacion_repository.py` | Filtro version en 4 CTEs de comparación |
| `application/services/presupuesto_service.py` | `regenerar_presupuesto()` reescrito, `version` param en `generar_desde_anio_anterior()` |
| `api/routers/presupuestos.py` | `RegenerarDTO` expandido, `GET /{id}/versiones`, `version_actual` en responses |

---

## 5. Frontend — Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `types/Presupuesto.ts` | `version_actual` en Presupuesto, `PresupuestoVersionInfo`, `version` en GeneracionResult |
| `services/presupuesto.service.ts` | `listarVersiones()`, `regenerar()` actualizado |
| `hooks/usePresupuesto.ts` | `usePresupuestoVersiones` hook |
| `pages/PresupuestosPage.tsx` | Botón `RefreshCcw` en activos, `generarMode` state, pass `mode` al modal |
| `organisms/modals/PresupuestoGenerarModal.tsx` | Prop `mode`, título dinámico, branching generar/regenerar, versión en resultado |
| `pages/PresupuestoDetallePage.tsx` | Badge `v{n}`, dropdown historial de versiones |

---

## 6. API Endpoints

### `POST /api/presupuestos/{id}/regenerar`

**Body** (todos opcionales):
```json
{
    "anio_fuente": 2025,
    "centros_costos_excluidos": [35, 46],
    "umbral": 3,
    "umbral_estacional": 3,
    "no_repetitivos_incluidos": null,
    "montos_fijos": null
}
```

**Response**:
```json
{
    "lineas_generadas": 950,
    "lineas_excluidas": 12,
    "incluidos_manualmente": 0,
    "fijos_incluidos": 5,
    "resumen": { "total_presupuestado": 780000000, ... },
    "version": 2,
    "mensaje": "Presupuesto regenerado (v2) y activado"
}
```

### `GET /api/presupuestos/{id}/versiones`

**Response**:
```json
[
    {
        "id": 2,
        "version": 2,
        "created_at": "2026-02-15 10:30:00",
        "notas": "Regeneración con estacionales corregidos",
        "lineas_generadas": 950,
        "total_presupuestado": 780000000,
        "anio_fuente": 2025
    },
    {
        "id": 1,
        "version": 1,
        "created_at": "2026-02-15 09:25:09",
        "notas": "Version inicial (migrada)",
        "lineas_generadas": 913,
        "total_presupuestado": 765257972.10,
        "anio_fuente": null
    }
]
```

---

## 7. UX en la Interfaz

### PresupuestosPage — Botón Regenerar
- Visible solo en presupuestos con estado **activo**
- Ícono: `RefreshCcw` (morado)
- Abre el mismo wizard de 3 pasos pero en modo `regenerar`
- El wizard llama `presupuestoService.regenerar()` en vez de `.generar()`

### PresupuestoGenerarModal — Modo Regenerar
- Título: "Regenerar Presupuesto" (en vez de "Generar")
- Botón Step 2: "Regenerar Presupuesto"
- Resultado Step 3: "Presupuesto regenerado" + badge "Versión N"

### PresupuestoDetallePage — Dropdown Versiones
- Visible solo si `version_actual > 1`
- Badge morado `v{n}` junto al nombre del presupuesto
- Click → dropdown con historial de versiones
- Cada entrada muestra: versión, fecha, líneas generadas, total, notas
- Versión actual marcada con "ACTUAL"
- Click fuera cierra el dropdown

---

## 8. Decisiones de Diseño

1. **No destructivo**: Las líneas antiguas permanecen en BD para auditoría
2. **Subquery en vez de param**: Reportes siempre usan `version_actual` vía subquery, sin necesidad de pasar versión explícitamente
3. **Tabla de metadatos separada**: `presupuesto_versiones` almacena estadísticas y timestamps sin recalcular
4. **Upsert en guardar_version**: `ON CONFLICT DO UPDATE` maneja interrupciones gracefully
5. **Estado temporal**: Si el presupuesto estaba activo, se pone en borrador temporalmente durante la regeneración y se re-activa al terminar
6. **Unique index con version**: Permite la misma combinación CC+Concepto+Tercero+Mes en versiones diferentes
