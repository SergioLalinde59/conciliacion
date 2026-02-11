# Plan de Implementacion: Sistema de Presupuesto

## Contexto

El sistema de conciliacion bancaria necesita un modulo de presupuesto para planificar gastos 2026 basado en datos reales 2025. El presupuesto opera a nivel de clasificacion (Centro Costo / Concepto / Tercero) y permite comparar presupuesto vs real con semaforos y drill-down.

La propuesta completa esta en `doc/Propuesta_Presupuesto_2026.md`.

---

## FASE 1: Base de Datos + Backend (Tasks 1-16)

### Task 1: Migracion SQL
**Crear:** `Sql/migration_presupuesto.sql`

```sql
CREATE TABLE IF NOT EXISTS presupuestos (
    id SERIAL PRIMARY KEY,
    anio INTEGER NOT NULL,
    nombre VARCHAR(200) NOT NULL,
    estado VARCHAR(20) NOT NULL DEFAULT 'borrador'
        CHECK (estado IN ('borrador', 'activo', 'cerrado')),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_presupuestos_anio ON presupuestos(anio);
-- Solo 1 activo por año:
CREATE UNIQUE INDEX IF NOT EXISTS uq_presupuesto_activo_anio
    ON presupuestos(anio) WHERE estado = 'activo';

CREATE TABLE IF NOT EXISTS presupuesto_detalle (
    id SERIAL PRIMARY KEY,
    presupuesto_id INTEGER NOT NULL REFERENCES presupuestos(id) ON DELETE CASCADE,
    centro_costo_id INTEGER NOT NULL REFERENCES centro_costos(centro_costo_id),
    concepto_id INTEGER REFERENCES conceptos(conceptoid),
    tercero_id INTEGER REFERENCES terceros(terceroid),
    mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
    monto_presupuestado NUMERIC(16,2) NOT NULL DEFAULT 0,
    monto_ajustado NUMERIC(16,2),
    tipo VARCHAR(20) NOT NULL DEFAULT 'variable'
        CHECK (tipo IN ('fijo', 'variable', 'estacional')),
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_pdetalle_presupuesto ON presupuesto_detalle(presupuesto_id);
CREATE INDEX IF NOT EXISTS idx_pdetalle_cc ON presupuesto_detalle(centro_costo_id);
CREATE INDEX IF NOT EXISTS idx_pdetalle_mes ON presupuesto_detalle(mes);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pdetalle_linea
    ON presupuesto_detalle(presupuesto_id, centro_costo_id, COALESCE(concepto_id,0), COALESCE(tercero_id,0), mes);
```

### Task 2: Modelo Presupuesto
**Crear:** `Backend/src/domain/models/presupuesto.py`
- Dataclass: id, anio, nombre, estado, notas, created_at
- Validacion: nombre requerido, anio>2020, estado valido
- Metodos: `puede_editar()`, `activar()`, `cerrar()`
- **Patron:** `centro_costo.py` + `conciliacion.py`

### Task 3: Modelo PresupuestoDetalle
**Crear:** `Backend/src/domain/models/presupuesto_detalle.py`
- Dataclass: id, presupuesto_id, centro_costo_id, concepto_id?, tercero_id?, mes, monto_presupuestado(Decimal), monto_ajustado?(Decimal), tipo, notas, created_at
- Join fields: centro_costo_nombre, concepto_nombre, tercero_nombre
- Property: `monto_efectivo` -> ajustado si existe, sino presupuestado
- Validacion: mes 1-12, Decimal coercion, tipo valido
- **Patron:** `movimiento_detalle.py`

### Task 4: Port PresupuestoRepository
**Crear:** `Backend/src/domain/ports/presupuesto_repository.py`
- ABC con: `guardar`, `obtener_por_id`, `obtener_todos(anio?)`, `obtener_activo(anio)`, `eliminar`, `cambiar_estado`

### Task 5: Port PresupuestoDetalleRepository
**Crear:** `Backend/src/domain/ports/presupuesto_detalle_repository.py`
- ABC con: `guardar`, `guardar_lote`, `obtener_por_presupuesto(filtros)`, `obtener_por_id`, `eliminar`, `eliminar_por_presupuesto`
- Resumen: `obtener_resumen_por_centro_costo`, `obtener_resumen_por_concepto`, `obtener_resumen_por_tercero`, `obtener_resumen_mensual`
- Ajustes: `aplicar_ajuste_global(id, %)`, `aplicar_ajuste_centro_costo(id, cc_id, %)`, `aplicar_ajuste_linea(id, monto)`

