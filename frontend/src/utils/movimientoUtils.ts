import type { Movimiento } from '../types'

/**
 * Fila aplanada de detalle para mostrar en tablas.
 * Cada fila representa UN detalle, con campos del encabezado propagados.
 */
export interface MovimientoFlat {
    id: number                       // detalle.id (o encabezado.id si no tiene detalles)
    movimiento_id: number            // encabezado.id (para navegación/edición)
    fecha: string
    descripcion: string
    referencia: string
    valor: number                    // detalle.valor
    usd?: number | null
    trm?: number | null
    trm_provisional?: boolean | null
    moneda_id: number
    moneda_display: string
    cuenta_id: number
    cuenta_nombre?: string
    cuenta_display: string
    tercero_id?: number | null
    tercero_nombre?: string
    centro_costo_id?: number | null
    centro_costo_nombre?: string
    concepto_id?: number | null
    concepto_nombre?: string
}

/**
 * Aplana movimientos en filas de detalle.
 * Si un movimiento tiene N detalles, genera N filas.
 * Propaga campos del encabezado (fecha, descripción, cuenta) a cada fila.
 * Distribuye USD proporcionalmente entre detalles.
 */
export const flattenMovimientos = (movimientos: Movimiento[]): MovimientoFlat[] => {
    const result: MovimientoFlat[] = []

    for (const mov of movimientos) {
        if (mov.detalles && mov.detalles.length > 0) {
            const numDetalles = mov.detalles.length
            for (const det of mov.detalles) {
                // Propagar USD del encabezado proporcionalmente
                let detUsd: number | null = null
                if (detUsd == null && mov.usd != null) {
                    if (numDetalles === 1) {
                        detUsd = mov.usd
                    } else if (mov.valor !== 0) {
                        detUsd = mov.usd * (det.valor / mov.valor)
                    } else {
                        detUsd = mov.usd / numDetalles
                    }
                }
                result.push({
                    id: det.id ?? mov.id,
                    movimiento_id: mov.id,
                    fecha: mov.fecha,
                    descripcion: mov.descripcion,
                    referencia: mov.referencia,
                    valor: det.valor,
                    usd: detUsd,
                    trm: mov.trm,
                    trm_provisional: mov.trm_provisional,
                    moneda_id: mov.moneda_id,
                    moneda_display: mov.moneda_display,
                    cuenta_id: mov.cuenta_id,
                    cuenta_nombre: mov.cuenta_nombre,
                    cuenta_display: mov.cuenta_display,
                    tercero_id: det.tercero_id ?? mov.tercero_id,
                    tercero_nombre: det.tercero_nombre || mov.tercero_nombre,
                    centro_costo_id: det.centro_costo_id,
                    centro_costo_nombre: det.centro_costo_nombre || mov.centro_costo_nombre,
                    concepto_id: det.concepto_id,
                    concepto_nombre: det.concepto_nombre || mov.concepto_nombre,
                })
            }
        } else {
            // Sin detalles: usar el encabezado como fila
            result.push({
                id: mov.id,
                movimiento_id: mov.id,
                fecha: mov.fecha,
                descripcion: mov.descripcion,
                referencia: mov.referencia,
                valor: mov.valor,
                usd: mov.usd,
                trm: mov.trm,
                trm_provisional: mov.trm_provisional,
                moneda_id: mov.moneda_id,
                moneda_display: mov.moneda_display,
                cuenta_id: mov.cuenta_id,
                cuenta_nombre: mov.cuenta_nombre,
                cuenta_display: mov.cuenta_display,
                tercero_id: mov.tercero_id,
                tercero_nombre: mov.tercero_nombre,
                centro_costo_id: mov.centro_costo_id,
                centro_costo_nombre: mov.centro_costo_nombre,
                concepto_id: mov.concepto_id,
                concepto_nombre: mov.concepto_nombre,
            })
        }
    }

    return result
}
