export interface ItemCatalogo {
    id: number
    nombre: string
    centro_costo_id?: number // Solo para conceptos
}

export interface ClasificacionManual {
    tercero_id: number
    centro_costo_id: number
    concepto_id: number
}

export interface ConfiguracionTipoCuenta {
    tipo_cuenta_id: number | null
    tipo_cuenta_nombre: string | null
    // Permisos
    permite_crear_manual: boolean
    permite_editar: boolean
    permite_modificar: boolean
    permite_borrar: boolean
    permite_clasificar: boolean
    // Validaciones
    requiere_descripcion: boolean
    valor_minimo: number | null
    // UX
    responde_enter: boolean
}

export interface Cuenta {
    id: number
    nombre: string
    moneda?: string
    permite_carga: boolean
    permite_conciliar: boolean
    tipo_cuenta_id?: number | null
    tipo_cuenta_nombre?: string | null
    configuracion?: ConfiguracionTipoCuenta | null
}

export interface Moneda {
    id: number
    isocode: string
    nombre: string
}

export interface TipoCuenta {
    id: number
    nombre: string
    descripcion?: string
    // Pesos algoritmo clasificación
    peso_referencia: number
    peso_descripcion: number
    peso_valor: number
    longitud_min_referencia: number
    // Permisos
    permite_crear_manual: boolean
    permite_editar: boolean
    permite_modificar: boolean
    permite_borrar: boolean
    permite_clasificar: boolean
    // Validaciones
    requiere_descripcion: boolean
    valor_minimo: number | null
    // UX
    responde_enter: boolean
    // Clasificación avanzada
    referencia_define_tercero: boolean
    activo: boolean
}

export interface TipoMovimiento {
    id: number
    nombre: string
}

export interface Tercero {
    id: number
    nombre: string
}

export interface TerceroDescripcion {
    id: number
    terceroid: number
    descripcion?: string
    referencia?: string
    activa: boolean
}

export interface CentroCosto {
    id: number
    nombre: string
}

export interface Concepto {
    id: number
    nombre: string
    centro_costo_id?: number
}

export interface MovimientoDetalle {
    id?: number
    valor: number
    centro_costo_id: number | null
    concepto_id: number | null
    tercero_id?: number | null
    centro_costo_nombre?: string
    concepto_nombre?: string
    tercero_nombre?: string
}

export interface Movimiento {
    id: number
    fecha: string
    descripcion: string
    referencia: string
    valor: number
    valor_filtrado?: number | null  // Valor parcial cuando hay filtros por centro_costo/concepto
    usd?: number | null
    trm?: number | null
    moneda_id: number
    cuenta_id: number
    tercero_id?: number | null
    centro_costo_id?: number | null
    concepto_id?: number | null
    created_at?: string | null
    // Campos de visualización en formato "id - descripción"
    cuenta_display: string
    moneda_display: string
    tercero_display?: string
    centro_costo_display?: string
    concepto_display?: string
    detalle?: string // Campo adicional de BD
    detalles?: MovimientoDetalle[]

    // Nombres directos para reportes/tablas
    cuenta_nombre?: string
    moneda_nombre?: string
    tercero_nombre?: string
    centro_costo_nombre?: string
    concepto_nombre?: string
}

export interface SugerenciaClasificacion {
    tercero_id: number | null
    centro_costo_id: number | null
    concepto_id: number | null
    razon: string | null
    tipo_match: string | null
}

export interface ContextoItem {
    movimiento: Movimiento
    score: number  // Porcentaje de coincidencia (0-100)
}

export interface ContextoClasificacionResponse {
    movimiento_id: number
    sugerencia: SugerenciaClasificacion
    contexto: ContextoItem[]
    referencia_no_existe: boolean
    referencia?: string | null
}

export interface ClasificacionLoteDTO {
    patron: string
    tercero_id: number
    centro_costo_id: number
    concepto_id: number
}

export interface ReglaClasificacion {
    id?: number
    patron?: string
    patron_descripcion?: string
    tercero_id?: number
    centro_costo_id?: number
    concepto_id?: number
    activa?: boolean
    prioridad?: number
    tipo_match?: string
    cuenta_id?: number
}

export interface ConfigFiltroCentroCosto {
    id: number
    centro_costo_id: number
    etiqueta: string
    activo_por_defecto: boolean
}



export interface CuentaExtractor {
    id?: number
    cuenta_id: number
    tipo: string
    modulo: string
    orden: number
    activo: boolean
    created_at?: string
}

// Force module compilation
export const _types_module = true

