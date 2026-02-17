import { API_BASE_URL, handleResponse, buildQueryParams } from './httpClient'

export interface DashboardStats {
    periodo: string
    cuenta_id: number
    cuenta_nombre: string
    centro_costo_id: number | null
    centro_costo_nombre: string
    conteo: number
    ingresos: number
    egresos: number
}

export interface FlujoCajaMes {
    mes: string
    ingresos: number
    egresos: number
    saldo: number
}

export interface ClasificacionItem {
    nombre: string
    ingresos: number
    egresos: number
    saldo: number
}

export const dashboardService = {
    obtenerEstadisticas: (desde?: string, hasta?: string): Promise<DashboardStats[]> => {
        const params = new URLSearchParams()
        if (desde) params.append('desde', desde)
        if (hasta) params.append('hasta', hasta)

        return fetch(`${API_BASE_URL}/api/dashboard/estadisticas?${params.toString()}`).then(handleResponse)
    },

    flujoMensual: (desde?: string, hasta?: string, centrosExcluidos?: number[]): Promise<FlujoCajaMes[]> => {
        const params = buildQueryParams({
            desde, hasta,
            centros_costos_excluidos: centrosExcluidos?.length ? centrosExcluidos : undefined,
        } as Record<string, unknown>)
        return fetch(`${API_BASE_URL}/api/movimientos/reporte/ingresos-gastos-mes?${params}`).then(handleResponse)
    },

    topEgresos: (desde?: string, hasta?: string, tipo: string = 'centro_costo', centrosExcluidos?: number[]): Promise<ClasificacionItem[]> => {
        const params = buildQueryParams({
            desde, hasta, tipo,
            centros_costos_excluidos: centrosExcluidos?.length ? centrosExcluidos : undefined,
        } as Record<string, unknown>)
        return fetch(`${API_BASE_URL}/api/movimientos/reporte/clasificacion?${params}`).then(handleResponse)
    },
}
