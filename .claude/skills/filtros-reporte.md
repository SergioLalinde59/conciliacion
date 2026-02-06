# Skill: Filtros Reporte

> Componente unificado de filtros para todas las páginas de reportes y listados del sistema.

## Resumen

`FiltrosReporte` es el componente central para filtrar datos en reportes, listados y dashboards. Proporciona filtros de fechas, cuenta, tercero, centro de costo, concepto, y toggles de ingresos/egresos con un diseño sticky y consistente.

---

## Ubicacion

| Archivo | Descripcion |
|---------|-------------|
| [FiltrosReporte.tsx](frontend/src/components/organisms/FiltrosReporte.tsx) | Componente principal |

---

## Props

```typescript
interface FiltrosReporteProps {
    // Fechas (obligatorias)
    desde: string                           // "YYYY-MM-DD"
    hasta: string                           // "YYYY-MM-DD"
    onDesdeChange?: (val: string) => void   // Convencion antigua
    setDesde?: (val: string) => void        // Convencion nueva (preferida)
    onHastaChange?: (val: string) => void
    setHasta?: (val: string) => void

    // Cuenta (obligatoria)
    cuentaId: string
    onCuentaChange?: (val: string) => void
    setCuentaId?: (val: string) => void

    // Clasificacion (opcionales)
    terceroId?: string
    onTerceroChange?: (val: string) => void
    setTerceroId?: (val: string) => void

    centroCostoId?: string
    onCentroCostoChange?: (val: string) => void
    setCentroCostoId?: (val: string) => void

    conceptoId?: string
    onConceptoChange?: (val: string) => void
    setConceptoId?: (val: string) => void

    // Catalogos (opcionales - usa useCatalogo como fallback)
    terceros?: Tercero[]
    centrosCostos?: CentroCosto[]
    conceptos?: Concepto[]

    // Accion limpiar (obligatoria)
    onLimpiar: () => void

    // Configuracion visual
    showClasificacionFilters?: boolean      // default: true
    showIngresosEgresos?: boolean           // default: true
    soloConciliables?: boolean              // default: true
    extraActions?: React.ReactNode          // Botones adicionales

    // Toggles ingresos/egresos
    mostrarIngresos?: boolean               // default: true
    onMostrarIngresosChange?: (val: boolean) => void
    setMostrarIngresos?: (val: boolean) => void
    mostrarEgresos?: boolean                // default: true
    onMostrarEgresosChange?: (val: boolean) => void
    setMostrarEgresos?: (val: boolean) => void

    // Exclusiones de centros de costo
    configuracionExclusion?: ConfigFiltroExclusion[]
    centrosCostosExcluidos?: number[]
    onCentrosCostosExcluidosChange?: (val: number[]) => void
    setCentrosCostosExcluidos?: (val: number[]) => void
}
```

---

## Uso Basico

```tsx
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'

const MiPagina = () => {
    const [desde, setDesde] = useState('2025-01-01')
    const [hasta, setHasta] = useState('2025-12-31')
    const [cuentaId, setCuentaId] = useState('')

    const handleLimpiar = () => {
        setDesde('2025-01-01')
        setHasta('2025-12-31')
        setCuentaId('')
    }

    return (
        <FiltrosReporte
            desde={desde}
            hasta={hasta}
            setDesde={setDesde}
            setHasta={setHasta}
            cuentaId={cuentaId}
            setCuentaId={setCuentaId}
            onLimpiar={handleLimpiar}
        />
    )
}
```

---

## Uso Completo (Dashboard)

```tsx
<FiltrosReporte
    // Fechas
    desde={desde}
    hasta={hasta}
    setDesde={setDesde}
    setHasta={setHasta}

    // Selectores
    cuentaId={cuentaId}
    setCuentaId={setCuentaId}
    terceroId={terceroId}
    setTerceroId={setTerceroId}
    centroCostoId={centroCostoId}
    setCentroCostoId={setCentroCostoId}
    conceptoId={conceptoId}
    setConceptoId={setConceptoId}

    // Toggles
    mostrarIngresos={mostrarIngresos}
    setMostrarIngresos={setMostrarIngresos}
    mostrarEgresos={mostrarEgresos}
    setMostrarEgresos={setMostrarEgresos}

    // Exclusiones
    configuracionExclusion={configFiltrosExclusion}
    centrosCostosExcluidos={centrosCostosExcluidos}
    setCentrosCostosExcluidos={setCentrosCostosExcluidos}

    // Config
    onLimpiar={handleResetFilters}
    soloConciliables={false}
/>
```

---

## Estructura Visual

