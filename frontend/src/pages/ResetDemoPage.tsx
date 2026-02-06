import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-hot-toast'
import { AlertTriangle, Trash2, Database, Loader2, X, Eye } from 'lucide-react'
import { API_BASE_URL } from '../services/httpClient'
import { PreviewDataModal } from '../components/organisms/modals/PreviewDataModal'

interface PreviewCuenta {
    cuenta_id: number
    cuenta: string
    vinculaciones: number
    extractos: number
    conciliaciones: number
    movimientos_detalle: number
    movimientos_encabezado: number
    ingresos: number
    egresos: number
    total: number
}

interface PreviewResult {
    mensaje: string
    periodo: string
    cuentas: PreviewCuenta[]
    totales: {
        vinculaciones: number
        extractos: number
        conciliaciones: number
        movimientos_detalle: number
        movimientos_encabezado: number
        ingresos: number
        egresos: number
        total: number
    }
}

interface ResetResult {
    mensaje: string
    periodo: string
    cuentas_afectadas: string[]
    registros_eliminados: {
        vinculaciones: number
        extractos: number
        conciliaciones: number
        movimientos_detalle: number
        movimientos_encabezado: number
    }
}

export const ResetDemoPage: React.FC = () => {
    const [fechaDesde, setFechaDesde] = useState<string>('')
    const [fechaHasta, setFechaHasta] = useState<string>('')

    // UI States
    const [loadingPreview, setLoadingPreview] = useState(false)
    const [loadingReset, setLoadingReset] = useState(false)
    const [previewData, setPreviewData] = useState<PreviewResult | null>(null)
    const [resultado, setResultado] = useState<ResetResult | null>(null)
    const [selectedCuentas, setSelectedCuentas] = useState<Set<number>>(new Set())
    const [previewModal, setPreviewModal] = useState<{
        isOpen: boolean
        cuentaId: number
        cuentaNombre: string
        previewCuenta?: PreviewCuenta
    } | null>(null)

    // Función para cargar preview
    const loadPreview = useCallback(async (desde: string, hasta: string) => {
        if (!desde || !hasta || desde > hasta) {
            setPreviewData(null)
            return
        }

        setLoadingPreview(true)
        setResultado(null)
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/reset-demo/preview`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha_desde: desde,
                    fecha_hasta: hasta,
                    cuenta_id: null
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Error en preview')
            }

            const result: PreviewResult = await response.json()
            setPreviewData(result)

            if (result.cuentas.length > 0) {
                // Seleccionar todas las cuentas por defecto
                setSelectedCuentas(new Set(result.cuentas.map(c => c.cuenta_id)))
            }
        } catch (error: any) {
            console.error('Error en preview', error)
            setPreviewData(null)
        } finally {
            setLoadingPreview(false)
        }
    }, [])

    // Set default dates (last 6 days) and load preview
    useEffect(() => {
        const hoy = new Date()
        const hace6Dias = new Date()
        hace6Dias.setDate(hoy.getDate() - 6)

        const desde = hace6Dias.toISOString().split('T')[0]
        const hasta = hoy.toISOString().split('T')[0]

        setFechaDesde(desde)
        setFechaHasta(hasta)
        loadPreview(desde, hasta)
    }, [loadPreview])

    // Cargar preview automáticamente cuando cambian las fechas
    useEffect(() => {
        if (fechaDesde && fechaHasta) {
            const timer = setTimeout(() => {
                loadPreview(fechaDesde, fechaHasta)
            }, 300) // Debounce de 300ms
            return () => clearTimeout(timer)
        }
    }, [fechaDesde, fechaHasta, loadPreview])

    const handleReset = async () => {
        setLoadingReset(true)
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/reset-demo`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fecha_desde: fechaDesde,
                    fecha_hasta: fechaHasta,
                    cuenta_ids: Array.from(selectedCuentas)
                })
            })

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Error en el reset')
            }

            const result: ResetResult = await response.json()
            setResultado(result)
            toast.success(result.mensaje)
            setPreviewData(null)
        } catch (error: any) {
            console.error('Error en reset demo', error)
            toast.error(error.message || 'Error al ejecutar reset')
        } finally {
            setLoadingReset(false)
        }
    }

    const totalEliminados = resultado
        ? Object.values(resultado.registros_eliminados).reduce((a, b) => a + b, 0)
        : 0

    // Funciones para manejar selección de cuentas
    const toggleCuenta = (cuentaId: number) => {
        setSelectedCuentas(prev => {
            const next = new Set(prev)
            if (next.has(cuentaId)) {
                next.delete(cuentaId)
            } else {
                next.add(cuentaId)
            }
            return next
        })
    }

    const toggleAllCuentas = () => {
        if (!previewData) return
        if (selectedCuentas.size === previewData.cuentas.length) {
            setSelectedCuentas(new Set())
        } else {
            setSelectedCuentas(new Set(previewData.cuentas.map(c => c.cuenta_id)))
        }
    }

    const clearPreview = () => {
        setPreviewData(null)
        setSelectedCuentas(new Set())
    }

    // Calcular totales de cuentas seleccionadas
    const totalesSeleccionados = previewData?.cuentas
        .filter(c => selectedCuentas.has(c.cuenta_id))
        .reduce((acc, c) => ({
            ingresos: acc.ingresos + c.ingresos,
            egresos: acc.egresos + c.egresos,
            conciliaciones: acc.conciliaciones + c.conciliaciones,
            vinculaciones: acc.vinculaciones + c.vinculaciones,
            extractos: acc.extractos + c.extractos,
            movimientos_sistema: acc.movimientos_sistema + c.movimientos_detalle + c.movimientos_encabezado,
            total: acc.total + c.total
        }), { ingresos: 0, egresos: 0, conciliaciones: 0, vinculaciones: 0, extractos: 0, movimientos_sistema: 0, total: 0 })

    return (
        <div className="max-w-4xl mx-auto p-6">
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-orange-100 text-orange-600 rounded-xl">
                    <Database size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Reset Demo</h1>
                    <p className="text-gray-500">Elimina datos de un período para volver a cargar en demostraciones.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {/* Filtros */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                    {/* Fecha Desde */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Desde</label>
                        <input
                            type="date"
                            value={fechaDesde}
                            onChange={(e) => setFechaDesde(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                    </div>

                    {/* Fecha Hasta */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fecha Hasta</label>
                        <input
                            type="date"
                            value={fechaHasta}
                            onChange={(e) => setFechaHasta(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                        />
                    </div>
                </div>

                {/* Loading indicator */}
                {loadingPreview && (
                    <div className="mb-6 flex items-center justify-center py-8 text-gray-500">
                        <Loader2 size={24} className="animate-spin mr-2" />
                        <span>Consultando registros...</span>
                    </div>
                )}

                {/* Sin registros */}
                {!loadingPreview && previewData && previewData.cuentas.length === 0 && (
                    <div className="mb-6 text-center py-6 bg-gray-50 rounded-lg border border-gray-200">
                        <Database size={32} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">No hay registros para eliminar en este período</p>
                    </div>
                )}

                {/* Preview Table (inline) */}
                {!loadingPreview && previewData && previewData.cuentas.length > 0 && (
                    <div className="mb-6">
                        {/* Header del preview */}
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                                <AlertTriangle className="h-5 w-5 text-orange-500" />
                                <span className="font-bold text-gray-800">
                                    Preview: {previewData.periodo}
                                </span>
                            </div>
                            <button
                                onClick={clearPreview}
                                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 hover:text-gray-600 transition-colors"
                                title="Cerrar preview"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* DataTable */}
                        <div className="overflow-x-auto border border-gray-200 rounded-lg">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-3 py-3 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedCuentas.size === previewData.cuentas.length}
                                                onChange={toggleAllCuentas}
                                                className="h-4 w-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                            />
                                        </th>
                                        <th className="px-2 py-3 text-center w-10">
                                            {/* Columna para icono Eye */}
                                        </th>
                                        <th className="px-3 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Cuenta
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-bold text-emerald-600 uppercase tracking-wider">
                                            Ingresos
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-bold text-rose-600 uppercase tracking-wider">
                                            Egresos
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Conc.
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Vinc.
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Mov Ext.
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-bold text-gray-600 uppercase tracking-wider">
                                            Mov Sist.
                                        </th>
                                        <th className="px-3 py-3 text-right text-xs font-bold text-orange-600 uppercase tracking-wider">
                                            Total
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {previewData.cuentas.map((cuenta) => (
                                        <tr
                                            key={cuenta.cuenta_id}
                                            className={`hover:bg-gray-50 ${!selectedCuentas.has(cuenta.cuenta_id) ? 'opacity-40' : ''}`}
                                        >
                                            <td className="px-3 py-2 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedCuentas.has(cuenta.cuenta_id)}
                                                    onChange={() => toggleCuenta(cuenta.cuenta_id)}
                                                    className="h-4 w-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                                                />
                                            </td>
                                            <td className="px-2 py-2 text-center">
                                                <button
                                                    onClick={() => setPreviewModal({
                                                        isOpen: true,
                                                        cuentaId: cuenta.cuenta_id,
                                                        cuentaNombre: cuenta.cuenta,
                                                        previewCuenta: cuenta
                                                    })}
                                                    className="p-1 hover:bg-blue-50 rounded text-gray-400 hover:text-blue-600 transition-colors"
                                                    title="Ver registros"
                                                >
                                                    <Eye size={16} />
                                                </button>
                                            </td>
                                            <td className="px-3 py-2 text-sm font-medium text-gray-900">
                                                {cuenta.cuenta}
                                            </td>
                                            <td className="px-3 py-2 text-sm font-medium text-emerald-600 text-right">
                                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(cuenta.ingresos)}
                                            </td>
                                            <td className="px-3 py-2 text-sm font-medium text-rose-600 text-right">
                                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(cuenta.egresos)}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600 text-right">
                                                {cuenta.conciliaciones.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600 text-right">
                                                {cuenta.vinculaciones.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600 text-right">
                                                {cuenta.extractos.toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-sm text-gray-600 text-right">
                                                {(cuenta.movimientos_detalle + cuenta.movimientos_encabezado).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-2 text-sm font-bold text-orange-600 text-right">
                                                {cuenta.total.toLocaleString()}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-gray-100">
                                    <tr className="font-bold">
                                        <td className="px-3 py-2 text-sm text-gray-500 text-center">
                                            {selectedCuentas.size}/{previewData.cuentas.length}
                                        </td>
                                        <td className="px-2 py-2">
                                            {/* Celda vacía para Eye */}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-900">
                                            TOTAL SELECCIONADO
                                        </td>
                                        <td className="px-3 py-2 text-sm text-emerald-700 text-right">
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalesSeleccionados?.ingresos || 0)}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-rose-700 text-right">
                                            {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(totalesSeleccionados?.egresos || 0)}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                            {(totalesSeleccionados?.conciliaciones || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                            {(totalesSeleccionados?.vinculaciones || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                            {(totalesSeleccionados?.extractos || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-sm text-gray-900 text-right">
                                            {(totalesSeleccionados?.movimientos_sistema || 0).toLocaleString()}
                                        </td>
                                        <td className="px-3 py-2 text-sm font-bold text-orange-600 text-right">
                                            {(totalesSeleccionados?.total || 0).toLocaleString()}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>

                        {/* Botón de confirmación */}
                        <div className="mt-4 flex items-center justify-between">
                            <p className="text-sm text-red-600 font-medium">
                                Se eliminarán <strong>{(totalesSeleccionados?.total || 0).toLocaleString()}</strong> registros
                                de <strong>{selectedCuentas.size}</strong> cuenta(s).
                            </p>
                            <button
                                onClick={handleReset}
                                disabled={loadingReset || selectedCuentas.size === 0}
                                className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-bold shadow-lg shadow-red-200 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {loadingReset ? (
                                    <>
                                        <Loader2 size={18} className="animate-spin" />
                                        Eliminando...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 size={18} />
                                        Confirmar Eliminación
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* Warning */}
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 flex gap-3">
                    <AlertTriangle className="text-orange-600 h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-orange-800">
                        <strong>Esta acción eliminará:</strong>
                        <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5">
                            <li>Movimientos del sistema</li>
                            <li>Extractos bancarios</li>
                            <li>Vinculaciones (matches)</li>
                            <li>Conciliaciones del período</li>
                        </ul>
                    </div>
                </div>

                {/* Info: Efectivo no se afecta */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                    <Database className="text-blue-600 h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <strong>Las cuentas de efectivo NO serán afectadas.</strong>
                        <p className="mt-1">Solo se eliminan datos de cuentas bancarias, tarjetas de crédito e inversiones.</p>
                    </div>
                </div>

                {/* Resultado */}
                {resultado && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 mt-6">
                        <h3 className="font-bold text-green-800 mb-2">Reset completado</h3>
                        <p className="text-sm text-green-700 mb-2">Período: {resultado.periodo}</p>
                        <p className="text-sm text-green-700 mb-2">
                            Cuentas afectadas: {resultado.cuentas_afectadas.join(', ')}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-3">
                            <div className="bg-white rounded p-2 text-center">
                                <div className="text-lg font-bold text-gray-900">{resultado.registros_eliminados.vinculaciones}</div>
                                <div className="text-xs text-gray-500">Vinculaciones</div>
                            </div>
                            <div className="bg-white rounded p-2 text-center">
                                <div className="text-lg font-bold text-gray-900">{resultado.registros_eliminados.extractos}</div>
                                <div className="text-xs text-gray-500">Extractos</div>
                            </div>
                            <div className="bg-white rounded p-2 text-center">
                                <div className="text-lg font-bold text-gray-900">{resultado.registros_eliminados.conciliaciones}</div>
                                <div className="text-xs text-gray-500">Conciliaciones</div>
                            </div>
                            <div className="bg-white rounded p-2 text-center">
                                <div className="text-lg font-bold text-gray-900">{resultado.registros_eliminados.movimientos_detalle}</div>
                                <div className="text-xs text-gray-500">Detalles</div>
                            </div>
                            <div className="bg-white rounded p-2 text-center">
                                <div className="text-lg font-bold text-gray-900">{resultado.registros_eliminados.movimientos_encabezado}</div>
                                <div className="text-xs text-gray-500">Movimientos</div>
                            </div>
                        </div>
                        <div className="mt-3 text-center">
                            <span className="text-green-800 font-bold">Total eliminados: {totalEliminados}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Preview Modal */}
            {previewModal && (
                <PreviewDataModal
                    isOpen={previewModal.isOpen}
                    onClose={() => setPreviewModal(null)}
                    cuentaId={previewModal.cuentaId}
                    cuentaNombre={previewModal.cuentaNombre}
                    fechaDesde={fechaDesde}
                    fechaHasta={fechaHasta}
                    previewCuenta={previewModal.previewCuenta}
                />
            )}
        </div>
    )
}
