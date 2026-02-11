import { API_BASE_URL, handleResponse } from './httpClient'
import type { ReglaPresupuesto } from '../types/ReglaPresupuesto'

export const reglasPresupuestoService = {
    listar: async (): Promise<ReglaPresupuesto[]> => {
        return fetch(`${API_BASE_URL}/api/reglas-presupuesto`).then(handleResponse)
    },

    obtener: async (id: number): Promise<ReglaPresupuesto> => {
        return fetch(`${API_BASE_URL}/api/reglas-presupuesto/${id}`).then(handleResponse)
    },

    crear: async (dto: Omit<ReglaPresupuesto, 'id' | 'centro_costo_nombre' | 'concepto_nombre'>): Promise<ReglaPresupuesto> => {
        return fetch(`${API_BASE_URL}/api/reglas-presupuesto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    actualizar: async (id: number, dto: Omit<ReglaPresupuesto, 'id' | 'centro_costo_nombre' | 'concepto_nombre'>): Promise<ReglaPresupuesto> => {
        return fetch(`${API_BASE_URL}/api/reglas-presupuesto/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto)
        }).then(handleResponse)
    },

    eliminar: async (id: number): Promise<void> => {
        await fetch(`${API_BASE_URL}/api/reglas-presupuesto/${id}`, { method: 'DELETE' }).then(handleResponse)
    },

    crearLote: async (reglas: Omit<ReglaPresupuesto, 'id' | 'centro_costo_nombre' | 'concepto_nombre'>[]): Promise<{ creadas: number; omitidas: number }> => {
        return fetch(`${API_BASE_URL}/api/reglas-presupuesto/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reglas })
        }).then(handleResponse)
    },
}