```
┌─────────────────────────────────────────────────────────────────────┐
│ Fila 1: Botones de Rango Rapido                                     │
│   [Hoy] [Semana] [Mes] [Trimestre] [Año] [YTD]                     │
├─────────────────────────────────────────────────────────────────────┤
│ Fila 2: Fechas + Cuenta                                             │
│   [Desde: ____] [Hasta: ____]            [Cuenta: ▼ Todas]          │
├─────────────────────────────────────────────────────────────────────┤
│ Fila 3: Filtros de Clasificacion                                    │
│   [Tercero: ▼] [Centro Costo: ▼] [Concepto: ▼]     [↺ Reiniciar]   │
├─────────────────────────────────────────────────────────────────────┤
│ Fila 4: Filtros Avanzados                                           │
│   🔧 [✓ Ingresos] [✓ Egresos] [Excluir: ...]                        │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Subcomponentes Usados

| Componente | Ubicacion | Funcion |
|------------|-----------|---------|
| `DateRangeButtons` | molecules/DateRangeSelector | Botones de rango rapido |
| `DateRangeInputs` | molecules/DateRangeSelector | Inputs de fecha desde/hasta |
| `SelectorCuenta` | molecules/SelectorCuenta | Dropdown de cuentas |
| `ClassificationFilters` | molecules/ClassificationFilters | Tercero, Centro, Concepto |
| `FilterToggles` | molecules/FilterToggles | Checkboxes ingresos/egresos |

---

## Paginas que Usan FiltrosReporte

| Pagina | Props Especiales |
|--------|------------------|
| [DashboardPage](frontend/src/pages/DashboardPage.tsx) | `soloConciliables={false}` |
| [ConciliacionPage](frontend/src/pages/ConciliacionPage.tsx) | Default |
| [MovimientosPage](frontend/src/pages/MovimientosPage.tsx) | Default |
| [DescargarMovimientosPage](frontend/src/pages/DescargarMovimientosPage.tsx) | Default |
| [ReporteClasificacionesPage](frontend/src/pages/ReporteClasificacionesPage.tsx) | Default |
| [ReporteEgresosCentroCostoPage](frontend/src/pages/ReporteEgresosCentroCostoPage.tsx) | Default |
| [ReporteEgresosTerceroPage](frontend/src/pages/ReporteEgresosTerceroPage.tsx) | Default |
| [ReporteIngresosGastosMesPage](frontend/src/pages/ReporteIngresosGastosMesPage.tsx) | Default |
| [ReclasificarMovimientosPage](frontend/src/pages/mantenimiento/ReclasificarMovimientosPage.tsx) | Default |

---

## Convencion de Props

El componente soporta dos convenciones de naming para callbacks:

```typescript
// Convencion antigua (onXChange)
onDesdeChange={setDesde}
onCuentaChange={setCuentaId}

// Convencion nueva (setX) - PREFERIDA
setDesde={setDesde}
setCuentaId={setCuentaId}
```

Internamente, el componente prioriza la nueva convencion:
```typescript
const _onDesde = setDesde || onDesdeChange || (() => {})
```

**Recomendacion:** Usar siempre la convencion `setX` en codigo nuevo.

---

## Catalogos Automaticos

Si no se pasan `terceros`, `centrosCostos` o `conceptos` como props, el componente los obtiene automaticamente via `useCatalogo()`:

```typescript
const { terceros: catTerceros, centrosCostos: catCentros, conceptos: catConceptos } = useCatalogo()
const finalTerceros = terceros.length > 0 ? terceros : catTerceros
```

Esto simplifica el uso en la mayoria de casos.

---

## Estilos

El componente usa clases de Tailwind para un diseno sticky moderno:

```css
bg-white/90              /* Fondo semi-transparente */
backdrop-blur-xl         /* Efecto blur */
border-b border-slate-200
sticky top-0 z-30        /* Sticky al scroll */
px-6 py-3
shadow-sm
```

---

## Modificaciones Comunes

### Ocultar Filtros de Clasificacion

```tsx
<FiltrosReporte
    showClasificacionFilters={false}
    // ... otros props
/>
```

### Ocultar Toggles Ingresos/Egresos

```tsx
<FiltrosReporte
    showIngresosEgresos={false}
    // ... otros props
/>
```

### Agregar Botones Extras

```tsx
<FiltrosReporte
    extraActions={
        <Button onClick={handleExport}>
            Exportar
        </Button>
    }
    // ... otros props
/>
```

### Filtrar Solo Cuentas Conciliables

```tsx
<FiltrosReporte
    soloConciliables={true}  // default
    // ... otros props
/>
```

---

## Notas Importantes

1. **Sticky Header:** El componente es sticky por defecto (`sticky top-0`). Si tu layout tiene otro header, ajusta el `z-index`.

2. **useCatalogo:** El hook carga terceros, centros de costo y conceptos automaticamente con cache de React Query.

3. **Exclusiones:** El sistema de exclusion de centros de costo se configura en la tabla `config_filtro_exclusion` de la BD.

4. **Responsive:** El componente usa flex-wrap para adaptarse a pantallas pequenas.