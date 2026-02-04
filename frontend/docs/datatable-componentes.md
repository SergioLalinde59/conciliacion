# 📊 Guía de Referencia: DataTable y Diseño Atómico

> **Documento de Referencia Oficial** para la implementación de tablas de datos siguiendo el patrón de **Diseño Atómico** (Atomic Design Pattern).
>
> **Última actualización:** 2026-02-03  
> **Ejemplo de referencia:** `MovimientosTable.tsx`

---

## 📚 Tabla de Contenidos

1. [Introducción al Diseño Atómico](#introducción-al-diseño-atómico)
2. [Arquitectura de Componentes](#arquitectura-de-componentes)
3. [Nivel 1: Átomos](#nivel-1-átomos)
4. [Nivel 2: Moléculas](#nivel-2-moléculas)
5. [Nivel 3: Organismos](#nivel-3-organismos)
6. [Guía de Implementación Paso a Paso](#guía-de-implementación-paso-a-paso)
7. [Ejemplos Completos](#ejemplos-completos)
8. [Mejores Prácticas](#mejores-prácticas)
9. [Troubleshooting](#troubleshooting)

---

## 🧬 Introducción al Diseño Atómico

El **Diseño Atómico** (Atomic Design) es una metodología creada por Brad Frost que organiza los componentes de UI en una jerarquía de 5 niveles, de lo más simple a lo más complejo:

```
Átomos → Moléculas → Organismos → Plantillas → Páginas
```

### ¿Por qué usamos Diseño Atómico?

✅ **Reutilización máxima** - Los componentes se usan en múltiples contextos  
✅ **Mantenibilidad** - Cambios centralizados afectan todo el sistema  
✅ **Escalabilidad** - Fácil agregar nuevas funcionalidades  
✅ **Consistencia** - Diseño uniforme en toda la aplicación  
✅ **Testabilidad** - Componentes pequeños y aislados

---

## 🏗️ Arquitectura de Componentes

### Jerarquía para DataTables

```
📁 components/
├── 🔬 atoms/                    (Nivel 1: Componentes indivisibles)
│   ├── Button.tsx              
│   ├── TableHeaderCell.tsx     
│   ├── DataTableSortIcon.tsx   
│   └── columnHelpers.tsx       (Helpers para definir columnas)
│
├── 🧪 molecules/                (Nivel 2: Combinaciones de átomos)
│   ├── DataTable.tsx           (Motor genérico de tablas)
│   └── entities/
│       ├── EntityDisplay.tsx   (ID + Nombre)
│       └── ClassificationDisplay.tsx (Clasificaciones complejas)
│
└── 🦠 organisms/                (Nivel 3: Componentes de negocio)
    ├── MovimientosTable.tsx    (Tabla de movimientos)
    └── tables/
        ├── CuentasTable.tsx
        ├── TercerosTable.tsx
        └── ...
```

---

## 🔬 Nivel 1: Átomos

Los átomos son los componentes más básicos e indivisibles. No contienen lógica de negocio.

### 1.1 Button Component

**Ubicación:** `components/atoms/Button.tsx`

```tsx
import { Button } from '../atoms/Button'

// Ejemplo de uso
<Button 
    variant="ghost" 
    size="sm" 
    onClick={() => handleAction()}
    className="!p-1.5"
>
    <Eye size={15} />
</Button>
```

**Variantes disponibles:**
- `primary` - Botón principal azul
- `secondary` - Botón secundario con borde
- `outline` - Botón con solo borde
- `ghost` - Botón transparente
- `danger` - Botón rojo de eliminación
- `ghost-danger` - Botón transparente rojo
- `warning` - Botón amarillo/ámbar
- `ghost-warning` - Botón transparente ámbar

**Tamaños:**
- `sm` - Pequeño (px-2 py-1 text-xs)
- `md` - Mediano (px-4 py-2 text-sm)
- `lg` - Grande (px-6 py-3 text-base)

---

### 1.2 TableHeaderCell Component

**Ubicación:** `components/atoms/TableHeaderCell.tsx`

Componente atómico que **automáticamente formatea** los encabezados de tabla en capitalización.

```tsx
import { TableHeaderCell } from '../atoms/TableHeaderCell'

// Uso en definición de columnas
{
    key: 'cuenta',
    header: <TableHeaderCell>Cuenta</TableHeaderCell>,
    // ...
}
```

**Características:**
- ✅ Convierte automáticamente a formato Capitalize
- ✅ Estilos consistentes (text-[10px], font-bold, text-gray-400)
- ✅ Tracking espaciado para legibilidad

---

### 1.3 DataTableSortIcon Component

**Ubicación:** `components/atoms/DataTableSortIcon.tsx`

Ícono visual para indicar estado de ordenamiento en columnas.

```tsx
import { DataTableSortIcon } from '../atoms/DataTableSortIcon'

// Uso interno en DataTable (no usarlo directamente)
<DataTableSortIcon
    active={currentSortKey === column.key}
    direction={currentSortKey === column.key ? currentSortDirection : null}
/>
```

**Estados:**
- `inactive` - Flechas grises (↕️)
- `asc` - Flecha azul arriba (↑)
- `desc` - Flecha azul abajo (↓)

---

### 1.4 Column Helpers

**Ubicación:** `components/atoms/columnHelpers.tsx`

Funciones helper para crear columnas tipadas con estilos consistentes.

#### 📊 cifraColumn - Columnas de cifras genéricas

```tsx
import { cifraColumn } from '../atoms/columnHelpers'

cifraColumn<Movimiento>(
    'trm',                                    // key
    <TableHeaderCell>TRM</TableHeaderCell>,   // header
    row => row.trm ?? 0,                      // getValue
    { width: 'w-16' }                         // options
)
```

**Características:**
- ✅ Formato numérico localized (español)
- ✅ Align: right
- ✅ Color condicional (verde positivo, rojo negativo)
- ✅ Font monoespaciado para alineación

---

#### 💰 monedaColumn - Columnas de moneda

```tsx
import { monedaColumn } from '../atoms/columnHelpers'

monedaColumn<Movimiento>(
    'valor',
    <TableHeaderCell>Pesos</TableHeaderCell>,
    row => row.valor_filtrado ?? row.valor,
    'COP',                                    // Currency code
    { width: 'w-24' }
)
```

**Monedas soportadas:** `COP`, `USD`, `EUR`, etc.

**Formato:**
- COP: `$1,234,567`
- USD: `$1,234.56`

---

#### 📝 textoColumn - Columnas de texto

```tsx
import { textoColumn } from '../atoms/columnHelpers'

textoColumn<Movimiento>(
    'moneda',
    <TableHeaderCell>Moneda</TableHeaderCell>,
    row => row.moneda_display,
    { 
        sortKey: 'moneda_nombre',
        width: 'w-20'
    }
)
```

---

#### 🔢 idColumn - Columnas de ID

```tsx
import { idColumn } from '../atoms/columnHelpers'

idColumn<Movimiento>(
    'id',
    <TableHeaderCell>ID</TableHeaderCell>,
    row => `#${row.id}`,
    { width: 'w-10' }
)
```

**Estilos:** Font mono, texto gris, compacto

---

#### 📅 fechaColumn - Columnas de fechas

```tsx
import { fechaColumn } from '../atoms/columnHelpers'

fechaColumn<Movimiento>(
    'fecha',
    <TableHeaderCell>Fecha</TableHeaderCell>,
    row => row.fecha,
    { width: 'w-18' }
)
```

**Formato:** `DD/MM/YYYY` (localización española)

---

#### Otros helpers disponibles:

- `porcentajeColumn` - Para porcentajes (formato %)
- `booleanColumn` - Para booleanos (Sí/No)
- `enumColumn` - Para catálogos/selects

**Estilos centralizados:**

```typescript
const FONT_CIFRA = 'font-mono text-sm font-bold'
const FONT_MONEDA = 'font-mono text-sm font-bold'
const FONT_ID = 'font-mono text-[11px] text-gray-400'
const FONT_TEXTO = 'text-[13px] text-gray-600'
const FONT_FECHA = 'text-[13px] text-gray-500'
```

---

## 🧪 Nivel 2: Moléculas

Las moléculas combinan átomos para formar componentes más complejos pero aún reutilizables.

### 2.1 DataTable Component

**Ubicación:** `components/molecules/DataTable.tsx`

El motor genérico de tablas. 352 líneas de funcionalidad completa.

#### Props Principales

```typescript
interface DataTableProps<T> {
    // ==================== DATOS ====================
    data: T[]                           // Array de objetos
    columns: Column<T>[]                // Definición de columnas
    getRowKey: (row: T, index: number) => string | number
    
    // ==================== ESTADOS ====================
    loading?: boolean
    loadingMessage?: string
    emptyMessage?: string
    
    // ==================== ACCIONES ====================
    onEdit?: (row: T) => void
    onDelete?: (row: T) => void
    deleteConfirmMessage?: string | ((row: T) => string)
    showActions?: boolean              // Mostrar columna de acciones
    
    // ==================== SORTING ====================
    sortKey?: string | null            // Controlado: clave actual
    sortDirection?: 'asc' | 'desc' | null
    onSort?: (key: string, direction: SortDirection) => void
    
    // ==================== DISEÑO ====================
    className?: string
    rounded?: boolean                  // Border radius
    stickyHeader?: boolean            // Header fijo
    rowPy?: string                    // Padding vertical filas (default: 'py-3')
    maxHeight?: string | number       // Altura máxima
    responsive?: boolean              // Auto-responsive
    
    // ==================== SCROLL INFINITO ====================
    containerRef?: React.RefObject<HTMLDivElement>
    onScroll?: React.UIEventHandler<HTMLDivElement>
    
    // ==================== HEADERS AGRUPADOS ====================
    headerGroups?: HeaderGroup[]
}
```

#### Definición de Columna (Column<T>)

```typescript
interface Column<T> {
    key?: string                       // Identificador único
    header: React.ReactNode           // Título visual
    accessor?: (row: T, index?: number) => React.ReactNode
    render?: (row: T, index?: number) => React.ReactNode
    
    // Sorting
    sortKey?: keyof T                 // Campo por el cual ordenar
    sortValue?: (row: T) => number | string
    sortable?: boolean
    defaultSort?: boolean             // Columna de ordenamiento inicial
    
    // Estilos
    width?: string                    // Clase Tailwind (ej: 'w-20')
    align?: 'left' | 'center' | 'right'
    className?: string                // Clases para la columna
    cellClassName?: string            // Clases específicas de celda
    headerClassName?: string          // Clases específicas de header
    
    // Metadata
    type?: 'number' | 'string' | 'date' | 'custom'
    tooltip?: string
}
```

#### Modos de Ordenamiento

**1. Modo Automático (por defecto)**

El DataTable ordena los datos internamente:

```tsx
<DataTable
    data={movimientos}
    columns={columns}
    getRowKey={(row) => row.id}
/>
```

**2. Modo Controlado**

El padre controla el ordenamiento (ideal para APIs o grandes volúmenes):

```tsx
const [sortKey, setSortKey] = useState<string | null>('fecha')
const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

<DataTable
    data={movimientos}
    columns={columns}
    getRowKey={(row) => row.id}
    sortKey={sortKey}
    sortDirection={sortDirection}
    onSort={(key, direction) => {
        setSortKey(key)
        setSortDirection(direction)
        // Llamar API para reordenar
    }}
/>
```

---

### 2.2 EntityDisplay Component

**Ubicación:** `components/molecules/entities/EntityDisplay.tsx`

Muestra una entidad con su ID y nombre de forma consistente.

```tsx
import { EntityDisplay } from '../molecules/entities/EntityDisplay'

<EntityDisplay
    id={row.cuenta_id}
    nombre={row.cuenta_nombre}
    nameClassName="text-[12px] text-gray-500"
    className="max-w-[200px]"
/>
```

**Renderizado:**
```
┌────┬──────────────┐
│ 42 │ Bancolombia  │
└────┴──────────────┘
```

**Props:**
- `id` - ID de la entidad (number | string)
- `nombre` - Nombre a mostrar
- `className` - Clases del contenedor
- `idClassName` - Clases del badge de ID
- `nameClassName` - Clases del nombre

**Manejo de casos edge:**
- Si `id` es 0, null o '0' → Muestra "Sin asignar" en itálica
- Trunca nombres largos con tooltip

---

### 2.3 ClassificationDisplay Component

**Ubicación:** `components/molecules/entities/ClassificationDisplay.tsx`

Componente especializado para mostrar clasificaciones (Centro de Costo + Concepto).

```tsx
import { ClassificationDisplay } from '../molecules/entities/ClassificationDisplay'

<ClassificationDisplay
    centroCosto={row.centro_costo_id ? {
        id: row.centro_costo_id,
        nombre: row.centro_costo_nombre || ''
    } : null}
    concepto={row.concepto_id ? {
        id: row.concepto_id,
        nombre: row.concepto_nombre || ''
    } : null}
    detallesCount={row.detalles?.length}
/>
```

**3 modos de renderizado:**

1. **Sin clasificar:**
   ```
   ┌─────────────────┐
   │ Sin clasificar  │ (badge amarillo)
   └─────────────────┘
   ```

2. **Clasificación simple:**
   ```
   ┌────┬────────────────┐
   │ 10 │ Operaciones    │ (Centro de Costo)
   │  ↳ 5 │ Telefonía   │ (Concepto indentado)
   └────┴────────────────┘
   ```

3. **Multi-clasificación:**
   ```
   ┌───────────────────┐
   │ MULTI 3 ítems     │ (badge morado)
   │ Ver detalle...    │
   └───────────────────┘
   ```

---

## 🦠 Nivel 3: Organismos

Los organismos combinan moléculas y átomos para crear componentes completos de lógica de negocio.

### 3.1 Estructura de un Organismo Tabla

```tsx
import { useState, useMemo, useEffect, useRef } from 'react'
import { LayoutList, Eye } from 'lucide-react'
import { EntityDisplay } from '../molecules/entities/EntityDisplay'
import { ClassificationDisplay } from '../molecules/entities/ClassificationDisplay'
import { Button } from '../atoms/Button'
import { DataTable } from '../molecules/DataTable'
import type { Column } from '../molecules/DataTable'
import { 
    textoColumn, 
    fechaColumn, 
    monedaColumn, 
    cifraColumn, 
    idColumn 
} from '../atoms/columnHelpers'
import { TableHeaderCell } from '../atoms/TableHeaderCell'

interface MiTablaProps {
    data: MiTipo[]
    loading?: boolean
    onView?: (item: MiTipo) => void
    onEdit?: (item: MiTipo) => void
    onDelete?: (item: MiTipo) => void
}

export const MiTabla = ({ 
    data, 
    loading, 
    onView, 
    onEdit, 
    onDelete 
}: MiTablaProps) => {
    // ============ ESTADO ============
    const [visibleLimit, setVisibleLimit] = useState(15)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // ============ EFECTOS ============
    useEffect(() => {
        setVisibleLimit(15)
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0
        }
    }, [data])

    // ============ HANDLERS ============
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
        if (scrollHeight - scrollTop - clientHeight < 100) {
            if (visibleLimit < data.length) {
                setVisibleLimit(prev => Math.min(prev + 15, data.length))
            }
        }
    }

    // ============ COLUMNAS ============
    const columns: Column<MiTipo>[] = useMemo(() => [
        {
            key: 'actions',
            header: <TableHeaderCell>Acción</TableHeaderCell>,
            align: 'center',
            width: 'w-16',
            accessor: (row) => (
                <div className="flex items-center justify-center gap-1">
                    {onView && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onView(row)}
                            className="!p-1.5 text-blue-600"
                            title="Ver Detalles"
                        >
                            <Eye size={15} />
                        </Button>
                    )}
                </div>
            )
        },
        idColumn<MiTipo>('id', <TableHeaderCell>ID</TableHeaderCell>, row => `#${row.id}`, {
            width: 'w-10',
        }),
        fechaColumn<MiTipo>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, row => row.fecha),
        // ... más columnas
    ], [onView, onEdit, onDelete])

    // ============ RENDER ============
    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
            {/* Header */}
            <div className="p-3 border-b border-gray-100 bg-gray-50/80 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <LayoutList className="text-gray-400" size={20} />
                    <div>
                        <h3 className="text-lg font-bold text-gray-900">Título de la Tabla</h3>
                        <p className="text-xs text-gray-500">Descripción breve</p>
                    </div>
                </div>
            </div>

            {/* DataTable */}
            <DataTable
                containerRef={scrollContainerRef}
                onScroll={handleScroll}
                data={data}
                columns={columns}
                getRowKey={(row) => row.id}
                loading={loading}
                showActions={false}
                rounded={false}
                className="border-none"
                emptyMessage="No se encontraron registros."
                rowPy="py-1"
                stickyHeader={true}
                maxHeight={700}
            />

            {/* Footer */}
            <div className="p-3 bg-gray-50/50 border-t border-gray-100 text-[10px] text-gray-400 text-center">
                Mostrando {Math.min(visibleLimit, data.length)} de {data.length}
            </div>
        </div>
    )
}
```

---

## 📝 Guía de Implementación Paso a Paso

### Paso 1: Definir el Tipo de Datos

```tsx
// types.ts
export interface MiEntidad {
    id: number
    nombre: string
    fecha: string
    valor: number
    activo: boolean
    // ... más campos
}
```

### Paso 2: Crear el Componente Organismo

```tsx
// MiEntidadTable.tsx
import { useMemo } from 'react'
import { DataTable } from '../../molecules/DataTable'
import type { Column } from '../../molecules/DataTable'
import type { MiEntidad } from '../../../types'

interface Props {
    data: MiEntidad[]
    loading: boolean
    onEdit: (item: MiEntidad) => void
    onDelete: (id: number) => void
}

export const MiEntidadTable = ({ data, loading, onEdit, onDelete }: Props) => {
    // Definir columnas...
    // Renderizar DataTable...
}
```

### Paso 3: Definir las Columnas

```tsx
const columns: Column<MiEntidad>[] = useMemo(() => [
    {
        key: 'id',
        header: 'ID',
        width: 'w-20',
        accessor: (row) => <span className="font-mono">#{row.id}</span>,
        sortable: true,
    },
    {
        key: 'nombre',
        header: 'NOMBRE',
        sortable: true,
        accessor: (row) => (
            <span className="font-medium text-gray-900">{row.nombre}</span>
        ),
    },
    // ... más columnas
], [])
```

### Paso 4: Usar Column Helpers (Recomendado)

```tsx
import { 
    idColumn, 
    textoColumn, 
    fechaColumn, 
    monedaColumn 
} from '../../atoms/columnHelpers'
import { TableHeaderCell } from '../../atoms/TableHeaderCell'

const columns: Column<MiEntidad>[] = useMemo(() => [
    idColumn<MiEntidad>(
        'id',
        <TableHeaderCell>ID</TableHeaderCell>,
        row => row.id
    ),
    textoColumn<MiEntidad>(
        'nombre',
        <TableHeaderCell>Nombre</TableHeaderCell>,
        row => row.nombre
    ),
    fechaColumn<MiEntidad>(
        'fecha',
        <TableHeaderCell>Fecha</TableHeaderCell>,
        row => row.fecha
    ),
    monedaColumn<MiEntidad>(
        'valor',
        <TableHeaderCell>Valor</TableHeaderCell>,
        row => row.valor,
        'COP'
    ),
], [])
```

### Paso 5: Configurar el DataTable

```tsx
return (
    <DataTable
        data={data}
        columns={columns}
        loading={loading}
        getRowKey={(row) => row.id}
        onEdit={onEdit}
        onDelete={(item) => onDelete(item.id)}
        deleteConfirmMessage="¿Estás seguro de eliminar este registro?"
    />
)
```

---

## 💡 Ejemplos Completos

### Ejemplo 1: Tabla Simple (CRUD Básico)

**Caso de uso:** Gestión de catálogos (Cuentas, Terceros, etc.)

```tsx
import { CheckCircle, XCircle } from 'lucide-react'
import { DataTable, type Column } from '../../molecules/DataTable'
import { EntityDisplay } from '../../molecules/entities/EntityDisplay'
import type { Cuenta } from '../../../types'

interface Props {
    cuentas: Cuenta[]
    loading: boolean
    onEdit: (cuenta: Cuenta) => void
    onDelete: (id: number) => void
}

export const CuentasTable = ({ cuentas, loading, onEdit, onDelete }: Props) => {
    const columns: Column<Cuenta>[] = [
        {
            key: 'cuenta',
            header: 'CUENTA',
            sortable: true,
            sortKey: 'nombre',
            accessor: (row) => (
                <EntityDisplay
                    id={row.id}
                    nombre={row.nombre}
                />
            )
        },
        {
            key: 'permite_carga',
            header: 'Permite Carga',
            align: 'center',
            width: 'w-32',
            accessor: (row) => (
                row.permite_carga
                    ? <CheckCircle size={18} className="text-green-500 mx-auto" />
                    : <XCircle size={18} className="text-gray-300 mx-auto" />
            )
        },
    ]

    return (
        <DataTable
            data={cuentas}
            columns={columns}
            loading={loading}
            getRowKey={(c) => c.id}
            onEdit={onEdit}
            onDelete={(cuenta) => onDelete(cuenta.id)}
        />
    )
}
```

---

### Ejemplo 2: Tabla con Scroll Infinito

**Caso de uso:** Listados grandes de movimientos

```tsx
import { useState, useEffect, useRef, useMemo } from 'react'
import { Eye } from 'lucide-react'
import { DataTable } from '../../molecules/DataTable'
import type { Column } from '../../molecules/DataTable'
import { 
    idColumn, 
    fechaColumn, 
    monedaColumn 
} from '../../atoms/columnHelpers'
import { TableHeaderCell } from '../../atoms/TableHeaderCell'
import type { Movimiento } from '../../../types'

interface Props {
    movimientos: Movimiento[]
    loading?: boolean
    onView?: (mov: Movimiento) => void
}

export const MovimientosTable = ({ movimientos, loading, onView }: Props) => {
    const [visibleLimit, setVisibleLimit] = useState(15)
    const scrollContainerRef = useRef<HTMLDivElement>(null)

    // Reset cuando cambian los datos
    useEffect(() => {
        setVisibleLimit(15)
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0
        }
    }, [movimientos])

    // Handler de scroll infinito
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
        if (scrollHeight - scrollTop - clientHeight < 100) {
            if (visibleLimit < movimientos.length) {
                setVisibleLimit(prev => Math.min(prev + 15, movimientos.length))
            }
        }
    }

    const columns: Column<Movimiento>[] = useMemo(() => [
        {
            key: 'actions',
            header: <TableHeaderCell>Acción</TableHeaderCell>,
            align: 'center',
            width: 'w-16',
            accessor: (row) => (
                onView && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onView(row)}
                    >
                        <Eye size={15} />
                    </Button>
                )
            )
        },
        idColumn<Movimiento>('id', <TableHeaderCell>ID</TableHeaderCell>, row => `#${row.id}`),
        fechaColumn<Movimiento>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, row => row.fecha),
        monedaColumn<Movimiento>('valor', <TableHeaderCell>Valor</TableHeaderCell>, row => row.valor, 'COP'),
    ], [onView])

    return (
        <DataTable
            containerRef={scrollContainerRef}
            onScroll={handleScroll}
            data={movimientos.slice(0, visibleLimit)}
            columns={columns}
            getRowKey={(row) => row.id}
            loading={loading}
            stickyHeader={true}
            maxHeight={700}
        />
    )
}
```

---

### Ejemplo 3: Tabla con Headers Agrupados

**Caso de uso:** Reportes financieros con múltiples secciones

```tsx
import { DataTable } from '../../molecules/DataTable'
import type { Column, HeaderGroup } from '../../molecules/DataTable'