### Task 6: Port PresupuestoGeneracionRepository
**Crear:** `Backend/src/domain/ports/presupuesto_generacion_repository.py`
- ABC con: `generar_base_desde_anio(anio_fuente, excluidos?) -> List[PresupuestoDetalle]`

### Task 7: Repo PostgresPresupuestoRepository
**Crear:** `Backend/src/infrastructure/database/postgres_presupuesto_repository.py`
- Implementa Task 4 con psycopg2
- `cambiar_estado` valida unicidad de activo por año
- **Patron:** `postgres_centro_costo_repository.py`

### Task 8: Repo PostgresPresupuestoDetalleRepository
**Crear:** `Backend/src/infrastructure/database/postgres_presupuesto_detalle_repository.py`
- Implementa Task 5 con psycopg2
- Helper `_row_to_entity()` para mapeo
- Resumenes: GROUP BY + SUM(COALESCE(monto_ajustado, monto_presupuestado))
- Ajustes: UPDATE SET monto_ajustado = ROUND(monto_presupuestado * (1 + %/100), 2)
- **Patron:** `postgres_movimiento_repository.py` (para agregaciones)

### Task 9: Repo PostgresPresupuestoGeneracionRepository
**Crear:** `Backend/src/infrastructure/database/postgres_presupuesto_generacion_repository.py`
- Query clave para generar base desde movimientos reales:
```sql
SELECT md.centro_costo_id, md.ConceptoID, md.TerceroID,
       EXTRACT(MONTH FROM m.Fecha)::INT as mes,
       SUM(CASE WHEN COALESCE(m.usd,0)!=0 THEN ABS(m.usd) ELSE ABS(md.Valor) END) as monto
FROM movimientos_encabezado m
JOIN movimientos_detalle md ON m.Id = md.movimiento_id
WHERE m.Fecha BETWEEN '2025-01-01' AND '2025-12-31'
  AND md.centro_costo_id IS NOT NULL AND md.Valor < 0
GROUP BY md.centro_costo_id, md.ConceptoID, md.TerceroID, EXTRACT(MONTH FROM m.Fecha)
```

### Task 10: Repo PostgresPresupuestoComparacionRepository
**Crear port:** `Backend/src/domain/ports/presupuesto_comparacion_repository.py`
**Crear impl:** `Backend/src/infrastructure/database/postgres_presupuesto_comparacion_repository.py`
- Query critica Budget vs Actual usando CTEs + FULL OUTER JOIN:
```sql
WITH presupuesto_agg AS (
    SELECT pd.centro_costo_id, cc.centro_costo as nombre,
           SUM(COALESCE(pd.monto_ajustado, pd.monto_presupuestado)) as presupuestado
    FROM presupuesto_detalle pd
    JOIN centro_costos cc ON pd.centro_costo_id = cc.centro_costo_id
    WHERE pd.presupuesto_id = %s AND pd.mes BETWEEN %s AND %s
    GROUP BY pd.centro_costo_id, cc.centro_costo
),
real_agg AS (
    SELECT md.centro_costo_id, cc.centro_costo as nombre,
           SUM(CASE WHEN COALESCE(m.usd,0)!=0 THEN ABS(m.usd) ELSE ABS(md.Valor) END) as ejecutado
    FROM movimientos_encabezado m
    JOIN movimientos_detalle md ON m.Id = md.movimiento_id
    JOIN centro_costos cc ON md.centro_costo_id = cc.centro_costo_id
    WHERE EXTRACT(YEAR FROM m.Fecha) = %s AND EXTRACT(MONTH FROM m.Fecha) BETWEEN %s AND %s
      AND md.Valor < 0 AND md.centro_costo_id IS NOT NULL
    GROUP BY md.centro_costo_id, cc.centro_costo
)
SELECT COALESCE(p.centro_costo_id, r.centro_costo_id) as id,
       COALESCE(p.nombre, r.nombre) as nombre,
       COALESCE(p.presupuestado,0), COALESCE(r.ejecutado,0),
       COALESCE(r.ejecutado,0) - COALESCE(p.presupuestado,0) as variacion,
       CASE WHEN COALESCE(p.presupuestado,0)=0 THEN 0
            ELSE ROUND(((COALESCE(r.ejecutado,0)-p.presupuestado)/p.presupuestado*100)::numeric,1)
       END as variacion_pct
FROM presupuesto_agg p FULL OUTER JOIN real_agg r ON p.centro_costo_id = r.centro_costo_id
```
- Metodos: `comparar_por_centro_costo`, `comparar_por_concepto`, `comparar_por_tercero`, `comparar_resumen_mensual`

