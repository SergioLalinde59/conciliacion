/**
 * FechaDisplay - Componente atómico para mostrar fechas
 *
 * Formatea fechas ISO (YYYY-MM-DD) en formato colombiano.
 * Usa timeZone: 'UTC' para evitar desfase de un día por zona horaria.
 */

import React from 'react'

interface FechaDisplayProps {
    value: string | Date
    className?: string
    /** Opciones de formato Intl adicionales (day, month, year, etc.) */
    options?: Intl.DateTimeFormatOptions
}

/**
 * Función utilitaria para formatear fecha (usar fuera de componentes React)
 *
 * @example
 * formatFecha('2026-02-24')                                     // "24/2/2026"
 * formatFecha('2026-02-24', { day: '2-digit', month: 'short' }) // "24 feb"
 */
export const formatFecha = (dateStr: string, options?: Intl.DateTimeFormatOptions): string => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('es-CO', { timeZone: 'UTC', ...options })
}

/**
 * Componente FechaDisplay
 *
 * @example
 * <FechaDisplay value="2026-02-24" />
 * <FechaDisplay value="2026-02-24" options={{ day: '2-digit', month: 'short' }} />
 * <FechaDisplay value={movimiento.fecha} className="text-gray-500" />
 */
export const FechaDisplay: React.FC<FechaDisplayProps> = ({ value, className, options }) => {
    const dateStr = value instanceof Date ? value.toISOString().split('T')[0] : value
    if (!dateStr) return <span className={className}>-</span>
    return <span className={className}>{formatFecha(dateStr, options)}</span>
}
