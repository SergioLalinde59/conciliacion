export interface IndicadorEconomico {
    id: number
    anio: number
    indicador: string
    valor_porcentaje: number
    notas?: string | null
    rango_min_smlv?: number | null
    rango_max_smlv?: number | null
}
