# Plan de Reorganización de Directorios y Archivos

## Contexto

El proyecto ha crecido orgánicamente y acumuló archivos fuera de lugar, código legacy duplicado, artefactos accidentales y scripts dispersos en múltiples ubicaciones. Esta reorganización busca reforzar la arquitectura hexagonal, eliminar código muerto y consolidar utilidades dispersas sin romper funcionalidad existente.

---

## Fase 1: Eliminar Artefactos y Archivos Muertos (RIESGO CERO)

Archivos sin ninguna referencia en el código:

| Archivo | Razón |
|---------|-------|
| `=3.1.0` (raíz) | Salida accidental de pip guardada como archivo |
| `Backend/=` | Mismo problema |
| `Backend/debug_mastercard_pesos_text.txt` | Artefacto de debug |
| `frontend/src/counter.ts` | Boilerplate de Vite, sin importar |
| `frontend/src/style.css` | Boilerplate de Vite, sin importar |
| `frontend/src/typescript.svg` | Boilerplate de Vite, sin importar |
| `frontend/debug_api.py` | Script Python de debug dentro del proyecto React, obsoleto |

Agregar a `.gitignore`:
```
# Artefactos accidentales de pip/npm
=*
```

---

## Fase 2: Eliminar Código Legacy del Backend (RIESGO CERO)

Estos archivos están **completamente reemplazados** por sus equivalentes dentro de la arquitectura hexagonal. El `main.py` solo importa desde `src.infrastructure.api.routers` - nunca referencia estos archivos legacy.

| Legacy (ELIMINAR) | Reemplazo Hexagonal (YA EXISTE) |
|---|---|
| `Backend/routes/matching_validation.py` | `Backend/src/infrastructure/api/routers/matching.py` |
| `Backend/services/matching_validation_service.py` | `Backend/src/application/services/matching_validation_service.py` |

Diferencia clave: los legacy usan `get_db_connection()` directo, los hexagonales usan `get_connection_pool()` correctamente.

Eliminar también los directorios vacíos `Backend/routes/` y `Backend/services/`.

---

## Fase 3: Consolidar Types del Frontend (RIESGO BAJO)

### Problema actual
- `frontend/src/types.ts` → Contiene TODAS las definiciones (207 líneas)
- `frontend/src/types/index.ts` → Re-exporta desde `../types` (el archivo de arriba)
- Confusión: archivo y directorio con el mismo nombre base

### Solución
1. Mover el contenido de `frontend/src/types.ts` a `frontend/src/types/index.ts`
2. Eliminar `frontend/src/types.ts`
3. Con el archivo eliminado, `from '../types'` resuelve automáticamente a `types/index.ts`
4. **No se requiere cambiar ningún import** en los 25+ archivos que consumen types

### Verificación
- `npx tsc --noEmit` para validar resolución de tipos
- `npm run build` para confirmar que Vite compila

---

## Fase 4: Mover mantenimientoService al Directorio Correcto (RIESGO BAJO)

| Origen | Destino |
|--------|---------|
| `frontend/src/api/mantenimientoService.ts` | `frontend/src/services/mantenimiento.service.ts` |

- Solo 1 archivo lo importa: `pages/mantenimiento/ReclasificarMovimientosPage.tsx`
- Actualizar ese import de `../../api/mantenimientoService` a `../../services/mantenimiento.service`
- Eliminar directorio vacío `frontend/src/api/`

---

## Fase 5: Consolidar Scripts de PowerShell y Utilidades (RIESGO BAJO)

### Estructura propuesta

