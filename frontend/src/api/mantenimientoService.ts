import { API_BASE_URL } from '../config';

export interface ReclasificacionStats {
    cuenta_id: number;
    cuenta_nombre: string;
    conteo: number;
    ingresos: number;
    egresos: number;
    estado_periodo: string;
    bloqueado: boolean;
}

export interface ReclasificacionResult {
    mensaje: string;
    registros_reclasificados: number;
}

export const mantenimientoService = {
    analizarReclasificacion: async (
        fecha: string,
        fechaFin?: string,
        cuentaId?: number,
        extraParams?: {
            tercero_id?: number;
            centro_costo_id?: number;
            concepto_id?: number;
            centros_costos_excluidos?: number[];
        }
    ): Promise<ReclasificacionStats[]> => {
        let url = `${API_BASE_URL}/api/mantenimiento/analizar-desvinculacion?fecha=${fecha}`;
        if (fechaFin) {
            url += `&fecha_fin=${fechaFin}`;
        }
        if (cuentaId) {
            url += `&cuenta_id=${cuentaId}`;
        }

        // Add extra filters
        if (extraParams) {
            if (extraParams.tercero_id) url += `&tercero_id=${extraParams.tercero_id}`;
            if (extraParams.centro_costo_id) url += `&centro_costo_id=${extraParams.centro_costo_id}`;
            if (extraParams.concepto_id) url += `&concepto_id=${extraParams.concepto_id}`;

            if (extraParams.centros_costos_excluidos && extraParams.centros_costos_excluidos.length > 0) {
                extraParams.centros_costos_excluidos.forEach(id => {
                    url += `&centros_costos_excluidos=${id}`;
                });
            }
        }

        const response = await fetch(url);
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al analizar reclasificación');
        }
        return response.json();
    },

    reclasificarMovimientos: async (fecha: string, backup: boolean, cuentaId?: number, fechaFin?: string): Promise<ReclasificacionResult> => {
        let url = `${API_BASE_URL}/api/mantenimiento/desvincular-movimientos?fecha=${fecha}&backup=${backup}`;
        if (fechaFin) {
            url += `&fecha_fin=${fechaFin}`;
        }
        if (cuentaId) {
            url += `&cuenta_id=${cuentaId}`;
        }
        const response = await fetch(url, {
            method: 'POST',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al reclasificar movimientos');
        }
        return response.json();
    },

    reclasificarLote: async (ids: number[], backup: boolean = true): Promise<ReclasificacionResult> => {
        let url = `${API_BASE_URL}/api/mantenimiento/desvincular-lote?backup=${backup}`;
        ids.forEach(id => {
            url += `&ids=${id}`;
        });

        const response = await fetch(url, {
            method: 'POST',
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Error al reclasificar movimientos en lote');
        }
        return response.json();
    }
};
