import { API_BASE_URL, handleResponse } from './httpClient'
import type { Perspectiva } from '../types'

export interface PerspectivaDTO {
    nombre: string
    slug: string
    tipo: 'incluir' | 'excluir'
    centro_costo_ids: number[]
    siempre_excluir_ids: number[]
    es_defecto: boolean
    orden: number
}

export const perspectivaService = {
    obtenerTodas: (): Promise<Perspectiva[]> =>
        fetch(`${API_BASE_URL}/api/perspectivas`).then(handleResponse),

    crear: (dto: PerspectivaDTO): Promise<Perspectiva> =>
        fetch(`${API_BASE_URL}/api/perspectivas`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        }).then(handleResponse),

    actualizar: (id: number, dto: PerspectivaDTO): Promise<Perspectiva> =>
        fetch(`${API_BASE_URL}/api/perspectivas/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dto),
        }).then(handleResponse),

    eliminar: (id: number): Promise<void> =>
        fetch(`${API_BASE_URL}/api/perspectivas/${id}`, { method: 'DELETE' }).then(handleResponse),
}