### Task 11: Application Service
**Crear:** `Backend/src/application/services/presupuesto_service.py`
- Orquesta los 4 repositorios
- Metodos: `crear_presupuesto`, `generar_desde_anio_anterior`, `aplicar_ajuste_global`, `aplicar_ajuste_por_centro_costo`, `aplicar_ajuste_linea`, `activar_presupuesto`, `cerrar_presupuesto`
- **Patron:** `ClasificacionService` (orquestacion multi-repo)

### Task 12: Router presupuestos
**Crear:** `Backend/src/infrastructure/api/routers/presupuestos.py`
- Prefix: `/api/presupuestos`
- Schemas Pydantic inline (PresupuestoCreateDTO, PresupuestoResponse, DetalleDTO, ComparacionResponse, etc.)
- Endpoints:
  - `GET /` -- listar (filtro anio)
  - `GET /{id}` -- obtener uno
  - `POST /` -- crear
  - `PUT /{id}` -- actualizar maestro
  - `DELETE /{id}` -- eliminar (solo borrador)
  - `POST /{id}/activar` -- cambiar estado
  - `POST /{id}/cerrar` -- cambiar estado
  - `POST /{id}/generar` -- generar lineas desde año fuente
  - `GET /{id}/detalle` -- listar lineas con filtros
  - `POST /{id}/detalle` -- agregar linea
  - `PUT /{id}/detalle/{did}` -- editar linea
  - `DELETE /{id}/detalle/{did}` -- eliminar linea
  - `POST /{id}/ajuste/global` -- ajuste % global
  - `POST /{id}/ajuste/centro-costo` -- ajuste % por CC
  - `PUT /{id}/detalle/{did}/ajustar` -- ajuste monto fijo
  - `GET /{id}/comparacion` -- Budget vs Actual (params: nivel, mes_inicio, mes_fin, cc_id, concepto_id, excluidos)
  - `GET /{id}/comparacion/mensual` -- resumen mensual

### Task 13: Registrar DI en dependencies.py
**Modificar:** `Backend/src/infrastructure/api/dependencies.py`
- Agregar: `get_presupuesto_repository`, `get_presupuesto_detalle_repository`, `get_presupuesto_generacion_repository`, `get_presupuesto_comparacion_repository`, `get_presupuesto_service`

### Task 14: Registrar router en main.py
**Modificar:** `Backend/src/infrastructure/api/main.py`
- Import + `app.include_router(presupuestos.router)`

### Task 15: Endpoint widget dashboard
**Modificar:** `Backend/src/infrastructure/api/routers/dashboard.py`
- `GET /api/dashboard/presupuesto-widget` -> presupuesto_mes_actual, ejecutado_mes_actual, porcentaje_consumido, semaforo, dias_restantes

### Task 16: Ejecutar migracion SQL
- Ejecutar `migration_presupuesto.sql` contra PostgreSQL localhost:5433/Mvtos

---

## FASE 2: Frontend (Tasks 17-27)

### Task 17: Tipos TypeScript
**Modificar:** `frontend/src/types.ts` (o archivo apropiado en types/)
- Interfaces: Presupuesto, PresupuestoDetalle, ComparacionPresupuesto, ResumenMensualPresupuesto, PresupuestoWidget

### Task 18: Servicio API
**Crear:** `frontend/src/services/presupuesto.service.ts`
- Metodos CRUD maestro: listar, obtener, crear, actualizar, eliminar, activar, cerrar
- Generacion: generar(id, {anio_fuente, excluidos})
- Detalle: listarDetalle, crearDetalle, actualizarDetalle, eliminarDetalle
- Ajustes: ajusteGlobal, ajusteCentroCosto, ajusteLinea
- Comparacion: comparar, compararMensual
- Widget: widget()
- **Patron:** `catalogs.service.ts`

**Modificar:** `frontend/src/services/api.ts` -- agregar export

### Task 19: Hook usePresupuesto
**Crear:** `frontend/src/hooks/usePresupuesto.ts`
- TanStack Query hooks: usePresupuestos, usePresupuestoDetalle, usePresupuestoComparacion, usePresupuestoWidget
- Query keys organizados, staleTime 5min
- **Patron:** hooks existentes del proyecto

### Task 20: Componente SemaforoBadge
**Crear:** `frontend/src/components/atoms/SemaforoBadge.tsx`
- Props: variacionPct, showValue?
- Verde (<=5%), Amarillo (5-15%), Rojo (>15%)
- Badge con color + icono + porcentaje opcional

### Task 21: Pagina PresupuestosPage (CRUD maestro)
**Crear:** `frontend/src/pages/PresupuestosPage.tsx`
- DataTable: Año, Nombre, Estado (Badge color), Fecha, Acciones
- Modal crear/editar: anio, nombre, notas
- Acciones fila: Editar, Eliminar (solo borrador), Activar, Cerrar, Ver detalle (navega)
- Filtro por año
- **Patron:** `CentrosCostosPage.tsx`

