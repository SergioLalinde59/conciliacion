import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '../../molecules/Modal'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { Button } from '../../atoms/Button'
import { Loader2, TrendingUp, TrendingDown, Link2, FileText, Database, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import { API_BASE_URL } from '../../../services/httpClient'
import { formatFecha } from '../../atoms/FechaDisplay'

// ============ TYPES ============

type PreviewOption = 'conciliacion' | 'vinculaciones' | 'extracto' | 'sistema'

interface PreviewDataModalProps {
    isOpen: boolean
    onClose: () => void
    cuentaId: number
    cuentaNombre: string
    fechaDesde: string  // YYYY-MM-DD
    fechaHasta: string  // YYYY-MM-DD
    /** Datos del preview ya cargado (para vista conciliación) */
    previewCuenta?: {
        ingresos: number
        egresos: number
        conciliaciones: number
        vinculaciones: number
        extractos: number
        movimientos_detalle: number
        movimientos_encabezado: number
        movimientos_sistema?: number
    }
}

interface MovimientoExtracto {
    id: number
    fecha: string
    descripcion: string
    referencia: string | null
    valor: number
    usd?: number | null
}

interface MovimientoMatch {
    id: number | null
    mov_extracto: {
        id: number
        fecha: string
        descripcion: string
        valor: number
        usd?: number | null
    }
    mov_sistema: {
        id: number
        fecha: string
        descripcion: string
        valor: number
        usd?: number | null
    } | null
    estado: string
    score_total: number
}

interface MovimientoSistema {
    id: number
    fecha: string
    descripcion: string
    referencia: string | null
    valor: number
    usd?: number | null
    tercero_nombre: string | null
    centro_costo_nombre: string | null
    concepto_nombre: string | null
    detalles?: Array<{
        id: number
        valor: number
        usd?: number | null
        tercero_nombre: string | null
        centro_costo_nombre: string | null
        concepto_nombre: string | null
    }>
}

// Fila aplanada para mostrar en tabla
interface MovimientoSistemaFlat {
    id: number
    fecha: string
    descripcion: string
    referencia: string | null
    valor: number
    usd?: number | null
    tercero_nombre: string | null
    centro_costo_nombre: string | null
    concepto_nombre: string | null
    esDetalle: boolean
    parentId?: number
}

// ============ CONSTANTS ============

const PREVIEW_OPTIONS: { value: PreviewOption; label: string; icon: React.ElementType }[] = [
    { value: 'conciliacion', label: 'Conciliación', icon: Database },
    { value: 'vinculaciones', label: 'Vinculaciones', icon: Link2 },
    { value: 'extracto', label: 'Mov. Extracto', icon: FileText },
    { value: 'sistema', label: 'Mov. Sistema', icon: TrendingUp },
]

const ESTADO_CONFIG: Record<string, { color: string; icon: React.ElementType; label: string }> = {
    'OK': { color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, label: 'OK' },
    'PROBABLE': { color: 'bg-amber-100 text-amber-700', icon: AlertTriangle, label: 'Probable' },
    'SIN_MATCH': { color: 'bg-red-100 text-red-700', icon: XCircle, label: 'Sin Match' },
    'MANUAL': { color: 'bg-blue-100 text-blue-700', icon: CheckCircle, label: 'Manual' },
    'IGNORADO': { color: 'bg-gray-100 text-gray-500', icon: HelpCircle, label: 'Ignorado' },
}

// ============ HELPER FUNCTIONS ============

const formatDate = (dateStr: string): string => {
    return formatFecha(dateStr, { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const extractYearMonth = (dateStr: string): { year: number; month: number } => {
    const [year, month] = dateStr.split('-').map(Number)
    return { year, month }
}

/** Para cuentas USD, usa el campo usd si existe; sino cae a valor */
const getValor = (mov: { valor: number; usd?: number | null }, esUSD: boolean): number =>
    esUSD ? (mov.usd ?? mov.valor) : mov.valor

// Aplanar movimientos del sistema con sus detalles
const flattenMovimientos = (movimientos: MovimientoSistema[]): MovimientoSistemaFlat[] => {
    const result: MovimientoSistemaFlat[] = []

    for (const mov of movimientos) {
        // Si tiene detalles, agregar cada detalle como fila
        if (mov.detalles && mov.detalles.length > 0) {
            const numDetalles = mov.detalles.length
            for (const det of mov.detalles) {
                // Propagar usd del encabezado a detalles que no lo tienen
                let detUsd = det.usd
                if (detUsd == null && mov.usd != null) {
                    if (numDetalles === 1) {
                        detUsd = mov.usd
                    } else if (mov.valor !== 0) {
                        detUsd = mov.usd * (det.valor / mov.valor)
                    } else {
                        detUsd = mov.usd / numDetalles
                    }
                }
                result.push({
                    id: det.id,
                    fecha: mov.fecha,
                    descripcion: mov.descripcion,
                    referencia: mov.referencia,
                    valor: det.valor,
                    usd: detUsd,
                    tercero_nombre: det.tercero_nombre || mov.tercero_nombre,
                    centro_costo_nombre: det.centro_costo_nombre || mov.centro_costo_nombre,
                    concepto_nombre: det.concepto_nombre || mov.concepto_nombre,
                    esDetalle: true,
                    parentId: mov.id,
                })
            }
        } else {
            // Si no tiene detalles, agregar el encabezado
            result.push({
                id: mov.id,
                fecha: mov.fecha,
                descripcion: mov.descripcion,
                referencia: mov.referencia,
                valor: mov.valor,
                usd: mov.usd,
                tercero_nombre: mov.tercero_nombre,
                centro_costo_nombre: mov.centro_costo_nombre,
                concepto_nombre: mov.concepto_nombre,
                esDetalle: false,
            })
        }
    }

    return result
}

// ============ SUB-COMPONENTS ============

interface StatsBarProps {
    count: number
    ingresos: number
    egresos: number
    currency: 'COP' | 'USD'
}

const StatsBar: React.FC<StatsBarProps> = ({ count, ingresos, egresos, currency }) => {
    const saldo = ingresos + egresos
    const items = [
        { label: 'Registros', value: <span className="font-bold text-gray-900">{count}</span> },
        { label: 'Ingresos', value: <CurrencyDisplay value={ingresos} currency={currency} className="font-bold text-emerald-600" /> },
        { label: 'Egresos', value: <CurrencyDisplay value={egresos} currency={currency} className="font-bold text-rose-600" /> },
        { label: 'Saldo', value: <CurrencyDisplay value={saldo} currency={currency} colorize className="font-bold" /> },
    ]
    return (
        <div className="flex items-center gap-4">
            {items.map((item) => (
                <div key={item.label} className="text-center px-3 py-1 bg-gray-50 rounded">
                    <div className="text-[10px] uppercase tracking-wider text-gray-400">{item.label}</div>
                    <div className="text-sm">{item.value}</div>
                </div>
            ))}
        </div>
    )
}

const EstadoBadge: React.FC<{ estado: string }> = ({ estado }) => {
    const config = ESTADO_CONFIG[estado] || ESTADO_CONFIG['SIN_MATCH']
    const Icon = config.icon
    return (
        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
            <Icon size={12} />
            {config.label}
        </span>
    )
}

// ============ VIEWS ============

const VistaConciliacion: React.FC<{
    data: PreviewDataModalProps['previewCuenta']
    esUSD: boolean
    matches: MovimientoMatch[]
    loading: boolean
}> = ({ data, esUSD, matches, loading }) => {
    if (!data) return <div className="text-center text-gray-400 py-8">Sin datos</div>

    const saldo = data.ingresos - data.egresos
    const currency = esUSD ? 'USD' : 'COP' as const

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                {/* Tarjeta de registros */}
                <div className="border border-gray-200 rounded-lg p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Registros</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Database size={16} className="text-blue-500" />
                                <span>Conciliaciones</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">{data.conciliaciones}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <Link2 size={16} className="text-purple-500" />
                                <span>Vinculaciones</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">{data.vinculaciones}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <FileText size={16} className="text-amber-500" />
                                <span>Mov. Extracto</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">{data.extractos}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <TrendingUp size={16} className="text-slate-500" />
                                <span>Mov. Sistema</span>
                            </div>
                            <span className="text-lg font-bold text-gray-900">{data.movimientos_sistema ?? (data.movimientos_detalle + data.movimientos_encabezado)}</span>
                        </div>
                    </div>
                </div>

                {/* Tarjeta de valores */}
                <div className="border border-gray-200 rounded-lg p-5">
                    <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Valores</h4>
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <TrendingUp size={16} className="text-emerald-500" />
                                <span>Ingresos</span>
                            </div>
                            <CurrencyDisplay value={data.ingresos} currency={currency} className="text-lg font-bold text-emerald-700" />
                        </div>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-gray-600">
                                <TrendingDown size={16} className="text-rose-500" />
                                <span>Egresos</span>
                            </div>
                            <CurrencyDisplay value={data.egresos} currency={currency} className="text-lg font-bold text-rose-700" />
                        </div>
                        <hr className="border-gray-200" />
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                                <span>Saldo</span>
                            </div>
                            <CurrencyDisplay value={saldo} currency={currency} colorize className="text-lg font-bold" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabla de detalle de vinculaciones */}
            {loading ? (
                <LoadingSpinner />
            ) : matches.length > 0 ? (
                <div className="overflow-x-auto border border-gray-200 rounded-lg">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase">Estado</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Score</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha Ext.</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Descripción Ext.</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Valor Ext.{esUSD ? ' (USD)' : ''}</th>
                                <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha Sist.</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Valor Sist.{esUSD ? ' (USD)' : ''}</th>
                                <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Dif.</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {matches.map((match, idx) => {
                                const valExt = getValor(match.mov_extracto, esUSD)
                                const valSist = match.mov_sistema ? getValor(match.mov_sistema, esUSD) : null
                                return (
                                    <tr key={match.id || idx} className="hover:bg-gray-50">
                                        <td className="px-3 py-2 text-center">
                                            <EstadoBadge estado={match.estado} />
                                        </td>
                                        <td className="px-3 py-2 text-right font-medium">
                                            {Math.round(match.score_total * 100)}%
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap">
                                            {formatDate(match.mov_extracto.fecha)}
                                        </td>
                                        <td className="px-3 py-2 max-w-[200px] truncate" title={match.mov_extracto.descripcion}>
                                            {match.mov_extracto.descripcion}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            <CurrencyDisplay value={valExt} currency={currency} colorize />
                                        </td>
                                        <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                            {match.mov_sistema ? formatDate(match.mov_sistema.fecha) : '-'}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {valSist !== null ? (
                                                <CurrencyDisplay value={valSist} currency={currency} colorize />
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right">
                                            {valSist !== null ? (
                                                <CurrencyDisplay value={valExt - valSist} currency={currency} colorize />
                                            ) : (
                                                <span className="text-gray-400">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            ) : null}
        </div>
    )
}

const VistaExtracto: React.FC<{ data: MovimientoExtracto[]; loading: boolean; esUSD: boolean }> = ({ data, loading, esUSD }) => {
    if (loading) return <LoadingSpinner />
    if (!data.length) return <EmptyState message="No hay movimientos del extracto" />

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase">ID</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Descripción</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Referencia</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">{esUSD ? 'Valor (USD)' : 'Valor'}</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {data.map((mov) => (
                        <tr key={mov.id} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-center text-gray-400">#{mov.id}</td>
                            <td className="px-3 py-2 whitespace-nowrap">{formatDate(mov.fecha)}</td>
                            <td className="px-3 py-2 max-w-xs truncate" title={mov.descripcion}>{mov.descripcion}</td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-500">{mov.referencia || '-'}</td>
                            <td className="px-3 py-2 text-right">
                                <CurrencyDisplay value={getValor(mov, esUSD)} currency={esUSD ? 'USD' : 'COP'} colorize />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const VistaVinculaciones: React.FC<{ data: MovimientoMatch[]; loading: boolean; esUSD: boolean }> = ({ data, loading, esUSD }) => {
    if (loading) return <LoadingSpinner />
    if (!data.length) return <EmptyState message="No hay vinculaciones" />

    const currency = esUSD ? 'USD' : 'COP' as const
    const headerSuffix = esUSD ? ' (USD)' : ''

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase">Estado</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Score</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha Ext.</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Descripción Ext.</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Valor Ext.{headerSuffix}</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha Sist.</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Valor Sist.{headerSuffix}</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Dif.</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {data.map((match, idx) => {
                        const valExt = getValor(match.mov_extracto, esUSD)
                        const valSist = match.mov_sistema ? getValor(match.mov_sistema, esUSD) : null
                        return (
                            <tr key={match.id || idx} className="hover:bg-gray-50">
                                <td className="px-3 py-2 text-center">
                                    <EstadoBadge estado={match.estado} />
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                    {Math.round(match.score_total * 100)}%
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap">
                                    {formatDate(match.mov_extracto.fecha)}
                                </td>
                                <td className="px-3 py-2 max-w-[200px] truncate" title={match.mov_extracto.descripcion}>
                                    {match.mov_extracto.descripcion}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    <CurrencyDisplay value={valExt} currency={currency} colorize />
                                </td>
                                <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                    {match.mov_sistema ? formatDate(match.mov_sistema.fecha) : '-'}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {valSist !== null ? (
                                        <CurrencyDisplay value={valSist} currency={currency} colorize />
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                                <td className="px-3 py-2 text-right">
                                    {valSist !== null ? (
                                        <CurrencyDisplay value={valExt - valSist} currency={currency} colorize />
                                    ) : (
                                        <span className="text-gray-400">-</span>
                                    )}
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}

const VistaSistema: React.FC<{ data: MovimientoSistemaFlat[]; loading: boolean; esUSD: boolean }> = ({ data, loading, esUSD }) => {
    if (loading) return <LoadingSpinner />
    if (!data.length) return <EmptyState message="No hay movimientos del sistema" />

    const currency = esUSD ? 'USD' : 'COP' as const

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Tercero</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">C. Costo</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Concepto</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Referencia</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Descripción</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">{esUSD ? 'Valor (USD)' : 'Valor'}</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {data.map((mov, idx) => (
                        <tr
                            key={`${mov.id}-${idx}`}
                            className={`hover:bg-gray-50 ${mov.esDetalle ? 'bg-slate-50/50' : ''}`}
                        >
                            <td className="px-3 py-2 whitespace-nowrap">
                                {formatDate(mov.fecha)}
                            </td>
                            <td className="px-3 py-2 max-w-[120px] truncate" title={mov.tercero_nombre || ''}>
                                {mov.tercero_nombre || '-'}
                            </td>
                            <td className="px-3 py-2 max-w-[100px] truncate" title={mov.centro_costo_nombre || ''}>
                                {mov.centro_costo_nombre || '-'}
                            </td>
                            <td className="px-3 py-2 max-w-[100px] truncate" title={mov.concepto_nombre || ''}>
                                {mov.concepto_nombre || '-'}
                            </td>
                            <td className="px-3 py-2 font-mono text-xs text-gray-500">
                                {mov.referencia || '-'}
                            </td>
                            <td className="px-3 py-2 max-w-[180px] truncate" title={mov.descripcion}>
                                {mov.descripcion}
                            </td>
                            <td className="px-3 py-2 text-right">
                                <CurrencyDisplay value={getValor(mov, esUSD)} currency={currency} colorize />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const LoadingSpinner: React.FC = () => (
    <div className="flex items-center justify-center py-12 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" />
        <span>Cargando datos...</span>
    </div>
)

const EmptyState: React.FC<{ message: string }> = ({ message }) => (
    <div className="text-center py-12 text-gray-400">
        <Database size={32} className="mx-auto mb-2 opacity-50" />
        <p>{message}</p>
    </div>
)

// ============ MAIN COMPONENT ============

export const PreviewDataModal: React.FC<PreviewDataModalProps> = ({
    isOpen,
    onClose,
    cuentaId,
    cuentaNombre,
    fechaDesde,
    fechaHasta,
    previewCuenta,
}) => {
    const [selectedOption, setSelectedOption] = useState<PreviewOption>('conciliacion')
    const [loading, setLoading] = useState(false)

    // Detectar si es cuenta USD
    const esUSD = cuentaNombre.toUpperCase().includes('USD') || cuentaNombre.toUpperCase().includes('DOLARES')

    // Data states
    const [extractoData, setExtractoData] = useState<MovimientoExtracto[]>([])
    const [vinculacionesData, setVinculacionesData] = useState<MovimientoMatch[]>([])
    const [sistemaData, setSistemaData] = useState<MovimientoSistema[]>([])

    // Aplanar datos del sistema
    const sistemaDataFlat = useMemo(() => flattenMovimientos(sistemaData), [sistemaData])

    // Extraer year/month del rango
    const { year, month } = useMemo(() => extractYearMonth(fechaDesde), [fechaDesde])

    // Fetch data when option changes
    useEffect(() => {
        if (!isOpen) return

        const fetchData = async () => {
            setLoading(true)
            try {
                switch (selectedOption) {
                    case 'conciliacion': {
                        const res = await fetch(
                            `${API_BASE_URL}/api/matching/${cuentaId}/${year}/${month}`
                        )
                        if (res.ok) {
                            const data = await res.json()
                            const all: MovimientoMatch[] = data.matches || []
                            setVinculacionesData(all.filter(m => m.mov_extracto.fecha >= fechaDesde && m.mov_extracto.fecha <= fechaHasta))
                        }
                        break
                    }
                    case 'extracto': {
                        const res = await fetch(
                            `${API_BASE_URL}/api/conciliaciones/${cuentaId}/${year}/${month}/movimientos-extracto`
                        )
                        if (res.ok) {
                            const all: MovimientoExtracto[] = await res.json()
                            setExtractoData(all.filter(m => m.fecha >= fechaDesde && m.fecha <= fechaHasta))
                        }
                        break
                    }
                    case 'vinculaciones': {
                        const res = await fetch(
                            `${API_BASE_URL}/api/matching/${cuentaId}/${year}/${month}`
                        )
                        if (res.ok) {
                            const data = await res.json()
                            const all: MovimientoMatch[] = data.matches || []
                            setVinculacionesData(all.filter(m => m.mov_extracto.fecha >= fechaDesde && m.mov_extracto.fecha <= fechaHasta))
                        }
                        break
                    }
                    case 'sistema': {
                        const res = await fetch(
                            `${API_BASE_URL}/api/movimientos?cuenta_id=${cuentaId}&desde=${fechaDesde}&hasta=${fechaHasta}`
                        )
                        if (res.ok) {
                            const data = await res.json()
                            setSistemaData(data.items || [])
                        }
                        break
                    }
                }
            } catch (error) {
                console.error('Error fetching preview data:', error)
            } finally {
                setLoading(false)
            }
        }

        fetchData()
    }, [isOpen, selectedOption, cuentaId, year, month, fechaDesde, fechaHasta])

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            setSelectedOption('conciliacion')
            setExtractoData([])
            setVinculacionesData([])
            setSistemaData([])
        }
    }, [isOpen])

    // Calcular estadísticas para la vista activa
    const statsBar = useMemo(() => {
        const currency = esUSD ? 'USD' as const : 'COP' as const

        let count = 0
        let ingresos = 0
        let egresos = 0

        switch (selectedOption) {
            case 'conciliacion': {
                if (previewCuenta) {
                    count = previewCuenta.extractos
                    ingresos = previewCuenta.ingresos
                    egresos = -Math.abs(previewCuenta.egresos)
                }
                break
            }
            case 'extracto': {
                count = extractoData.length
                const vals = extractoData.map(m => getValor(m, esUSD))
                ingresos = vals.filter(v => v > 0).reduce((a, b) => a + b, 0)
                egresos = vals.filter(v => v < 0).reduce((a, b) => a + b, 0)
                break
            }
            case 'vinculaciones': {
                count = vinculacionesData.length
                const vals = vinculacionesData.map(m => getValor(m.mov_extracto, esUSD))
                ingresos = vals.filter(v => v > 0).reduce((a, b) => a + b, 0)
                egresos = vals.filter(v => v < 0).reduce((a, b) => a + b, 0)
                break
            }
            case 'sistema': {
                count = sistemaDataFlat.length
                const vals = sistemaDataFlat.map(m => getValor(m, esUSD))
                ingresos = vals.filter(v => v > 0).reduce((a, b) => a + b, 0)
                egresos = vals.filter(v => v < 0).reduce((a, b) => a + b, 0)
                break
            }
        }

        return <StatsBar count={count} ingresos={ingresos} egresos={egresos} currency={currency} />
    }, [selectedOption, extractoData, vinculacionesData, sistemaDataFlat, esUSD, previewCuenta])

    const renderContent = () => {
        switch (selectedOption) {
            case 'conciliacion':
                return <VistaConciliacion data={previewCuenta} esUSD={esUSD} matches={vinculacionesData} loading={loading} />
            case 'extracto':
                return <VistaExtracto data={extractoData} loading={loading} esUSD={esUSD} />
            case 'vinculaciones':
                return <VistaVinculaciones data={vinculacionesData} loading={loading} esUSD={esUSD} />
            case 'sistema':
                return <VistaSistema data={sistemaDataFlat} loading={loading} esUSD={esUSD} />
            default:
                return null
        }
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Vista Previa - ${cuentaNombre}`}
            size="full"
            footer={
                <Button variant="secondary" onClick={onClose}>
                    Cerrar
                </Button>
            }
        >
            {/* Rango de fechas y estadísticas */}
            <div className="flex items-center justify-between -mt-2 mb-4">
                <div className="text-sm text-gray-500">
                    {formatDate(fechaDesde)} — {formatDate(fechaHasta)}
                </div>
                {statsBar}
            </div>

            {/* Option selector */}
            <div className="mb-4">
                <label className="block text-xs font-semibold text-gray-500 uppercase mb-2">
                    Tipo de datos
                </label>
                <div className="flex gap-2 flex-wrap">
                    {PREVIEW_OPTIONS.map((opt) => {
                        const Icon = opt.icon
                        const isSelected = selectedOption === opt.value
                        return (
                            <button
                                key={opt.value}
                                onClick={() => setSelectedOption(opt.value)}
                                className={`
                                    flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors
                                    ${isSelected
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }
                                `}
                            >
                                <Icon size={16} />
                                {opt.label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="min-h-[300px]">
                {renderContent()}
            </div>
        </Modal>
    )
}
