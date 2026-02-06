# Skill: Selector Cuenta

> Componente dropdown unificado para seleccion de cuentas bancarias en todo el sistema.

## Resumen

`SelectorCuenta` es el componente estandar para seleccionar cuentas bancarias. Usa el catalogo centralizado (`useCatalogo`), soporta filtros por tipo de cuenta, y mantiene consistencia visual en toda la aplicacion.

---

## Ubicacion

| Archivo | Descripcion |
|---------|-------------|
| [SelectorCuenta.tsx](frontend/src/components/molecules/SelectorCuenta.tsx) | Componente principal |
| [EntitySelector.tsx](frontend/src/components/molecules/entities/EntitySelector.tsx) | Componente base generico |

---

## Props

```typescript
interface SelectorCuentaProps {
    value: string | number              // ID de cuenta seleccionada
    onChange: (value: string) => void   // Callback al cambiar seleccion

    // Filtros
    soloConciliables?: boolean          // default: true - Solo permite_conciliar=true
    soloPermiteCarga?: boolean          // default: false - Solo permite_carga=true

    // UI
    label?: string                      // default: "Cuenta"
    showTodas?: boolean                 // default: false - Muestra opcion "Todas"
    className?: string                  // Clases CSS adicionales
    error?: string                      // Mensaje de error
    disabled?: boolean                  // default: false
}
```

---

## Uso Basico

```tsx
import { SelectorCuenta } from '../components/molecules/SelectorCuenta'

const MiComponente = () => {
    const [cuentaId, setCuentaId] = useState('')

    return (
        <SelectorCuenta
            value={cuentaId}
            onChange={setCuentaId}
        />
    )
}
```

---

## Casos de Uso Comunes

### 1. Filtro en Reportes (Todas las Cuentas)

```tsx
<SelectorCuenta
    value={cuentaId}
    onChange={setCuentaId}
    showTodas={true}              // Opcion "Todas las cuentas"
    soloConciliables={true}       // Solo cuentas conciliables
/>
```

### 2. Carga de Movimientos

```tsx
<SelectorCuenta
    value={cuentaId}
    onChange={(value) => {
        setCuentaId(Number(value))
        // Logica adicional al cambiar cuenta
    }}
    label="Cuenta Asociada"
    soloPermiteCarga={true}       // Solo cuentas con permite_carga=true
    soloConciliables={false}      // Incluir todas
/>
```

### 3. Formulario de Movimiento

```tsx
<SelectorCuenta
    value={movimiento.cuenta_id}
    onChange={(value) => setMovimiento({...mov, cuenta_id: Number(value)})}
    label="Cuenta Bancaria"
    error={errors.cuenta_id}
    disabled={isLoading}
/>
```

### 4. Reset de Conciliacion

```tsx
<SelectorCuenta
    value={selectedCuenta}
    onChange={(value) => setSelectedCuenta(Number(value))}
    label="Cuenta"
    soloPermiteCarga={true}
    soloConciliables={false}
/>
```

---

## Filtros de Cuenta

### soloConciliables (default: true)

Filtra cuentas donde `permite_conciliar = true`. Usado en reportes y conciliacion.

```tsx
// Solo cuentas conciliables (default)
<SelectorCuenta soloConciliables={true} />

// Todas las cuentas
<SelectorCuenta soloConciliables={false} />
```

### soloPermiteCarga (default: false)

Filtra cuentas donde `permite_carga = true`. Usado en carga de movimientos y extractos.

```tsx
// Solo cuentas que permiten carga
<SelectorCuenta soloPermiteCarga={true} soloConciliables={false} />
```

### Combinaciones Comunes

| Caso de Uso | soloConciliables | soloPermiteCarga |
|-------------|------------------|------------------|
| Reportes/Filtros | `true` | `false` |
| Carga Movimientos | `false` | `true` |
| Carga Extractos | `false` | `true` |
| Reset Conciliacion | `false` | `true` |
| Dashboard | `false` | `false` |

---

## Implementacion Interna

```tsx
export const SelectorCuenta: React.FC<SelectorCuentaProps> = ({
    value,
    onChange,
    soloConciliables = true,
    soloPermiteCarga = false,
    label = "Cuenta",
    showTodas = false,
    className = '',
    error,
    disabled = false
}) => {
    // 1. Obtiene cuentas del catalogo centralizado
    const { cuentas } = useCatalogo()

    // 2. Aplica filtros
    const filteredCuentas = useMemo(() => {
        let result = cuentas
        if (soloConciliables) {
            result = result.filter(c => c.permite_conciliar)
        }
        if (soloPermiteCarga) {
            result = result.filter(c => c.permite_carga)
        }
        return result
    }, [cuentas, soloConciliables, soloPermiteCarga])

    // 3. Mapea propiedades para EntitySelector
    const mappedCuentas = useMemo(() => {
        return filteredCuentas.map(c => ({
            ...c,
            id: c.cuentaid || c.id,
            nombre: c.cuenta || c.nombre
        }))
    }, [filteredCuentas])

    // 4. Renderiza usando EntitySelector
    return (
        <EntitySelector
            label={label}
            icon={CreditCard}
            value={value}
            onChange={onChange}
            options={mappedCuentas}
            className={className}
            error={error}
            disabled={disabled}
            showAllOption={showTodas}
            allOptionLabel="Todas las cuentas"
        />
    )
}
```

---

## Paginas que Usan SelectorCuenta

### Uso Directo

