/**
 * Extrae el nombre probable del tercero de una descripción de extracto bancario.
 * Elimina prefijos comunes de transacciones bancarias colombianas.
 *
 * Ejemplos:
 *   "Pago Qr Cafe Capiro"       → "Cafe Capiro"
 *   "Compra En Exito Calle 80"  → "Exito Calle 80"
 *   "Transferencia A Juan Perez" → "Juan Perez"
 */
export const extraerNombreTercero = (descripcion: string): string => {
    if (!descripcion) return ''

    const prefijos = [
        'Pago Qr ',
        'Compra En ',
        'Compra Nac ',
        'Compra Int ',
        'Compra ',
        'Transferencia Cta Suc Virtual ',
        'Transferencia A ',
        'Transferencia ',
        'Pago Pse ',
        'Pago Tc ',
        'Pago ',
        'Retiro ',
        'Abono ',
    ]

    const upper = descripcion.toUpperCase()
    for (const prefijo of prefijos) {
        if (upper.startsWith(prefijo.toUpperCase())) {
            const resto = descripcion.slice(prefijo.length).trim()
            if (resto.length > 0) return resto
        }
    }

    return descripcion
}