const headerGroups: HeaderGroup[] = [
    {
        title: 'Información General',
        colSpan: 3,
        className: 'bg-blue-50 text-blue-700'
    },
    {
        title: 'Valores en COP',
        colSpan: 2,
        className: 'bg-green-50 text-green-700'
    },
    {
        title: 'Valores en USD',
        colSpan: 2,
        className: 'bg-purple-50 text-purple-700'
    },
]

const columns: Column<any>[] = [
    // 3 columnas de info general
    { key: 'id', header: 'ID' },
    { key: 'fecha', header: 'Fecha' },
    { key: 'nombre', header: 'Nombre' },
    // 2 columnas COP
    { key: 'ingresos_cop', header: 'Ingresos', align: 'right' },
    { key: 'egresos_cop', header: 'Egresos', align: 'right' },
    // 2 columnas USD
    { key: 'ingresos_usd', header: 'Ingresos', align: 'right' },
    { key: 'egresos_usd', header: 'Egresos', align: 'right' },
]

<DataTable
    data={data}
    columns={columns}
    headerGroups={headerGroups}
    getRowKey={(row) => row.id}
/>
```

---

## ✅ Mejores Prácticas

### 1. Separación de Responsabilidades

✅ **CORRECTO** - Usar column helpers
```tsx
monedaColumn<Movimiento>('valor', <TableHeaderCell>Valor</TableHeaderCell>, row => row.valor, 'COP')
```

❌ **INCORRECTO** - Estilos inline no reutilizables
```tsx
{
    key: 'valor',
    header: 'Valor',
    accessor: (row) => (
        <span className="font-mono text-sm font-bold text-emerald-500">
            ${row.valor.toLocaleString()}
        </span>
    )
}
```

---

### 2. Type Safety

✅ **CORRECTO** - Tipos genéricos
```tsx
const columns: Column<Movimiento>[] = useMemo(() => [...], [])
```

❌ **INCORRECTO** - Sin tipos
```tsx
const columns = [...]
```

---

### 3. Memoización

✅ **CORRECTO** - Evitar re-renders innecesarios
```tsx
const columns = useMemo(() => [...], [onEdit, onDelete])
```

❌ **INCORRECTO** - Columnas recreadas en cada render
```tsx
const columns = [...]
```

---

### 4. Composición vs Customización

✅ **CORRECTO** - Reutilizar moléculas existentes
```tsx
<EntityDisplay id={row.id} nombre={row.nombre} />
```

❌ **INCORRECTO** - Duplicar lógica
```tsx
<div>
    <span className="font-mono text-[11px]">{row.id}</span>
    <span className="text-[13px]">{row.nombre}</span>
