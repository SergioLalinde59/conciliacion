export interface Presupuesto {
    id: number
    anio: number
    nombre: string
    estado: 'borrador' | 'activo' | 'cerrado'
    notas?: string | null
    semaforo_verde_hasta: number
    semaforo_amarillo_hasta: number
    umbral_minimo_mensual: number
    umbral_minimo_anual: number
    umbral_no_repetitivo: number
    created_at?: string | null
}

export interface PresupuestoDetalle {
    id: number
    presupuesto_id: number
    centro_costo_id: number
    concepto_id?: number | null
    tercero_id?: number | null
    mes: number
    monto_presupuestado: number
    monto_ajustado?: number | null
    monto_base?: number | null
    monto_efectivo: number
    tipo: string
    notas?: string | null
    centro_costo_nombre?: string
    concepto_nombre?: string
    tercero_nombre?: string
}

export interface FijoSinMontoInfo {
    centro_costo_id: number
    concepto_id: number | null
    tercero_id: number | null
    mes: number
    monto_base: number
    tipo_detectado: string
    centro_costo_nombre?: string
    concepto_nombre?: string
    tercero_nombre?: string
}

export interface GeneracionPreview {
    regulares: number
    no_repetitivos: NoRepetitivoInfo[]
    fijos_sin_monto: FijoSinMontoInfo[]
    resumen: GeneracionResumen
}

export interface NoRepetitivoInfo {
    centro_costo_id: number
    concepto_id: number | null
    tercero_id: number | null
    mes: number
    monto: number
    tipo_detectado: string
    razon: string
    centro_costo_nombre?: string
    concepto_nombre?: string
    tercero_nombre?: string
}

export interface GeneracionResumen {
    total_lineas: number
    total_excluidas: number
    total_fijos_sin_monto?: number
    total_base: number
    total_presupuestado: number
    pct_aumento_promedio: number
    por_tipo: Record<string, number>
    por_indicador: Record<string, number>
    indicadores?: Record<string, { nombre: string; valor: number }>

}

export interface GeneracionResult {
    lineas_generadas: number
    lineas_excluidas: number
    incluidos_manualmente: number
    fijos_incluidos: number
    resumen: GeneracionResumen
}

export interface ClasificacionPreviewItem {
    centro_costo_id: number
    concepto_id: number | null
    centro_costo_nombre: string
    concepto_nombre: string | null
    meses_activos: number
    monto_total: number
    regla_id: number | null
    nivel_match: 'CC+Concepto' | 'CC' | 'Global' | 'Auto' | 'Default'
    tipo_gasto: string
    indicador_nombre: string | null
    factor_ajuste: number
    monto_fijo_mensual: number | null
}

export interface ComparacionPresupuesto {
    id: number | null
    nombre: string
    presupuestado: number
    ejecutado: number
    ejecutado_anterior: number
    variacion: number
    variacion_pct: number
    semaforo: 'verde' | 'amarillo' | 'rojo'
}

export interface ResumenMensualPresupuesto {
    mes: number
    mes_nombre: string
    presupuestado: number
    ejecutado: number
    ejecutado_anterior: number
    variacion: number
    variacion_pct: number
    semaforo: 'verde' | 'amarillo' | 'rojo'
}

export interface PresupuestoWidget {
    tiene_presupuesto: boolean
    presupuesto_id?: number
    presupuesto_nombre?: string
    presupuesto_mes_actual: number
    ejecutado_mes_actual: number
    porcentaje_consumido: number
    semaforo: 'verde' | 'amarillo' | 'rojo'
    dias_restantes: number
    mes_nombre: string
}