```
scripts/
  docker/                  ← Scripts de arranque y gestión Docker
    arranque_app.ps1       (desde raíz)
    arranque_backend.ps1   (desde raíz)
    arranque_frontend.ps1  (desde raíz)
    arranque_app_con_log.ps1   (desde Power Shell Comandos/)
    limpiar_docker.ps1         (desde Power Shell Comandos/)
    manage_services.ps1        (desde Power Shell Comandos/)
    servicios.ps1              (desde Power Shell Comandos/)
  git/
    actualizar_git.ps1     (desde raíz)
  admin/                   ← Scripts de administración DB (desde Scripts/)
    actualizar_conciliaciones.py
    add_permite_conciliar_column.py
    apply_migration_view.py
    ... (todos los .py de Scripts/)
  tools/
    antigravity_docs.py        (desde Power Shell Comandos/)
    archivar_conversacion.ps1  (desde Power Shell Comandos/)
```

Eliminar directorios ahora vacíos: `Power Shell Comandos/`, `Scripts/`

---

## Fase 6: Reorganizar Directorio SQL (RIESGO BAJO)

```
Sql/
  schema/              ← DDL del esquema base
    CreateTable_configuracion_matching.sql
    CreateTable_movimiento_vinculaciones.sql
    CreateTable_movimientos_extracto.sql
    CreateView_movimientos.sql
    CreateView_resumen_matching.sql
  migrations/          ← Migraciones con orden numérico
    001_migration_tipo_cuenta.sql
    002_migration_numero_cuenta.sql
    003_migration_add_usd_trm_columns.sql
    004_migration_extractores.sql
    005_migration_fecha_corte.sql
    006_migration_add_saldo_acumulado.sql
  fixes/
    fix_tipos_cuenta.sql
  debug/
    Queries_matching_debug.sql
  runners/
    run_migration.py
    run_migration_fecha_corte.py
  backup.sql           ← Se queda en raíz de Sql/
```

Actualizar paths relativos en `run_migration.py` y `run_migration_fecha_corte.py`.

---

## Fase 7 (Opcional): Organizar Backend/scripts/

Los 49 scripts de desarrollo/debug en `Backend/scripts/` se pueden organizar en subcarpetas:

```
Backend/scripts/
  debug/       ← debug_*, check_*, diagnosticar_*
  migration/   ← migrate_*, alter_*, force_add_*
  fix/         ← fix_*, clean_*, mass_*, reset_*
  verify/      ← verify_*, test_*
  tools/       ← import_rules_csv.py, get_columns.py, etc.
```

Esto es opcional y se puede diferir.

---

## Archivos Críticos a Modificar

| Archivo | Cambio |
|---------|--------|
| `.gitignore` | Agregar regla `=*` |
| `frontend/src/types/index.ts` | Recibe contenido de `types.ts` |
| `frontend/src/services/mantenimiento.service.ts` | Nuevo archivo (movido desde api/) |
| `frontend/src/pages/mantenimiento/ReclasificarMovimientosPage.tsx` | Actualizar import |
| `Sql/runners/run_migration.py` | Actualizar path del archivo SQL |
| `Sql/runners/run_migration_fecha_corte.py` | Actualizar path del archivo SQL |

---

## Verificación End-to-End

1. **Backend**: Iniciar con `docker-compose up --build backend` → verificar `GET /health`
2. **Frontend**: `npm run build` en frontend/ → sin errores TypeScript
3. **Tipos**: `npx tsc --noEmit` → 0 errores
4. **Funcional**: Navegar Dashboard, cargar extracto, ejecutar matching, crear movimiento manual
5. **Scripts**: Ejecutar `scripts/docker/arranque_app.ps1` desde raíz del proyecto

---

## Estrategia de Commits

Un commit por fase para facilitar rollback:
1. `chore: eliminar artefactos y archivos muertos`
2. `chore: eliminar código legacy fuera de arquitectura hexagonal`
3. `refactor(frontend): consolidar types en directorio types/`
4. `refactor(frontend): mover mantenimientoService a services/`
5. `chore: consolidar scripts en directorio scripts/`
6. `chore: reorganizar directorio SQL con subcarpetas`
7. *(opcional)* `chore: organizar Backend/scripts/ en subcarpetas`