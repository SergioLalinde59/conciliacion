import { useMemo } from 'react'
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine
} from 'recharts'
import { useFormatCurrency } from '../../atoms/CurrencyDisplay'
import { formatCompact } from '../../../utils/formatters'
import type { FlujoCajaMes } from '../../../services/dashboard.service'
import type { ResumenMensualPresupuesto } from '../../../types/Presupuesto'

interface DashboardCashFlowChartProps {
    data: FlujoCajaMes[]
    presupuestoMensual?: ResumenMensualPresupuesto[]
    isLoading?: boolean
    compact?: boolean
}

const MONTH_NAMES: Record<string, string> = {
    '01': 'Ene', '02': 'Feb', '03': 'Mar', '04': 'Abr',
    '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Ago',
    '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dic',
}

const SERIES_COLORS: Record<string, string> = {
    Presupuesto: '#94a3b8',
    Ingresos: '#93c5fd',
    Egresos: '#1e40af',
    'Flujo Neto': '#6366f1',
}

const SERIES_ORDER = ['Presupuesto', 'Ingresos', 'Egresos', 'Flujo Neto']

export const DashboardCashFlowChart = ({ data, presupuestoMensual, isLoading, compact = false }: DashboardCashFlowChartProps) => {
    const formatCurrency = useFormatCurrency()

    const chartData = useMemo(() => {
        if (!data?.length) return []

        // Build a map of presupuesto by month number
        const pptoMap = new Map<number, number>()
        presupuestoMensual?.forEach(p => {
            pptoMap.set(p.mes, p.presupuestado)
        })

        return [...data].sort((a, b) => a.mes.localeCompare(b.mes)).map(item => {
            const monthPart = item.mes.split('-')[1]
            const monthNum = parseInt(monthPart, 10)
            const shortName = MONTH_NAMES[monthPart] || monthPart

            return {
                name: shortName,
                mes: item.mes,
                Ingresos: item.ingresos,
                Egresos: item.egresos,
                'Flujo Neto': item.saldo,
                Presupuesto: pptoMap.get(monthNum) ?? null,
            }
        })
    }, [data, presupuestoMensual])

    if (isLoading) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <div className="h-5 bg-gray-200 rounded w-48 mb-4 animate-pulse" />
                <div className="h-72 bg-gray-50 rounded-lg animate-pulse" />
            </div>
        )
    }

    if (chartData.length === 0) {
        return (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="font-bold text-slate-800 mb-4">Flujo de Caja Mensual</h3>
                <div className="h-64 flex items-center justify-center text-gray-400">No hay datos para mostrar</div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="font-bold text-slate-800 mb-4">Flujo de Caja Mensual</h3>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis
                            dataKey="name"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 12, fill: '#94a3b8' }}
                        />
                        <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            tickFormatter={(v) => `$${(v / 1000000).toFixed(1)}M`}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const items = SERIES_ORDER
                                    .map(name => payload.find((p: any) => p.dataKey === name))
                                    .filter((p): p is any => p != null && p.value != null)
                                return (
                                    <div style={{
                                        background: 'white',
                                        borderRadius: 12,
                                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                                        padding: '10px 14px',
                                        fontSize: 12,
                                    }}>
                                        <div style={{ fontWeight: 600, marginBottom: 6, color: '#334155' }}>{label}</div>
                                        <table style={{ borderSpacing: 0 }}>
                                            <tbody>
                                                {items.map((item: any) => {
                                                    const val = Number(item.value ?? 0)
                                                    const isNeg = val < 0
                                                    const formatted = compact
                                                        ? formatCompact(Math.abs(val))
                                                        : formatCurrency(Math.abs(val), 'COP', false)
                                                    return (
                                                        <tr key={item.dataKey}>
                                                            <td style={{ paddingRight: 10, color: SERIES_COLORS[item.dataKey] || '#64748b' }}>
                                                                {item.dataKey}
                                                            </td>
                                                            <td style={{ textAlign: 'right', paddingLeft: 4, color: SERIES_COLORS[item.dataKey] || '#64748b' }}>
                                                                {compact
                                                                    ? <>{isNeg ? '-' : '\u00A0'}{formatted}</>
                                                                    : <>{isNeg ? '-' : '\u00A0'}$ {formatted}</>}
                                                            </td>
                                                        </tr>
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )
                            }}
                        />
                        <Legend
                            wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                            content={({ payload }: any) => {
                                const order = ['Presupuesto', 'Ingresos', 'Egresos', 'Flujo Neto']
                                const sorted = order
                                    .map(name => payload?.find((p: any) => p.value === name))
                                    .filter(Boolean)
                                return (
                                    <div className="flex items-center justify-center gap-4 pt-2">
                                        {sorted.map((entry: any) => (
                                            <span key={entry.value} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                                <span
                                                    className="inline-block w-3 h-3 rounded-sm"
                                                    style={{ backgroundColor: entry.color }}
                                                />
                                                {entry.value}
                                            </span>
                                        ))}
                                    </div>
                                )
                            }}
                        />
                        <ReferenceLine y={0} stroke="#cbd5e1" strokeDasharray="3 3" />
                        {presupuestoMensual && presupuestoMensual.length > 0 && (
                            <Line
                                type="monotone"
                                dataKey="Presupuesto"
                                stroke="#94a3b8"
                                strokeWidth={2}
                                strokeDasharray="6 3"
                                dot={false}
                                connectNulls
                            />
                        )}
                        <Line
                            type="monotone"
                            dataKey="Flujo Neto"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={{ fill: '#6366f1', r: 4 }}
                            activeDot={{ r: 6 }}
                        />
                        <Bar dataKey="Ingresos" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={20} />
                        <Bar dataKey="Egresos" fill="#1e40af" radius={[4, 4, 0, 0]} barSize={20} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