### Task 22: Pagina PresupuestoDetallePage (lineas editables)
**Crear:** `frontend/src/pages/PresupuestoDetallePage.tsx`
- URL: `/presupuestos/:id/detalle`
- Header: nombre presupuesto, año, estado
- Filtros: centro_costo, concepto, mes
- DataTable: CC, Concepto, Tercero, Mes, Presupuestado, Ajustado, Tipo, Notas
- Edicion inline (solo si estado=borrador)
- Toolbar: "Ajuste Global" modal, "Ajuste por CC" modal
- Fila resumen con totales
- Export Excel
- **Patron:** `ConceptosPage.tsx` + `ReporteEgresosCentroCostoPage.tsx`

### Task 23: Modal PresupuestoGenerarModal
**Crear:** `frontend/src/components/organisms/modals/PresupuestoGenerarModal.tsx`
- Selector año fuente (default: año anterior)
- Checkboxes exclusion CCs (reutiliza configExclusion)
- Boton generar con loading state

### Task 24: Modal PresupuestoAjusteModal
**Crear:** `frontend/src/components/organisms/modals/PresupuestoAjusteModal.tsx`
- Tabs: Global | Por Centro de Costo
- Input porcentaje
- Selector CC (para tab CC)
- Preview antes/despues

### Task 25: Pagina PresupuestoVsRealPage (reporte)
**Crear:** `frontend/src/pages/PresupuestoVsRealPage.tsx`
- Selector presupuesto (activo del año actual por defecto)
- Selector rango meses
- Exclusiones CC
- StatCards: Total Presupuestado, Total Ejecutado, Variacion, % Cumplimiento
- DataTable nivel CC: nombre, presupuestado, ejecutado, variacion, var%, semaforo
- Drill-down: CC -> Concepto -> Tercero -> Movimientos (modales)
- BarChart comparativo
- Export Excel
- **Patron:** `ReporteEgresosCentroCostoPage.tsx` (drill-down + stats + chart)

### Task 26: Widget DashboardBudgetWidget
**Crear:** `frontend/src/components/organisms/dashboard/DashboardBudgetWidget.tsx`
- Barra progreso circular o horizontal con % consumido
- Montos presupuestado vs ejecutado
- SemaforoBadge
- Dias restantes del mes
- Manejo sin presupuesto activo

**Modificar:** `frontend/src/pages/DashboardPage.tsx` -- integrar widget

### Task 27: Navegacion y rutas
**Modificar:** `frontend/src/App.tsx`
- Rutas: `/presupuestos`, `/presupuestos/:id/detalle`, `/reportes/presupuesto-vs-real`

**Modificar:** `frontend/src/components/organisms/Sidebar.tsx`
- Menu: item "Presupuestos" (icono Calculator) + "Presupuesto vs Real" en reportes (icono Target)

---

## Orden de Ejecucion

```
Paralelo 1: Tasks 1,2,3        (migracion + modelos)
Paralelo 2: Tasks 4,5,6        (ports)
Paralelo 3: Tasks 7,8,9,10     (repos)
Secuencial: Task 11             (app service, necesita repos)
Paralelo 4: Tasks 12,13,14     (router + DI + main)
Paralelo 5: Tasks 15,16        (widget endpoint + ejecutar SQL)
--- Backend listo ---
Paralelo 6: Tasks 17,18,19,20  (tipos + servicio + hooks + semaforo)
Paralelo 7: Tasks 21,22,23,24  (paginas CRUD + modales)
Secuencial: Task 25             (reporte, necesita todo lo anterior)
Paralelo 8: Tasks 26,27        (dashboard widget + navegacion)
```

## Verificacion

1. **SQL**: Ejecutar migracion, verificar tablas creadas con `\dt presupuesto*`
2. **Backend**: `docker compose up backend` -> probar endpoints con curl/Swagger:
   - POST /api/presupuestos (crear)
   - POST /api/presupuestos/{id}/generar (generar desde 2025)
   - GET /api/presupuestos/{id}/detalle (ver lineas)
   - POST /api/presupuestos/{id}/ajuste/global (aplicar +8%)
   - GET /api/presupuestos/{id}/comparacion?nivel=centro_costo&mes_inicio=1&mes_fin=12
3. **Frontend**: `docker compose up frontend` -> navegar:
   - /presupuestos -> CRUD maestro
   - /presupuestos/{id}/detalle -> tabla editable
   - /reportes/presupuesto-vs-real -> reporte con drill-down y semaforos
   - Dashboard -> widget de consumo mensual
