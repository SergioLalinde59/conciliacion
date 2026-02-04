/**
 * Utilidades para manejo de fechas en formato ISO 8601 (YYYY-MM-DD)
 * sin problemas de desplazamiento por zona horaria.
 */

/**
 * Formatea un objeto Date a string YYYY-MM-DD local.
 */
export const formatDateISO = (date: Date): string => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

/**
 * Retorna la fecha de hoy en formato YYYY-MM-DD local.
 */
export const getTodayStr = (): string => {
    return formatDateISO(new Date())
}

/**
 * Parsea un string YYYY-MM-DD a un objeto Date local (a las 00:00:00).
 * Útil para comparaciones seguras.
 */
export const parseDateISO = (dateStr: string): Date => {
    const [year, month, day] = dateStr.split('-').map(Number)
    return new Date(year, month - 1, day)
}

/**
 * Verifica si una fecha es futura respecto a hoy (local).
 */
export const isFutureDate = (dateStr: string): boolean => {
    const target = parseDateISO(dateStr)
    const today = parseDateISO(getTodayStr())
    return target > today
}

// Date Range Helpers
export const getMesActual = () => {
    const ahora = new Date()
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth(), 1)
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
    return { inicio: formatDateISO(inicio), fin: formatDateISO(fin) }
}

export const getMesAnterior = () => {
    const ahora = new Date()
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1)
    const fin = new Date(ahora.getFullYear(), ahora.getMonth(), 0)
    return { inicio: formatDateISO(inicio), fin: formatDateISO(fin) }
}

export const getUltimos3Meses = () => {
    const ahora = new Date()
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 2, 1)
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
    return { inicio: formatDateISO(inicio), fin: formatDateISO(fin) }
}

export const getUltimos6Meses = () => {
    const ahora = new Date()
    const inicio = new Date(ahora.getFullYear(), ahora.getMonth() - 5, 1)
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
    return { inicio: formatDateISO(inicio), fin: formatDateISO(fin) }
}

export const getAnioYTD = () => {
    const ahora = new Date()
    const inicio = new Date(ahora.getFullYear(), 0, 1)
    // Para YTD, si se prefiere hasta hoy:
    const fin = ahora
    // Si se prefiere hasta fin de año, sería: new Date(ahora.getFullYear(), 11, 31)
    // Usaremos hoy por "Year To Date"
    return { inicio: formatDateISO(inicio), fin: formatDateISO(fin) }
}

export const getAnioAnterior = () => {
    const ahora = new Date()
    const inicio = new Date(ahora.getFullYear() - 1, 0, 1)
    const fin = new Date(ahora.getFullYear() - 1, 11, 31)
    return { inicio: formatDateISO(inicio), fin: formatDateISO(fin) }
}

export const getUltimos12Meses = () => {
    const ahora = new Date()
    const inicio = new Date(ahora.getFullYear() - 1, ahora.getMonth() + 1, 1)
    const fin = new Date(ahora.getFullYear(), ahora.getMonth() + 1, 0)
    return { inicio: formatDateISO(inicio), fin: formatDateISO(fin) }
}

export const getMonthsBetween = (startDateStr: string, endDateStr: string): { year: number, month: number }[] => {
    const start = parseDateISO(startDateStr)
    const end = parseDateISO(endDateStr)
    const result: { year: number, month: number }[] = []

    // Start with the first day of the start month
    let current = new Date(start.getFullYear(), start.getMonth(), 1)
    // End with the first day of the end month to ensure comparison works
    const target = new Date(end.getFullYear(), end.getMonth(), 1)

    while (current <= target) {
        result.push({
            year: current.getFullYear(),
            month: current.getMonth() + 1
        })
        current.setMonth(current.getMonth() + 1)
    }

    return result
}

/**
 * Calcula el periodo anterior equivalente para comparativas.
 * Si el periodo es un mes completo, retorna el mes anterior.
 * Si es un rango arbitrario, resta la misma cantidad de días.
 */
export const getPreviousPeriod = (inicio: string, fin: string): { inicio: string, fin: string } => {
    const start = parseDateISO(inicio)
    const end = parseDateISO(fin)

    // Verificar si es un mes completo exacto
    const isStartOfMonth = start.getDate() === 1
    const isEndOfMonth = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getDate() === 1
    const isSameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()

    if (isStartOfMonth && isEndOfMonth && isSameMonth) {
        const prevStart = new Date(start.getFullYear(), start.getMonth() - 1, 1)
        const prevEnd = new Date(start.getFullYear(), start.getMonth(), 0)
        return { inicio: formatDateISO(prevStart), fin: formatDateISO(prevEnd) }
    }

    // Diferencia en días
    const diffTime = Math.abs(end.getTime() - start.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1

    const prevStart = new Date(start.getTime())
    prevStart.setDate(prevStart.getDate() - diffDays)

    const prevEnd = new Date(start.getTime())
    prevEnd.setDate(prevEnd.getDate() - 1)

    return { inicio: formatDateISO(prevStart), fin: formatDateISO(prevEnd) }
}
