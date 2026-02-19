import { useMemo } from 'react'
import {
    ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell
} from 'recharts'
import { useFormatCurrency } from '../atoms/CurrencyDisplay'
import { formatCompact } from '../../utils/formatters'
import type { ResumenMensualPresupuesto } from '../../types/Presupuesto'

interface EjecucionMensualChartProps {
    mensualEgreso: ResumenMensualPresupuesto[]
    mensualIngreso: ResumenMensualPresupuesto[]
    compact?: boolean
}

const MESES_CORTOS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const SEMAFORO_COLORS: Record<string, string> = {
    verde: '#0d9488',   // teal-600 (distinto del emerald de ingresos)
    amarillo: '#f59e0b',
    rojo: '#ef4444',
}

const SERIES_COLORS: Record<string, string> = {
    'Real Ing': '#10b981',
    'Real Egr': '#64748b',
    'Ppto Ing': '#6ee7b7',
    'Ppto Egr': '#94a3b8',
    'Flujo Neto': '#6366f1',
    'Acum Egr %': '#a78bfa',
}

const SERIES_ORDER = ['Real Ing', 'Ppto Ing', 'Real Egr', 'Ppto Egr', 'Flujo Neto', 'Acum Egr %']

interface ChartPoint {
    name: string
    mes: number
    'Real Ing': number
    'Real Egr': number
    'Ppto Ing': number
    'Ppto Egr': number
    'Flujo Neto': number
    'Acum Egr %': number
    semaforoEgr: 'verde' | 'amarillo' | 'rojo'
}