| Pagina | Props Especiales |
|--------|------------------|
| [ConciliacionMatchingPage](frontend/src/pages/ConciliacionMatchingPage.tsx) | Default |
| [CuentaExtractoresPage](frontend/src/pages/CuentaExtractoresPage.tsx) | `soloPermiteCarga` en modal |
| [MovimientoFormPage](frontend/src/pages/MovimientoFormPage.tsx) | Default |
| [ReglasNormalizacionPage](frontend/src/pages/ReglasNormalizacionPage.tsx) | Default |
| [ReglasPage](frontend/src/pages/ReglasPage.tsx) | Default |
| [UploadExtractoPage](frontend/src/pages/UploadExtractoPage.tsx) | `soloPermiteCarga` |
| [UploadMovimientosPage](frontend/src/pages/UploadMovimientosPage.tsx) | `soloPermiteCarga`, `soloConciliables={false}` |
| [ReconciliationResetPage](frontend/src/pages/ReconciliationResetPage.tsx) | `soloPermiteCarga`, `soloConciliables={false}` |

### Via FiltrosReporte

| Pagina | Configuracion |
|--------|---------------|
| [DashboardPage](frontend/src/pages/DashboardPage.tsx) | `soloConciliables={false}` |
| [ConciliacionPage](frontend/src/pages/ConciliacionPage.tsx) | Default |
| [MovimientosPage](frontend/src/pages/MovimientosPage.tsx) | Default |
| [ReporteClasificacionesPage](frontend/src/pages/ReporteClasificacionesPage.tsx) | Default |
| [ReporteEgresosCentroCostoPage](frontend/src/pages/ReporteEgresosCentroCostoPage.tsx) | Default |
| [ReporteEgresosTerceroPage](frontend/src/pages/ReporteEgresosTerceroPage.tsx) | Default |
| [ReporteIngresosGastosMesPage](frontend/src/pages/ReporteIngresosGastosMesPage.tsx) | Default |

### En Modales

| Modal | Ubicacion |
|-------|-----------|
| [MovimientoModal](frontend/src/components/organisms/modals/MovimientoModal.tsx) | Edicion de movimiento |

---

## Modelo de Cuenta (Backend)

```python
@dataclass
class Cuenta:
    id: int
    nombre: str
    descripcion: str
    permite_conciliar: bool    # Aparece en reportes
    permite_carga: bool        # Aparece en carga de archivos
    activa: bool
    tipo_cuenta_id: int        # FK a tipo_cuenta
    # ... otros campos
```

---

## useCatalogo Hook

El componente depende del hook `useCatalogo` que centraliza la carga de catalogos:

```typescript
// hooks/useCatalogo.ts
export const useCatalogo = () => {
    const { data: cuentas = [] } = useQuery({
        queryKey: ['cuentas'],
        queryFn: () => apiService.cuentas.listar(),
        staleTime: 5 * 60 * 1000  // 5 minutos de cache
    })

    return { cuentas, terceros, centrosCostos, conceptos }
}
```

**Beneficios:**
- Cache automatico con React Query
- Una sola peticion compartida entre componentes
- Actualizacion automatica al invalidar query

---

## EntitySelector Base

`SelectorCuenta` usa internamente `EntitySelector`, un componente generico para dropdowns de entidades:

```typescript
interface EntitySelectorProps {
    label: string
    icon: LucideIcon
    value: string | number
    onChange: (value: string) => void
    options: Array<{ id: number, nombre: string }>
    showAllOption?: boolean
    allOptionLabel?: string
    className?: string
    error?: string
    disabled?: boolean
}
```

Otros selectores similares que usan `EntitySelector`:
- `SelectorTercero`
- `SelectorCentroCosto`
- `SelectorConcepto`

---

## Estilos

El componente hereda estilos de `EntitySelector`:

```css
/* Contenedor */
relative w-full

/* Select */
w-full px-4 py-2.5 pr-10
border border-slate-200 rounded-xl
bg-white text-slate-700
focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400

/* Icono */
absolute left-3 top-1/2 -translate-y-1/2
text-slate-400

/* Label */
text-[9px] font-black text-slate-400
uppercase tracking-[0.2em]
```

---

## Migracion desde Select Nativo

Si encuentras un `<select>` nativo para cuentas, migra a `SelectorCuenta`:

### Antes

```tsx
const [cuentas, setCuentas] = useState([])

useEffect(() => {
    apiService.cuentas.listar().then(setCuentas)
}, [])

<select value={cuentaId} onChange={e => setCuentaId(e.target.value)}>
    <option value="">Seleccione...</option>
    {cuentas.filter(c => c.permite_carga).map(c => (
        <option key={c.id} value={c.id}>{c.nombre}</option>
    ))}
</select>
```

### Despues

```tsx
<SelectorCuenta
    value={cuentaId}
    onChange={setCuentaId}
    soloPermiteCarga={true}
    soloConciliables={false}
/>
```

**Beneficios:**
- Elimina estado local de cuentas
- Elimina useEffect de carga
- Usa cache compartido
- Estilo consistente

---

## Notas Importantes

1. **Siempre usar SelectorCuenta:** No usar `<select>` nativos para cuentas.

2. **Filtros por defecto:** `soloConciliables=true` es el default. Si necesitas todas las cuentas, especifica `soloConciliables={false}`.

3. **Conversion de tipo:** El `onChange` recibe `string`. Si necesitas `number`, convierte: `onChange={v => setId(Number(v))}`

4. **Opcion "Todas":** Para filtros de reportes, usa `showTodas={true}` para permitir ver datos de todas las cuentas.

5. **Error handling:** Usa la prop `error` para mostrar errores de validacion en formularios.