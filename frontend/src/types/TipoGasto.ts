export interface TipoGasto {
    id: number
    tipo: string
    descripcion?: string | null
    indicador_default: string | null
    excluir_presupuesto: boolean
    activo: boolean
}