export const EjecucionMensualChart = ({ mensualEgreso, mensualIngreso, compact = false }: EjecucionMensualChartProps) => {
    const formatCurrency = useFormatCurrency()

    const chartData = useMemo((): ChartPoint[] => {
        const allMeses = new Set<number>()
        mensualEgreso.forEach(r => allMeses.add(r.mes))
        mensualIngreso.forEach(r => allMeses.add(r.mes))

        if (allMeses.size === 0) return []

        const egrMap = new Map(mensualEgreso.map(r => [r.mes, r]))
        const ingMap = new Map(mensualIngreso.map(r => [r.mes, r]))
        const pptoAnualEgr = mensualEgreso.reduce((s, r) => s + r.presupuestado, 0)

        let acumEgr = 0

        return Array.from(allMeses).sort((a, b) => a - b).map(m => {
            const egr = egrMap.get(m)
            const ing = ingMap.get(m)
            acumEgr += egr?.ejecutado ?? 0
            return {
                name: MESES_CORTOS[m] || `M${m}`,
                mes: m,
                'Real Ing': ing?.ejecutado ?? 0,
                'Real Egr': egr?.ejecutado ?? 0,
                'Ppto Ing': ing?.presupuestado ?? 0,
                'Ppto Egr': egr?.presupuestado ?? 0,
                'Flujo Neto': (ing?.ejecutado ?? 0) - (egr?.ejecutado ?? 0),
                'Acum Egr %': pptoAnualEgr > 0 ? (acumEgr / pptoAnualEgr) * 100 : 0,
                semaforoEgr: egr?.semaforo ?? 'verde',
            }
        })
    }, [mensualEgreso, mensualIngreso])

    const hasPptoIng = mensualIngreso.some(r => r.presupuestado > 0)
    const hasPptoEgr = mensualEgreso.some(r => r.presupuestado > 0)

    if (chartData.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4 text-sm">Ejecución Mensual — Ingresos vs Egresos</h3>
                <div className="h-64 flex items-center justify-center text-gray-400">No hay datos para mostrar</div>
            </div>
        )
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-2 text-sm">Ejecución Mensual — Ingresos vs Egresos</h3>
            <div className="h-72 w-full">
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
                            yAxisId="left"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#94a3b8' }}
                            tickFormatter={(v) => {
                                const abs = Math.abs(v)
                                const sign = v < 0 ? '-' : ''
                                if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
                                if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`
                                return `${sign}$${Math.round(abs)}`
                            }}
                        />
                        <YAxis
                            yAxisId="right"
                            orientation="right"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: '#a78bfa' }}
                            tickFormatter={(v) => `${Math.round(v)}%`}
                            domain={[0, 'auto']}
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
                                                    const isAcum = item.dataKey === 'Acum Egr %'
                                                    const point = chartData.find(d => d.name === label)
                                                    let color = SERIES_COLORS[item.dataKey] || '#64748b'
                                                    if (item.dataKey === 'Real Egr' && point) {
                                                        color = SEMAFORO_COLORS[point.semaforoEgr]
                                                    }

                                                    if (isAcum) {
                                                        return (
                                                            <tr key={item.dataKey}>
                                                                <td style={{ paddingRight: 10, color }}>{item.dataKey}</td>
                                                                <td style={{ textAlign: 'right', paddingLeft: 4, color, fontWeight: 600 }}>
                                                                    {val.toFixed(1)}%
                                                                </td>
                                                            </tr>
                                                        )
                                                    }

                                                    const formatted = compact
                                                        ? formatCompact(Math.abs(val))
                                                        : formatCurrency(Math.abs(val), 'COP', false)
                                                    return (
                                                        <tr key={item.dataKey}>
                                                            <td style={{ paddingRight: 10, color }}>
                                                                {item.dataKey}
                                                            </td>
                                                            <td style={{
                                                                textAlign: 'right',
                                                                paddingLeft: 4,
                                                                fontWeight: item.dataKey === 'Flujo Neto' ? 700 : 400,
                                                                color: item.dataKey === 'Flujo Neto'
                                                                    ? (val >= 0 ? '#10b981' : '#f43f5e')
                                                                    : color,
                                                            }}>
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
                                const sorted = SERIES_ORDER
                                    .map(name => payload?.find((p: any) => p.value === name))
                                    .filter(Boolean)
                                return (
                                    <div className="flex items-center justify-center gap-4 pt-2">
                                        {sorted.map((entry: any) => {
                                            if (entry.value === 'Real Egr') {
                                                return (
                                                    <span key={entry.value} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                                        <span className="flex gap-px">
                                                            <span className="inline-block w-1.5 h-3 rounded-l-sm" style={{ backgroundColor: '#0d9488' }} />
                                                            <span className="inline-block w-1.5 h-3" style={{ backgroundColor: '#f59e0b' }} />
                                                            <span className="inline-block w-1.5 h-3 rounded-r-sm" style={{ backgroundColor: '#ef4444' }} />
                                                        </span>
                                                        Egreso (semáforo)
                                                    </span>
                                                )
                                            }
                                            return (
                                                <span key={entry.value} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                                    <span
                                                        className="inline-block w-3 h-3 rounded-sm"
                                                        style={{ backgroundColor: entry.color }}
                                                    />
                                                    {entry.value}
                                                </span>
                                            )
                                        })}
                                    </div>
                                )
                            }}
                        />
                        <ReferenceLine yAxisId="left" y={0} stroke="#cbd5e1" strokeDasharray="3 3" />

                        {/* Dashed lines for budget targets */}
                        {hasPptoIng && (
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="Ppto Ing"
                                stroke="#6ee7b7"
                                strokeWidth={2}
                                strokeDasharray="6 3"
                                dot={false}
                                connectNulls
                            />
                        )}
                        {hasPptoEgr && (
                            <Line
                                yAxisId="left"
                                type="monotone"
                                dataKey="Ppto Egr"
                                stroke="#94a3b8"
                                strokeWidth={2}
                                strokeDasharray="6 3"
                                dot={false}
                                connectNulls
                            />
                        )}

                        {/* Actual bars */}
                        <Bar yAxisId="left" dataKey="Real Ing" fill="#10b981" radius={[3, 3, 0, 0]} barSize={20} />
                        <Bar yAxisId="left" dataKey="Real Egr" radius={[3, 3, 0, 0]} barSize={20}>
                            {chartData.map((entry, idx) => (
                                <Cell key={idx} fill={SEMAFORO_COLORS[entry.semaforoEgr]} />
                            ))}
                        </Bar>

                        {/* Net flow line */}
                        <Line
                            yAxisId="left"
                            type="monotone"
                            dataKey="Flujo Neto"
                            stroke="#6366f1"
                            strokeWidth={2.5}
                            dot={{ fill: '#6366f1', r: 4 }}
                            activeDot={{ r: 6 }}
                        />

                        {/* Cumulative egress % (right axis) */}
                        <Line
                            yAxisId="right"
                            type="monotone"
                            dataKey="Acum Egr %"
                            stroke="#a78bfa"
                            strokeWidth={2}
                            dot={{ fill: '#a78bfa', r: 3 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
