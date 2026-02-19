export interface ReglaPresupuesto {
    id: number
    centro_costo_id: number | null
    concepto_id: number | null
    tipo_gasto: string
    indicador_nombre: string | null
    factor_ajuste: number
    monto_fijo_mensual: number | null
    notas?: string | null
    direccion?: string
    centro_costo_nombre?: string | null
    concepto_nombre?: string | null
}
