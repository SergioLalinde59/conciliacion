import { API_BASE_URL, handleResponse } from './httpClient'
import type { IndicadorEconomico } from '../types/IndicadorEconomico'

export const indicadoresService = {
    listar: async (anio?: number): Promise<IndicadorEconomico[]> => {
        const params = anio ? `?anio=${anio}` : ''
        return fetch(`${API_BASE_URL}/api/indicadores-economicos${params}`).then(handleResponse)
    },

    obtener: async (id: number): Promise<IndicadorEconomico> => {
        return fetch(`${API_BASE_URL}/api/indicadores-economicos/${id}`).then(handleResponse)
    },

    crear: async (dto: Omit<IndicadorEconomico, 'id'>): Promise<IndicadorEconomico> => {
        return fetch(`${API_BASE_URL}/api/indicadores-economicos`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    actualizar: async (id: number, dto: Omit<IndicadorEconomico, 'id'>): Promise<IndicadorEconomico> => {
        return fetch(`${API_BASE_URL}/api/indicadores-economicos/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    eliminar: async (id: number): Promise<void> => {
        await fetch(`${API_BASE_URL}/api/indicadores-economicos/${id}`, { method: 'DELETE' }).then(handleResponse)
    },
}
