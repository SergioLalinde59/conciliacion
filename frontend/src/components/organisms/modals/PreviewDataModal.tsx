import React, { useState, useEffect, useMemo } from 'react'
import { Modal } from '../../molecules/Modal'
import { CurrencyDisplay } from '../../atoms/CurrencyDisplay'
import { Button } from '../../atoms/Button'
import { Loader2, TrendingUp, TrendingDown, Link2, FileText, Database, CheckCircle, AlertTriangle, XCircle, HelpCircle } from 'lucide-react'
import { API_BASE_URL } from '../../../services/httpClient'

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
    }
}

interface MovimientoExtracto {
    id: number
    fecha: string
    descripcion: string
    referencia: string | null
    valor: number
}

interface MovimientoMatch {
    id: number | null
    mov_extracto: {
        id: number
        fecha: string
        descripcion: string
        valor: number
    }
    mov_sistema: {
        id: number
        fecha: string
        descripcion: string
        valor: number
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
    tercero_nombre: string | null
    centro_costo_nombre: string | null
    concepto_nombre: string | null
    detalles?: Array<{
        id: number
        valor: number
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
    const date = new Date(dateStr + 'T00:00:00')
    return date.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

const extractYearMonth = (dateStr: string): { year: number; month: number } => {
    const date = new Date(dateStr + 'T00:00:00')
    return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

// Aplanar movimientos del sistema con sus detalles
const flattenMovimientos = (movimientos: MovimientoSistema[]): MovimientoSistemaFlat[] => {
    const result: MovimientoSistemaFlat[] = []

    for (const mov of movimientos) {
        // Si tiene detalles, agregar cada detalle como fila
        if (mov.detalles && mov.detalles.length > 0) {
            for (const det of mov.detalles) {
                result.push({
                    id: det.id,
                    fecha: mov.fecha,
                    descripcion: mov.descripcion,
                    referencia: mov.referencia,
                    valor: det.valor,
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

const StatCard: React.FC<{ label: string; value: number | string; icon: React.ElementType; color: string }> = ({
    label, value, icon: Icon, color
}) => (
    <div className={`${color} rounded-lg p-4 text-center`}>
        <Icon size={20} className="mx-auto mb-2 opacity-70" />
        <div className="text-2xl font-bold">{typeof value === 'number' ? value.toLocaleString() : value}</div>
        <div className="text-xs uppercase tracking-wider opacity-70 mt-1">{label}</div>
    </div>
)

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

const VistaConciliacion: React.FC<{ data: PreviewDataModalProps['previewCuenta'] }> = ({ data }) => {
    if (!data) return <div className="text-center text-gray-400 py-8">Sin datos</div>

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard
                label="Ingresos"
                value={data.ingresos}
                icon={TrendingUp}
                color="bg-emerald-50 text-emerald-700"
            />
            <StatCard
                label="Egresos"
                value={data.egresos}
                icon={TrendingDown}
                color="bg-rose-50 text-rose-700"
            />
            <StatCard
                label="Conciliaciones"
                value={data.conciliaciones}
                icon={Database}
                color="bg-blue-50 text-blue-700"
            />
            <StatCard
                label="Vinculaciones"
                value={data.vinculaciones}
                icon={Link2}
                color="bg-purple-50 text-purple-700"
            />
            <StatCard
                label="Mov. Extracto"
                value={data.extractos}
                icon={FileText}
                color="bg-amber-50 text-amber-700"
            />
            <StatCard
                label="Mov. Sistema"
                value={data.movimientos_detalle + data.movimientos_encabezado}
                icon={TrendingUp}
                color="bg-slate-100 text-slate-700"
            />
        </div>
    )
}

const VistaExtracto: React.FC<{ data: MovimientoExtracto[]; loading: boolean }> = ({ data, loading }) => {
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
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Valor</th>
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
                                <CurrencyDisplay value={mov.valor} colorize />
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const VistaVinculaciones: React.FC<{ data: MovimientoMatch[]; loading: boolean }> = ({ data, loading }) => {
    if (loading) return <LoadingSpinner />
    if (!data.length) return <EmptyState message="No hay vinculaciones" />

    return (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                    <tr>
                        <th className="px-3 py-2 text-center text-xs font-bold text-gray-600 uppercase">Estado</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Score</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha Ext.</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Descripción Ext.</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Valor Ext.</th>
                        <th className="px-3 py-2 text-left text-xs font-bold text-gray-600 uppercase">Fecha Sist.</th>
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Valor Sist.</th>
                    </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                    {data.map((match, idx) => (
                        <tr key={match.id || idx} className="hover:bg-gray-50">
                            <td className="px-3 py-2 text-center">
                                <EstadoBadge estado={match.estado} />
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                                {Math.round(match.score_total)}%
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                                {formatDate(match.mov_extracto.fecha)}
                            </td>
                            <td className="px-3 py-2 max-w-[200px] truncate" title={match.mov_extracto.descripcion}>
                                {match.mov_extracto.descripcion}
                            </td>
                            <td className="px-3 py-2 text-right">
                                <CurrencyDisplay value={match.mov_extracto.valor} colorize />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                                {match.mov_sistema ? formatDate(match.mov_sistema.fecha) : '-'}
                            </td>
                            <td className="px-3 py-2 text-right">
                                {match.mov_sistema ? (
                                    <CurrencyDisplay value={match.mov_sistema.valor} colorize />
                                ) : (
                                    <span className="text-gray-400">-</span>
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

const VistaSistema: React.FC<{ data: MovimientoSistemaFlat[]; loading: boolean }> = ({ data, loading }) => {
    if (loading) return <LoadingSpinner />
    if (!data.length) return <EmptyState message="No hay movimientos del sistema" />

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
                        <th className="px-3 py-2 text-right text-xs font-bold text-gray-600 uppercase">Valor</th>
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
                                <CurrencyDisplay value={mov.valor} colorize />
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
        if (!isOpen || selectedOption === 'conciliacion') return

        const fetchData = async () => {
            setLoading(true)
            try {
                switch (selectedOption) {
                    case 'extracto': {
                        const res = await fetch(
                            `${API_BASE_URL}/api/conciliaciones/${cuentaId}/${year}/${month}/movimientos-extracto`
                        )
                        if (res.ok) {
                            setExtractoData(await res.json())
                        }
                        break
                    }
                    case 'vinculaciones': {
                        const res = await fetch(
                            `${API_BASE_URL}/api/matching/${cuentaId}/${year}/${month}`
                        )
                        if (res.ok) {
                            const data = await res.json()
                            setVinculacionesData(data.matches || [])
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

    const renderContent = () => {
        switch (selectedOption) {
            case 'conciliacion':
                return <VistaConciliacion data={previewCuenta} />
            case 'extracto':
                return <VistaExtracto data={extractoData} loading={loading} />
            case 'vinculaciones':
                return <VistaVinculaciones data={vinculacionesData} loading={loading} />
            case 'sistema':
                return <VistaSistema data={sistemaDataFlat} loading={loading} />
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
