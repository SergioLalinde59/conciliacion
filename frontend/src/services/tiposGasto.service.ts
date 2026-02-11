import { API_BASE_URL, handleResponse } from './httpClient'
import type { TipoGasto } from '../types/TipoGasto'

export const tiposGastoService = {
    listar: async (): Promise<TipoGasto[]> => {
        return fetch(`${API_BASE_URL}/api/tipos-gasto`).then(handleResponse)
    },

    obtener: async (id: number): Promise<TipoGasto> => {
        return fetch(`${API_BASE_URL}/api/tipos-gasto/${id}`).then(handleResponse)
    },

    crear: async (dto: Omit<TipoGasto, 'id'>): Promise<TipoGasto> => {
        return fetch(`${API_BASE_URL}/api/tipos-gasto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    actualizar: async (id: number, dto: Omit<TipoGasto, 'id'>): Promise<TipoGasto> => {
        return fetch(`${API_BASE_URL}/api/tipos-gasto/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    eliminar: async (id: number): Promise<void> => {
        await fetch(`${API_BASE_URL}/api/tipos-gasto/${id}`, { method: 'DELETE' }).then(handleResponse)
    },
}
