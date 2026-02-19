export interface KeywordPair {
    centro_costo: string | null
    concepto: string | null
}

export interface TipoGasto {
    id: number
    tipo: string
    descripcion?: string | null
    indicador_default: string | null
    excluir_presupuesto: boolean
    activo: boolean
    keywords: KeywordPair[]
    prioridad: number
    direccion: 'ingreso' | 'egreso'
}
