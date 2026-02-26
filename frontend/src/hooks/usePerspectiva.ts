import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useSessionStorage } from './useSessionStorage'
import { perspectivaService } from '../services/perspectiva.service'
import type { PerspectiveFilterParams } from '../types'

const STORAGE_KEY = 'perspectiva_activa'

export function usePerspectiva() {
    const { data: perspectivas = [], isLoading } = useQuery({
        queryKey: ['perspectivas'],
        queryFn: perspectivaService.obtenerTodas,
        staleTime: 5 * 60 * 1000,
    })

    const [selectedSlug, setSelectedSlug] = useSessionStorage<string>(STORAGE_KEY, '')

    // Determinar slug efectivo: el guardado, o el defecto, o el primero
    const effectiveSlug = useMemo(() => {
        if (!perspectivas.length) return ''
        if (selectedSlug && perspectivas.some(p => p.slug === selectedSlug)) return selectedSlug
        const defecto = perspectivas.find(p => p.es_defecto)
        return defecto ? defecto.slug : perspectivas[0].slug
    }, [perspectivas, selectedSlug])

    // Perspectiva activa
    const selected = useMemo(
        () => perspectivas.find(p => p.slug === effectiveSlug) || null,
        [perspectivas, effectiveSlug]
    )

    // Computar filterParams a partir de la perspectiva
    const filterParams: PerspectiveFilterParams = useMemo(() => {
        if (!selected) return {}

        const excluidos = selected.siempre_excluir_ids.length > 0
            ? selected.siempre_excluir_ids
            : undefined

        if (selected.tipo === 'incluir') {
            return {
                centros_costos_excluidos: excluidos,
                centros_costos_incluidos: selected.centro_costo_ids.length > 0
                    ? selected.centro_costo_ids
                    : undefined,
            }
        }

        // tipo === 'excluir'
        const allExcluidos = selected.centro_costo_ids.length > 0
            ? selected.centro_costo_ids
            : excluidos

        return {
            centros_costos_excluidos: allExcluidos,
        }
    }, [selected])

    const ready = !isLoading && perspectivas.length > 0

    return {
        perspectivas,
        selectedSlug: effectiveSlug,
        setSelectedSlug,
        selected,
        filterParams,
        ready,
    }
}
