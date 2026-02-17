import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reglasPresupuestoService } from '../services/reglasPresupuesto.service'
import { PRESUPUESTO_KEYS } from './usePresupuesto'
import type { ReglaPresupuesto } from '../types/ReglaPresupuesto'

const KEYS = {
    all: ['reglas-presupuesto'] as const,
    lista: () => [...KEYS.all, 'lista'] as const,
}

export const useReglasPresupuesto = () =>
    useQuery({
        queryKey: KEYS.lista(),
        queryFn: () => reglasPresupuestoService.listar(),
        staleTime: 5 * 60 * 1000,
    })

export const useReglaPresupuestoMutations = () => {
    const qc = useQueryClient()
    const invalidate = () => {
        qc.invalidateQueries({ queryKey: KEYS.all })
        qc.invalidateQueries({ queryKey: PRESUPUESTO_KEYS.all })
    }

    const crear = useMutation({
        mutationFn: (dto: Omit<ReglaPresupuesto, 'id' | 'centro_costo_nombre' | 'concepto_nombre'>) =>
            reglasPresupuestoService.crear(dto),
        onSuccess: invalidate,
    })

    const actualizar = useMutation({
        mutationFn: ({ id, centro_costo_nombre: _, concepto_nombre: __, ...dto }: ReglaPresupuesto) =>
            reglasPresupuestoService.actualizar(id, dto),
        onSuccess: invalidate,
    })

    const eliminar = useMutation({
        mutationFn: (id: number) => reglasPresupuestoService.eliminar(id),
        onSuccess: invalidate,
    })

    const crearLote = useMutation({
        mutationFn: (reglas: Omit<ReglaPresupuesto, 'id' | 'centro_costo_nombre' | 'concepto_nombre'>[]) =>
            reglasPresupuestoService.crearLote(reglas),
        onSuccess: invalidate,
    })

    return { crear, actualizar, eliminar, crearLote }
}