</div>
```

---

### 5. Naming Conventions

✅ **CORRECTO**
```
MiEntidadTable.tsx     → Organismo
DataTable.tsx          → Molécula
Button.tsx             → Átomo
```

❌ **INCORRECTO**
```
tabla-mi-entidad.tsx
DataTableComponent.tsx
btn.tsx
```

---

### 6. Scroll Infinito

✅ **CORRECTO** - Control de límites y reset
```tsx
const [visibleLimit, setVisibleLimit] = useState(15)

useEffect(() => {
    setVisibleLimit(15)
    scrollContainerRef.current?.scrollTop = 0
}, [data])
```

❌ **INCORRECTO** - Sin control de estado
```tsx
<DataTable data={allData} /> // Puede causar problemas de performance
```

---

### 7. Sticky Headers

Para que funcione correctamente:

```tsx
// ✅ ESTRUCTURA CORRECTA
<div style={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
    <DataTable
        stickyHeader={true}
        className="flex-1 overflow-y-auto"
        style={{ height: '100%' }}
    />
</div>
```

---

### 8. Acciones Customizadas

✅ **CORRECTO** - Columna de acciones explícita
```tsx
{
    key: 'actions',
    header: <TableHeaderCell>Acción</TableHeaderCell>,
    accessor: (row) => (
        <Button onClick={() => onView(row)}>
            <Eye size={15} />
        </Button>
    )
}
```

Configurar `showActions={false}` en DataTable para no duplicar columna de acciones.

---

## 🐛 Troubleshooting

### Problema: Las columnas no ordenan correctamente

**Causa:** No se especificó `sortKey` para campos anidados

**Solución:**
```tsx
{
    key: 'cuenta',
    header: 'Cuenta',
    sortable: true,
    sortKey: 'cuenta_nombre',  // ← Campo plano para ordenar
    accessor: (row) => <EntityDisplay id={row.cuenta_id} nombre={row.cuenta_nombre} />
}
```

---

### Problema: Sticky header no funciona

**Causa:** Contenedor padre no tiene altura definida

**Solución:**
```tsx
<div style={{ height: '700px', display: 'flex', flexDirection: 'column' }}>
    <DataTable stickyHeader={true} />
</div>
```

---

### Problema: Scroll infinito no carga más datos

**Causa:** El threshold de scroll es muy pequeño o `visibleLimit` no se actualiza

**Solución:**
```tsx
const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
    // Threshold de 100px
    if (scrollHeight - scrollTop - clientHeight < 100) {
        if (visibleLimit < data.length) {
            setVisibleLimit(prev => Math.min(prev + 15, data.length))
        }
    }
}
```

---

### Problema: Re-renders excesivos

**Causa:** Columnas no memoizadas o dependencias incorrectas

**Solución:**
```tsx
const columns = useMemo(() => [...], [onEdit, onDelete]) // ← Dependencias correctas
```

---

## 📚 Referencias

- **Diseño Atómico:** [Atomic Design by Brad Frost](https://bradfrost.com/blog/post/atomic-web-design/)
- **Ejemplo de Referencia:** `frontend/src/components/organisms/MovimientosTable.tsx`
- **Guía de Reportes:** `Documentos/GUIDELINES_REPORTES.md`
- **DataTable API:** `frontend/docs/DataTable_Guia.md`

---

## 🔄 Changelog

- **2026-02-03:** Documento inicial creado con análisis completo de diseño atómico
- Basado en la implementación verificada de `MovimientosTable.tsx`
- Incluye 14 componentes organismoos de ejemplo existentes

---

**¿Preguntas o sugerencias?**  
Consulta con el equipo de desarrollo o revisa los componentes existentes en `frontend/src/components/`.
