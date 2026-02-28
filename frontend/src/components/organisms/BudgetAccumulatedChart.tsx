import { useMemo } from 'react'
import {
    ComposedChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { useFormatCurrency } from '../atoms/CurrencyDisplay'
import { formatCompact } from '../../utils/formatters'
import type { ResumenMensualPresupuesto } from '../../types/Presupuesto'

interface BudgetAccumulatedChartProps {
    dataEgreso: ResumenMensualPresupuesto[]
    dataIngreso: ResumenMensualPresupuesto[]
    semaforoVerde?: number
    semaforoAmarillo?: number
    compact?: boolean
}

const MESES_CORTOS = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

const SERIES_ORDER = ['Acum Ppto Ing', 'Acum Ejec Ing', 'Acum Ppto Egr', 'Acum Ejec Egr', 'Acum Ppto Neto', 'Acum Neto']

const SERIES_DISPLAY: Record<string, string> = {
    'Acum Ppto Ing': 'Ppto Ing',
    'Acum Ppto Egr': 'Ppto Egr',
    'Acum Ejec Ing': 'Ejec Ing',
    'Acum Ejec Egr': 'Ejec Egr',
    'Acum Ppto Neto': 'Ppto Neto',
    'Acum Neto': 'Neto',
}

const SEMAFORO_COLORS = {
    verde: '#10b981',
    amarillo: '#f59e0b',
    rojo: '#ef4444',
} as const

interface AccumChartPoint {
    name: string
    mes: number
    'Acum Ppto Ing': number
    'Acum Ppto Egr': number
    'Acum Ppto Neto': number
    'Acum Ejec Ing': number | null
    'Acum Ejec Egr': number | null
    'Acum Neto': number | null
    // Monthly values for tooltip
    pptoIng: number
    pptoEgr: number
    ejecIng: number
    ejecEgr: number
    varIng: number
    varEgr: number
    consumoIngPct: number
    consumoEgrPct: number
    semaforoIng: 'verde' | 'amarillo' | 'rojo'
    semaforoEgr: 'verde' | 'amarillo' | 'rojo'
    hasExecution: boolean
    // Accumulated values for tooltip
    acumPptoIng: number
    acumPptoEgr: number
    acumEjecIng: number
    acumEjecEgr: number
    pptoAnualIng: number
    pptoAnualEgr: number
}

const SemaforoDotIng = (props: any) => {
    const { cx, cy, payload } = props
    if (cx == null || cy == null || !payload?.hasExecution) return null
    const color = SEMAFORO_COLORS[payload.semaforoIng as keyof typeof SEMAFORO_COLORS] || SEMAFORO_COLORS.verde
    return <circle cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />
}

const SemaforoDotEgr = (props: any) => {
    const { cx, cy, payload } = props
    if (cx == null || cy == null || !payload?.hasExecution) return null
    const color = SEMAFORO_COLORS[payload.semaforoEgr as keyof typeof SEMAFORO_COLORS] || SEMAFORO_COLORS.verde
    return <circle cx={cx} cy={cy} r={6} fill={color} stroke="white" strokeWidth={2} />
}

export const BudgetAccumulatedChart = ({
    dataEgreso,
    dataIngreso,
    compact = false,
}: BudgetAccumulatedChartProps) => {
    const formatCurrency = useFormatCurrency()

    const chartData = useMemo((): AccumChartPoint[] => {
        // Use all 12 months for full projection
        const allMeses = new Set<number>()
        for (let m = 1; m <= 12; m++) allMeses.add(m)
        dataEgreso.forEach(r => allMeses.add(r.mes))
        dataIngreso.forEach(r => allMeses.add(r.mes))

        const egrMap = new Map(dataEgreso.map(r => [r.mes, r]))
        const ingMap = new Map(dataIngreso.map(r => [r.mes, r]))

        const pptoAnualIng = dataIngreso.reduce((s, r) => s + r.presupuestado, 0)
        const pptoAnualEgr = dataEgreso.reduce((s, r) => s + r.presupuestado, 0)

        // Find last month with execution
        const lastExecMonth = Math.max(
            ...dataIngreso.filter(r => r.ejecutado > 0).map(r => r.mes),
            ...dataEgreso.filter(r => r.ejecutado > 0).map(r => r.mes),
            0
        )

        let acumPptoIng = 0
        let acumPptoEgr = 0
        let acumEjecIng = 0
        let acumEjecEgr = 0

        return Array.from(allMeses).sort((a, b) => a - b).map(m => {
            const egr = egrMap.get(m)
            const ing = ingMap.get(m)
            const hasExecution = m <= lastExecMonth

            acumPptoIng += ing?.presupuestado ?? 0
            acumPptoEgr += egr?.presupuestado ?? 0

            if (hasExecution) {
                acumEjecIng += ing?.ejecutado ?? 0
                acumEjecEgr += egr?.ejecutado ?? 0
            }

            const consumoIngPct = (ing?.presupuestado ?? 0) > 0
                ? ((ing?.ejecutado ?? 0) / ing!.presupuestado * 100) : 0
            const consumoEgrPct = (egr?.presupuestado ?? 0) > 0
                ? ((egr?.ejecutado ?? 0) / egr!.presupuestado * 100) : 0

            return {
                name: MESES_CORTOS[m] || `M${m}`,
                mes: m,
                'Acum Ppto Ing': acumPptoIng,
                'Acum Ppto Egr': acumPptoEgr,
                'Acum Ppto Neto': acumPptoIng - acumPptoEgr,
                'Acum Ejec Ing': hasExecution ? acumEjecIng : null,
                'Acum Ejec Egr': hasExecution ? acumEjecEgr : null,
                'Acum Neto': hasExecution ? (acumEjecIng - acumEjecEgr) : null,
                pptoIng: ing?.presupuestado ?? 0,
                pptoEgr: egr?.presupuestado ?? 0,
                ejecIng: ing?.ejecutado ?? 0,
                ejecEgr: egr?.ejecutado ?? 0,
                varIng: ing?.variacion ?? 0,
                varEgr: egr?.variacion ?? 0,
                consumoIngPct,
                consumoEgrPct,
                semaforoIng: ing?.semaforo ?? 'verde',
                semaforoEgr: egr?.semaforo ?? 'verde',
                hasExecution,
                acumPptoIng,
                acumPptoEgr,
                acumEjecIng,
                acumEjecEgr,
                pptoAnualIng,
                pptoAnualEgr,
            }
        })
    }, [dataEgreso, dataIngreso])

    if (chartData.length === 0) {
        return (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <h3 className="font-bold text-slate-800 mb-4 text-sm">Trayectoria Acumulada — Presupuesto vs Ejecución</h3>
                <div className="h-64 flex items-center justify-center text-gray-400">No hay datos para mostrar</div>
            </div>
        )
    }

    const fmtVal = (v: number) => {
        if (compact) return formatCompact(v)
        return formatCurrency(Math.abs(v), 'COP', false)
    }

    const fmtSigned = (v: number) => {
        const sign = v > 0 ? '+' : v < 0 ? '-' : ''
        const formatted = compact ? formatCompact(Math.abs(v)) : `$ ${formatCurrency(Math.abs(v), 'COP', false)}`
        return `${sign}${formatted}`
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
            <h3 className="font-bold text-slate-800 mb-2 text-sm">Trayectoria Acumulada — Presupuesto vs Ejecución</h3>
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
                            tickFormatter={(v) => {
                                const abs = Math.abs(v)
                                const sign = v < 0 ? '-' : ''
                                if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`
                                if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000)}K`
                                return `${sign}$${Math.round(abs)}`
                            }}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                const d = payload[0]?.payload as AccumChartPoint | undefined
                                if (!d) return null

                                return (
                                    <div style={{
                                        background: 'white',
                                        borderRadius: 12,
                                        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                                        padding: '12px 16px',
                                        fontSize: 12,
                                        minWidth: 300,
                                    }}>
                                        <div style={{ fontWeight: 700, marginBottom: 8, color: '#0f172a', fontSize: 13 }}>{label}</div>

                                        {d.hasExecution && (
                                            <>
                                                {/* Monthly breakdown */}
                                                <table style={{ borderSpacing: 0, width: '100%' }}>
                                                    <thead>
                                                        <tr style={{ color: '#94a3b8', fontSize: 10, textTransform: 'uppercase' as const }}>
                                                            <th style={{ textAlign: 'left', paddingBottom: 4 }}></th>
                                                            <th style={{ textAlign: 'right', paddingBottom: 4 }}>Ppto</th>
                                                            <th style={{ textAlign: 'right', paddingBottom: 4 }}>Ejec</th>
                                                            <th style={{ textAlign: 'right', paddingBottom: 4 }}>Var</th>
                                                            <th style={{ textAlign: 'right', paddingBottom: 4 }}>Cons%</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        <tr>
                                                            <td style={{ color: '#10b981', fontWeight: 600, paddingRight: 8 }}>Ing</td>
                                                            <td style={{ textAlign: 'right', color: '#64748b' }}>{fmtVal(d.pptoIng)}</td>
                                                            <td style={{ textAlign: 'right', color: '#10b981', fontWeight: 600 }}>{fmtVal(d.ejecIng)}</td>
                                                            <td style={{ textAlign: 'right', color: d.varIng >= 0 ? '#10b981' : '#ef4444' }}>{fmtSigned(d.varIng)}</td>
                                                            <td style={{ textAlign: 'right', color: SEMAFORO_COLORS[d.semaforoIng], fontWeight: 700 }}>{d.consumoIngPct.toFixed(1)}%</td>
                                                        </tr>
                                                        <tr>
                                                            <td style={{ color: '#e11d48', fontWeight: 600, paddingRight: 8 }}>Egr</td>
                                                            <td style={{ textAlign: 'right', color: '#64748b' }}>{fmtVal(d.pptoEgr)}</td>
                                                            <td style={{ textAlign: 'right', color: '#e11d48', fontWeight: 600 }}>{fmtVal(d.ejecEgr)}</td>
                                                            <td style={{ textAlign: 'right', color: d.varEgr <= 0 ? '#10b981' : '#ef4444' }}>{fmtSigned(d.varEgr)}</td>
                                                            <td style={{ textAlign: 'right', color: SEMAFORO_COLORS[d.semaforoEgr], fontWeight: 700 }}>{d.consumoEgrPct.toFixed(1)}%</td>
                                                        </tr>
                                                        <tr style={{ borderTop: '1px solid #e2e8f0' }}>
                                                            <td style={{ color: '#6366f1', fontWeight: 600, paddingRight: 8, paddingTop: 4 }}>Neto</td>
                                                            <td style={{ textAlign: 'right', color: '#64748b', paddingTop: 4 }}>{fmtSigned(d.pptoIng - d.pptoEgr)}</td>
                                                            <td style={{ textAlign: 'right', color: '#6366f1', fontWeight: 600, paddingTop: 4 }}>{fmtSigned(d.ejecIng - d.ejecEgr)}</td>
                                                            <td style={{ textAlign: 'right', color: '#64748b', paddingTop: 4 }}>{fmtSigned((d.ejecIng - d.ejecEgr) - (d.pptoIng - d.pptoEgr))}</td>
                                                            <td></td>
                                                        </tr>
                                                    </tbody>
                                                </table>

                                                {/* Accumulated section */}
                                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e2e8f0' }}>
                                                    <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' as const, marginBottom: 4 }}>Acumulado</div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#10b981' }}>Ing: {fmtVal(d.acumEjecIng)} de {fmtVal(d.acumPptoIng)}</span>
                                                            <span style={{ color: '#10b981', fontWeight: 700 }}>
                                                                {d.pptoAnualIng > 0 ? `${(d.acumEjecIng / d.pptoAnualIng * 100).toFixed(1)}%` : '—'}
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                            <span style={{ color: '#e11d48' }}>Egr: {fmtVal(d.acumEjecEgr)} de {fmtVal(d.acumPptoEgr)}</span>
                                                            <span style={{ color: '#e11d48', fontWeight: 700 }}>
                                                                {d.pptoAnualEgr > 0 ? `${(d.acumEjecEgr / d.pptoAnualEgr * 100).toFixed(1)}%` : '—'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </>
                                        )}

                                        {!d.hasExecution && (
                                            <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
                                                <div>Ppto Ing: {fmtVal(d.acumPptoIng)}</div>
                                                <div>Ppto Egr: {fmtVal(d.acumPptoEgr)}</div>
                                                <div style={{ marginTop: 4, fontSize: 11 }}>Sin ejecución</div>
                                            </div>
                                        )}
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
                                            const displayName = SERIES_DISPLAY[entry.value] || entry.value
                                            const isDashed = entry.value === 'Acum Ppto Ing' || entry.value === 'Acum Ppto Egr' || entry.value === 'Acum Ppto Neto'
                                            return (
                                                <span key={entry.value} className="flex items-center gap-1.5 text-[11px] text-slate-500">
                                                    {isDashed ? (
                                                        <svg width="12" height="12" viewBox="0 0 12 12">
                                                            <line x1="0" y1="6" x2="12" y2="6" stroke={entry.color} strokeWidth="2" strokeDasharray="3 2" />
                                                        </svg>
                                                    ) : (
                                                        <span
                                                            className="inline-block w-3 h-3 rounded-full"
                                                            style={{ backgroundColor: entry.color }}
                                                        />
                                                    )}
                                                    {displayName}
                                                </span>
                                            )
                                        })}
                                    </div>
                                )
                            }}
                        />

                        {/* Budget projection lines (dashed, full year) */}
                        <Line
                            type="monotone"
                            dataKey="Acum Ppto Ing"
                            stroke="#6ee7b7"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={false}
                            connectNulls
                        />
                        <Line
                            type="monotone"
                            dataKey="Acum Ppto Egr"
                            stroke="#fda4af"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={false}
                            connectNulls
                        />

                        {/* Actual execution lines (solid, stop at last execution month) */}
                        <Line
                            type="monotone"
                            dataKey="Acum Ejec Ing"
                            stroke="#10b981"
                            strokeWidth={2.5}
                            dot={<SemaforoDotIng />}
                            activeDot={{ r: 8, stroke: '#10b981', strokeWidth: 2, fill: 'white' }}
                            connectNulls={false}
                        />
                        <Line
                            type="monotone"
                            dataKey="Acum Ejec Egr"
                            stroke="#e11d48"
                            strokeWidth={2.5}
                            dot={<SemaforoDotEgr />}
                            activeDot={{ r: 8, stroke: '#e11d48', strokeWidth: 2, fill: 'white' }}
                            connectNulls={false}
                        />

                        {/* Budget net projection (dashed) */}
                        <Line
                            type="monotone"
                            dataKey="Acum Ppto Neto"
                            stroke="#a5b4fc"
                            strokeWidth={2}
                            strokeDasharray="6 3"
                            dot={false}
                            connectNulls
                        />

                        {/* Actual net cumulative line */}
                        <Line
                            type="monotone"
                            dataKey="Acum Neto"
                            stroke="#6366f1"
                            strokeWidth={2}
                            dot={{ fill: '#6366f1', r: 3 }}
                            activeDot={{ r: 6 }}
                            connectNulls={false}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
