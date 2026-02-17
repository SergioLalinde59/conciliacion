import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { presupuestoService } from '../../services/presupuesto.service'
import { PRESUPUESTO_KEYS } from '../../hooks/usePresupuesto'
import { DataTable } from '../molecules/DataTable'
import type { Column } from '../molecules/DataTable'
import type { SimulacionImpactoCC, SimulacionImpacto } from '../../types/Presupuesto'

const formatMiles = (value: number | null): string => {
    if (value == null) return ''
    return new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 }).format(Math.round(value))
}

interface Props {
    presupuestoId: number
    anioFuente: number
    reglasVersion: number
    centrosCostosExcluidos?: number[]
    onSimulacionReady?: (sim: SimulacionImpacto) => void
}

export const ImpactoPanelReglas = ({ presupuestoId, anioFuente, reglasVersion, centrosCostosExcluidos, onSimulacionReady }: Props) => {
    const { data: simulacion, isLoading, isError, error } = useQuery({
        queryKey: PRESUPUESTO_KEYS.simulacion(presupuestoId, reglasVersion),
        queryFn: async () => {
            const result = await presupuestoService.simularReglas(presupuestoId, {
                anio_fuente: anioFuente,
                centros_costos_excluidos: centrosCostosExcluidos,
            })
            onSimulacionReady?.(result)
            return result
        },
        staleTime: 0,
        enabled: !!presupuestoId,
    })

    const columns = useMemo<Column<SimulacionImpactoCC>[]>(() => [
        {
            key: 'cc',
            header: 'Centro de Costo',
            sortable: true,
            sortValue: (r) => r.cc_nombre,
            accessor: (r) => <span className="text-sm font-medium">{r.cc_nombre}</span>,
        },
        {
            key: 'actual',
            header: 'Actual',
            sortable: true,
            sortValue: (r) => r.actual,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm',
            accessor: (r) => formatMiles(r.actual),
        },
        {
            key: 'proyectado',
            header: 'Proyectado',
            sortable: true,
            sortValue: (r) => r.proyectado,
            align: 'right' as const,
            cellClassName: 'font-mono text-sm',
            accessor: (r) => formatMiles(r.proyectado),
        },
        {
            key: 'diferencia',
            header: 'Dif $',
            sortable: true,
            sortValue: (r) => Math.abs(r.diferencia),
            align: 'right' as const,
            cellClassName: 'font-mono text-sm',
            accessor: (r) => {
                const color = r.diferencia > 0 ? 'text-rose-600' : r.diferencia < 0 ? 'text-emerald-600' : 'text-slate-500'
                const prefix = r.diferencia > 0 ? '+' : ''
                return <span className={color}>{prefix}{formatMiles(r.diferencia)}</span>
            },
        },
        {
            key: 'diferencia_pct',
            header: '%',
            sortable: true,
            sortValue: (r) => Math.abs(r.diferencia_pct),
            align: 'right' as const,
            cellClassName: 'font-mono text-xs',
            accessor: (r) => {
                const color = r.diferencia_pct > 0 ? 'text-rose-600' : r.diferencia_pct < 0 ? 'text-emerald-600' : 'text-slate-500'
                const prefix = r.diferencia_pct > 0 ? '+' : ''
                return <span className={color}>{prefix}{r.diferencia_pct}%</span>
            },
        },
    ], [])

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow p-6 flex flex-col items-center justify-center min-h-[200px]">
                <Loader2 className="animate-spin text-blue-500 mb-2" size={28} />
                <p className="text-sm text-slate-500">Simulando impacto...</p>
            </div>
        )
    }

    if (isError) {
        return (
            <div className="bg-white rounded-xl shadow p-6">
                <div className="flex items-center gap-2 text-amber-600 mb-2">
                    <AlertTriangle size={18} />
                    <span className="font-medium text-sm">Error al simular</span>
                </div>
                <p className="text-xs text-slate-500">{(error as Error)?.message}</p>
            </div>
        )
    }

    if (!simulacion) return null

    return (
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-slate-800">Impacto en Presupuesto</h3>
                    <p className="text-xs text-slate-500">{simulacion.presupuesto_nombre} ({simulacion.anio})</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider
                    ${simulacion.presupuesto_estado === 'activo' ? 'bg-green-100 text-green-700' :
                      simulacion.presupuesto_estado === 'borrador' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-slate-100 text-slate-600'}`}>
                    {simulacion.presupuesto_estado}
                </span>
            </div>

            {simulacion.error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-amber-50 text-amber-700">
                    <AlertTriangle size={14} />
                    <span>{simulacion.error}</span>
                </div>
            )}

            {simulacion.detalle_por_cc.length > 0 && (
                <DataTable<SimulacionImpactoCC>
                    data={simulacion.detalle_por_cc}
                    columns={columns}
                    emptyMessage="Sin datos"
                    getRowKey={(r) => r.cc_id}
                    defaultSortKey="proyectado"
                    defaultSortDirection="desc"
                    rowPy="py-1.5"
                />
            )}
        </div>
    )
}
