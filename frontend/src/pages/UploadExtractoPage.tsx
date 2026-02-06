import React, { useState } from 'react'
import { apiService } from '../services/api'
import { useCatalogo } from '../hooks/useCatalogo'
import { ExtractDetailsTable } from '../components/organisms/ExtractDetailsTable'
import type { ExtractDetailRow } from '../components/organisms/ExtractDetailsTable'
import { UploadCloud, FileText, CheckCircle, AlertCircle, BarChart3, FolderOpen, ChevronDown, ChevronUp, Info, ExternalLink } from 'lucide-react'
import { Modal } from '../components/molecules/Modal'
import { Button } from '../components/atoms/Button'
import { EditExtractMovementModal } from '../components/organisms/modals/EditExtractMovementModal'
import { SelectorCuenta } from '../components/molecules/SelectorCuenta'

interface ResumenExtracto {
    saldo_anterior: number
    entradas: number
    rendimientos?: number
    salidas: number
    retenciones?: number
    saldo_final: number
    periodo_desde?: string
    periodo_hasta?: string
    year?: number
    month?: number
    periodo_texto?: string
    movimientos_count?: number
    total_leidos?: number
    total_duplicados?: number
    total_nuevos?: number
    movimientos?: ExtractDetailRow[]
    validacion_cruzada?: {
        es_valido: boolean
        diferencia_entradas: number
        diferencia_salidas: number
        diferencia_rendimientos: number
        diferencia_retenciones: number
        movimientos_entradas: number
        movimientos_salidas: number
        movimientos_rendimientos: number
        movimientos_retenciones: number
        // Cargados = movimientos ya existentes en el sistema
        cargados_entradas?: number
        cargados_salidas?: number
        cargados_rendimientos?: number
        cargados_retenciones?: number
    }
}

// Subcomponent for Stats - Premium Style
const StatCard = ({ label, value, secondaryValue, icon, colorClass, bgColorClass, borderColor, isCurrency = true }: any) => {
    return (
        <div className={`group bg-white p-3 rounded-xl shadow-sm border border-slate-200/60 flex items-center justify-between transition-all duration-300 hover:shadow-md ${borderColor || ''}`}>
            <div className="space-y-0.5">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <div className={`text-lg font-black tracking-tight ${colorClass} flex items-baseline gap-2`}>
                    {isCurrency
                        ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value))
                        : value}
                    {secondaryValue !== undefined && secondaryValue !== null && (
                        <span className="text-xs opacity-40 font-medium text-slate-400">/ {secondaryValue}</span>
                    )}
                </div>
            </div>
            <div className={`p-2.5 ${bgColorClass} ${colorClass} rounded-xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-inner`}>
                {React.cloneElement(icon as React.ReactElement<any>, { size: 18 })}
            </div>
        </div>
    );
};

export const UploadExtractoPage: React.FC = () => {
    // --- State: File & Account ---
    const [file, setFile] = useState<File | null>(null)
    const [tipoCuenta, setTipoCuenta] = useState('')
    const [cuentaId, setCuentaId] = useState<number | null>(null)
    const { cuentas } = useCatalogo()

    const [localFilename, setLocalFilename] = useState<string | null>(null)

    // --- State: Analysis & Data ---
    const [loading, setLoading] = useState(false)
    const [analyzed, setAnalyzed] = useState(false)
    const [resumen, setResumen] = useState<ResumenExtracto | null>(null)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    const [showEditModal, setShowEditModal] = useState(false)
    const [editingMovement, setEditingMovement] = useState<{ record: ExtractDetailRow, index: number } | null>(null)
    const [showDetailsManually, setShowDetailsManually] = useState(false) // Toggle to show details even if valid

    // --- State: Modals ---
    const [showLocalModal, setShowLocalModal] = useState(false)
    const [localFiles, setLocalFiles] = useState<string[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)
    const [showSuccessModal, setShowSuccessModal] = useState(false)
    const [showPdfModal, setShowPdfModal] = useState(false)
    const [pdfUrl, setPdfUrl] = useState<string | null>(null)


    // --- Handlers: File Selection ---

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            resetState()
            setFile(e.target.files[0])
        }
    }

    const resetState = () => {
        setFile(null)
        setLocalFilename(null)
        setResult(null)
        setError(null)
        setAnalyzed(false)
        setResumen(null)
        setShowSuccessModal(false)
        setShowDetailsManually(false)
    }

    const handleOpenLocalPicker = async () => {
        setLoadingFiles(true)
        setShowLocalModal(true)
        try {
            const files = await apiService.archivos.listarDirectorios('extractos')
            setLocalFiles(files)
        } catch (err: any) {
            setError("Error al listar archivos del servidor")
        } finally {
            setLoadingFiles(false)
        }
    }

    const handleLocalFileSelect = async (filename: string) => {
        setShowLocalModal(false)
        resetState()
        setLocalFilename(filename)
        // Trigger analysis immediately
        await processAnalysis(filename, true)
    }

    // --- Handlers: Analysis ---

    const handleAnalizar = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) return
        await processAnalysis(file, false)
    }

    const processAnalysis = async (fileOrName: File | string, isLocal: boolean) => {
        setLoading(true)
        setError(null)
        setAnalyzed(false)
        setResumen(null)

        try {
            let data: any;
            if (isLocal) {
                data = await apiService.archivos.procesarLocal(
                    fileOrName as string,
                    'extractos',
                    tipoCuenta,
                    cuentaId || undefined,
                    false,
                    undefined, undefined,
                    'analizar'
                )
            } else {
                data = await apiService.conciliacion.analizarExtracto(fileOrName as File, tipoCuenta, cuentaId)
            }
            setResumen(data)
            setAnalyzed(true)

            // Auto open details if invalid
            if (data.validacion_cruzada && !data.validacion_cruzada.es_valido) {
                setShowDetailsManually(true)
            }

        } catch (err: any) {
            setError(err.message || "Error al analizar archivo")
        } finally {
            setLoading(false)
        }
    }


    // --- Handlers: Editing Movements (Modal) ---

    const handleEditMovement = (record: ExtractDetailRow, index: number) => {
        setEditingMovement({ record, index })
        setShowEditModal(true)
    }

    const handleSaveMovement = (updatedRecord: ExtractDetailRow) => {
        if (!resumen || !resumen.movimientos || !editingMovement) return

        const newMovimientos = resumen.movimientos.map((m, idx) => {
            if (idx === editingMovement.index) {
                return updatedRecord
            }
            return m
        })

        // Update local state and Recalculate Totals
        const { entradas, salidas, rendimientos, retenciones } = calculateTotals(newMovimientos)

        setResumen(prev => {
            if (!prev) return null
            const updated = {
                ...prev,
                movimientos: newMovimientos,
                validacion_cruzada: prev.validacion_cruzada ? {
                    ...prev.validacion_cruzada,
                    movimientos_entradas: entradas,
                    movimientos_salidas: salidas,
                    movimientos_rendimientos: rendimientos,
                    movimientos_retenciones: retenciones,
                    diferencia_entradas: prev.entradas - entradas,
                    diferencia_salidas: prev.salidas - salidas,
                    diferencia_rendimientos: (prev.rendimientos || 0) - rendimientos,
                    diferencia_retenciones: (prev.retenciones || 0) - retenciones,
                    // Approx check for validity
                    es_valido:
                        Math.abs(prev.entradas - entradas) < 1.0 &&
                        Math.abs(prev.salidas - salidas) < 1.0 &&
                        Math.abs((prev.rendimientos || 0) - rendimientos) < 1.0 &&
                        Math.abs((prev.retenciones || 0) - retenciones) < 1.0
                } : undefined
            }
            return updated
        })
    }

    const calculateTotals = (movs: ExtractDetailRow[]) => {
        let entradas = 0
        let salidas = 0
        let rendimientos = 0
        let retenciones = 0

        movs.forEach(m => {
            const val = Number(m.valor)
            const desc = (m.descripcion || '').toUpperCase()

            if (desc.includes('RETEFTE') || desc.includes('RTEFTE')) {
                retenciones += Math.abs(val)
            } else if (desc.includes('ADICION') || desc.includes('ABONO')) {
                entradas += val
            } else if (desc.includes('RETIRO') || desc.includes('DISPOSICION')) {
                salidas += Math.abs(val)
            } else if (desc.includes('REND') || desc.includes('VALOR')) {
                rendimientos += val
            } else {
                if (val > 0) entradas += val
                else salidas += Math.abs(val)
            }
        })
        return { entradas, salidas, rendimientos, retenciones }
    }



    // --- Handlers: Confirmation ---

    const handleCargarDefinitivo = async () => {
        if (!cuentaId || !resumen || !resumen.year || !resumen.month) return

        setLoading(true)
        try {
            const movimientosConfirmados = resumen.movimientos

            let data;
            if (localFilename) {
                data = await apiService.archivos.procesarLocal(
                    localFilename,
                    'extractos',
                    tipoCuenta,
                    cuentaId,
                    false,
                    resumen.year,
                    resumen.month,
                    'cargar',
                    undefined,
                    movimientosConfirmados
                )
            } else if (file) {
                data = await apiService.conciliacion.cargarExtracto(
                    file,
                    tipoCuenta,
                    cuentaId,
                    resumen.year,
                    resumen.month,
                    undefined,
                    movimientosConfirmados
                )
            }

            setResult(data)
            setShowSuccessModal(true)
        } catch (err: any) {
            setError(err.message || "Error al cargar extracto")
        } finally {
            setLoading(false)
        }
    }

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val)

    const [pdfPage, setPdfPage] = useState<number>(1)

    const handleVerPdf = async () => {
        let url: string | null = null
        let pagina = 1

        // Determinar moneda según tipo de cuenta
        const moneda = tipoCuenta.includes('USD') || tipoCuenta.includes('Dolares') ? 'DOLARES' : 'PESOS'

        // Buscar página del resumen solo para archivos en servidor
        if (localFilename) {
            try {
                const result = await apiService.archivos.buscarPaginaResumen(localFilename, moneda)
                pagina = result.pagina
            } catch (e) {
                console.warn('No se pudo obtener página de resumen:', e)
            }
            url = `http://localhost:8000/api/archivos/ver-pdf?tipo=extractos&filename=${encodeURIComponent(localFilename)}`
        } else if (file) {
            url = URL.createObjectURL(file)
            // Para archivos locales no podemos buscar la página sin subirlo primero
        }

        if (url) {
            setPdfPage(pagina)
            setPdfUrl(url)
            setShowPdfModal(true)
        }
    }

    const handleClosePdfModal = () => {
        setShowPdfModal(false)
        // Limpiar URL si fue creada con createObjectURL
        if (pdfUrl && file) {
            URL.revokeObjectURL(pdfUrl)
        }
        setPdfUrl(null)
    }

    // --- UI Helpers ---

    const hasDescuadre = !!(resumen && resumen.validacion_cruzada && !resumen.validacion_cruzada.es_valido)
    const isDescuadreBlocking = hasDescuadre
    const hasNewRecords = (resumen?.total_nuevos ?? 0) > 0
    const canUpload = !!(cuentaId && resumen?.year && resumen?.month && !loading && hasNewRecords)

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Header section - Reduced padding */}
            <div className="px-6 pt-4 pb-1 bg-white border-b border-slate-100">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-xl shadow-sm border border-blue-100">
                        <UploadCloud size={20} />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-slate-900 leading-none">Cargar Extracto Bancario</h1>
                        <p className="text-slate-500 text-xs mt-1">Sube el PDF, verifique las cifras y confirme la carga.</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-4 space-y-3 flex flex-col overflow-hidden">
                {/* 1. Selección */}
                <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                        <div className="md:col-span-4">
                            <SelectorCuenta
                                value={cuentaId?.toString() ?? ''}
                                onChange={(val) => {
                                    const id = Number(val)
                                    setCuentaId(id)
                                    resetState()
                                    const cuenta = cuentas.find(c => c.id === id)
                                    if (cuenta) setTipoCuenta(cuenta.nombre)
                                }}
                                label="Cuenta"
                                soloConciliables={false}
                                soloPermiteCarga={true}
                                className="!mb-0"
                            />
                        </div>

                        <div className="md:col-span-6">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Archivo PDF</label>
                            <div className="flex gap-2">
                                <label className="flex-1 cursor-pointer flex items-center justify-center gap-3 p-2 border border-slate-200 rounded-xl bg-slate-50/30 hover:bg-slate-50 transition-all group">
                                    <input type="file" accept=".pdf" onChange={handleFileChange} className="hidden" />
                                    <div className="truncate flex items-center gap-2 font-medium text-slate-600 text-sm">
                                        {file ? <FileText size={16} className="text-blue-500" /> : <UploadCloud size={16} className="text-slate-400 group-hover:text-blue-500 transition-colors" />}
                                        <span className="truncate max-w-[300px]">
                                            {file ? file.name : localFilename ? localFilename : "Seleccionar PDF..."}
                                        </span>
                                    </div>
                                </label>
                                <Button
                                    variant="secondary"
                                    onClick={handleOpenLocalPicker}
                                    className="rounded-xl border-slate-200 h-[38px] w-[38px] !p-0 flex items-center justify-center"
                                    title="Buscar en Servidor"
                                    icon={FolderOpen}
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            {!analyzed && !result && (
                                <Button
                                    onClick={handleAnalizar}
                                    disabled={loading || (!file && !localFilename)}
                                    className="w-full h-[38px] justify-center rounded-xl bg-blue-600 hover:bg-blue-700 font-bold text-sm"
                                    isLoading={loading}
                                >
                                    Analizar
                                </Button>
                            )}
                            {analyzed && (
                                <Button
                                    variant="secondary"
                                    onClick={resetState}
                                    className="w-full h-[38px] justify-center text-xs rounded-xl font-bold border-slate-200"
                                >
                                    Reiniciar
                                </Button>
                            )}
                        </div>
                    </div>
                </div>

                {/* 2. Resultados del Análisis */}
                {resumen && analyzed && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        {/* Indicadores de Movimientos */}
                        {resumen.total_leidos !== undefined && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <StatCard
                                    label="Total Leídos"
                                    value={resumen.total_leidos}
                                    icon={<FileText />}
                                    colorClass="text-slate-600"
                                    bgColorClass="bg-slate-50"
                                    borderColor="group-hover:border-slate-300"
                                    isCurrency={false}
                                />
                                <StatCard
                                    label="Duplicados"
                                    value={resumen.total_duplicados || 0}
                                    icon={<AlertCircle />}
                                    colorClass="text-orange-600"
                                    bgColorClass="bg-orange-50"
                                    borderColor="group-hover:border-orange-200"
                                    isCurrency={false}
                                />
                                <StatCard
                                    label="Nuevos a Cargar"
                                    value={resumen.total_nuevos || 0}
                                    icon={<CheckCircle />}
                                    colorClass="text-emerald-600"
                                    bgColorClass="bg-emerald-50"
                                    borderColor="group-hover:border-emerald-200"
                                    isCurrency={false}
                                />
                            </div>
                        )}

                        {/* Panel de Validación Cruzada - Muy Compacto */}
                        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                            <div className="bg-slate-50/50 px-4 py-2 border-b border-slate-100 flex justify-between items-center">
                                <div className="flex items-center gap-4">
                                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                                        <BarChart3 size={12} />
                                        Validación de Cifras
                                    </h3>
                                    {resumen.periodo_texto && (
                                        <p className="text-xs font-bold text-slate-700 bg-slate-200/50 px-2 py-0.5 rounded-md">
                                            {resumen.periodo_texto}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-separate border-spacing-0">
                                    <thead>
                                        <tr className="bg-slate-50/30">
                                            <th className="px-4 py-1.5 text-left text-[9px] font-bold text-slate-400 uppercase tracking-widest">Concepto</th>
                                            <th className="px-4 py-1.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Extracto (PDF)</th>
                                            <th className="px-4 py-1.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Mov. (PDF)</th>
                                            <th className="px-4 py-1.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Dif (PDF)</th>
                                            <th className="px-4 py-1.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Cargados (Mov)</th>
                                            <th className="px-4 py-1.5 text-right text-[9px] font-bold text-slate-400 uppercase tracking-widest">Diferencia</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {/* SALDO INICIAL */}
                                        <tr className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-1.5 font-bold text-slate-600">Saldo Inicial</td>
                                            <td className="px-4 py-1.5 text-right font-mono font-bold text-slate-800">
                                                {formatCurrency(resumen.saldo_anterior)}
                                            </td>
                                            <td className="px-4 py-1.5 text-right text-slate-300 font-mono italic">-</td>
                                            <td className="px-4 py-1.5 text-right text-slate-300 font-mono italic">-</td>
                                            <td className="px-4 py-1.5 text-right text-slate-300 font-mono italic">-</td>
                                            <td className="px-4 py-1.5 text-right text-slate-300 font-mono italic">-</td>
                                        </tr>

                                        {/* ENTRADAS */}
                                        <tr className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-1.5 font-bold text-slate-600 flex items-center gap-2">
                                                Entradas
                                                {tipoCuenta === 'FondoRenta' && (
                                                    <div title="En Fondo Renta, las Entradas corresponden a las 'Adiciones'." className="cursor-help text-blue-400">
                                                        <Info size={12} />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-1.5 text-right text-slate-800 font-mono font-bold">
                                                {formatCurrency(resumen.entradas)}
                                            </td>
                                            <td className="px-4 py-1.5 text-right text-blue-600 font-bold font-mono">
                                                {formatCurrency(resumen.validacion_cruzada?.movimientos_entradas || 0)}
                                            </td>
                                            <td className="px-4 py-1.5 text-right">
                                                {(() => {
                                                    const diffPdf = resumen.entradas - (resumen.validacion_cruzada?.movimientos_entradas || 0)
                                                    return (
                                                        <span className={`font-black font-mono px-1.5 py-0.5 rounded text-[10px] ${Math.abs(diffPdf) > 1.0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            {formatCurrency(diffPdf)}
                                                        </span>
                                                    )
                                                })()}
                                            </td>
                                            <td className="px-4 py-1.5 text-right text-emerald-600 font-bold font-mono">
                                                {formatCurrency(resumen.validacion_cruzada?.movimientos_entradas || 0)}
                                            </td>
                                            <td className="px-4 py-1.5 text-right">
                                                {(() => {
                                                    const diff = resumen.entradas - (resumen.validacion_cruzada?.movimientos_entradas || 0)
                                                    return (
                                                        <span className={`font-black font-mono px-1.5 py-0.5 rounded text-[10px] ${Math.abs(diff) > 1.0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            {formatCurrency(diff)}
                                                        </span>
                                                    )
                                                })()}
                                            </td>
                                        </tr>

                                        {/* RENDIMIENTOS (Only FondoRenta) */}
                                        {tipoCuenta === 'FondoRenta' && (
                                            <tr className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-1.5 font-bold text-slate-600">Rendimientos</td>
                                                <td className="px-4 py-1.5 text-right text-emerald-600 font-mono font-bold">
                                                    {formatCurrency(resumen.rendimientos || 0)}
                                                </td>
                                                <td className="px-4 py-1.5 text-right text-blue-600 font-bold font-mono">
                                                    {formatCurrency(resumen.validacion_cruzada?.movimientos_rendimientos || 0)}
                                                </td>
                                                <td className="px-4 py-1.5 text-right">
                                                    {(() => {
                                                        const diffPdf = (resumen.rendimientos || 0) - (resumen.validacion_cruzada?.movimientos_rendimientos || 0)
                                                        return (
                                                            <span className={`font-black font-mono px-1.5 py-0.5 rounded text-[10px] ${Math.abs(diffPdf) > 1.0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                {formatCurrency(diffPdf)}
                                                            </span>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="px-4 py-1.5 text-right text-emerald-600 font-bold font-mono">
                                                    {formatCurrency(resumen.validacion_cruzada?.movimientos_rendimientos || 0)}
                                                </td>
                                                <td className="px-4 py-1.5 text-right">
                                                    {(() => {
                                                        const diff = (resumen.rendimientos || 0) - (resumen.validacion_cruzada?.movimientos_rendimientos || 0)
                                                        return (
                                                            <span className={`font-black font-mono px-1.5 py-0.5 rounded text-[10px] ${Math.abs(diff) > 1.0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                {formatCurrency(diff)}
                                                            </span>
                                                        )
                                                    })()}
                                                </td>
                                            </tr>
                                        )}

                                        {/* SALIDAS */}
                                        <tr className="hover:bg-slate-50/50 transition-colors">
                                            <td className="px-4 py-1.5 font-bold text-slate-600 flex items-center gap-2">
                                                Salidas
                                                {tipoCuenta === 'FondoRenta' && (
                                                    <div title="En Fondo Renta, las Salidas corresponden a los 'Retiros'." className="cursor-help text-blue-400">
                                                        <Info size={12} />
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-1.5 text-right text-slate-800 font-mono font-bold">
                                                {formatCurrency(resumen.salidas)}
                                            </td>
                                            <td className="px-4 py-1.5 text-right text-blue-600 font-bold font-mono">
                                                {formatCurrency(resumen.validacion_cruzada?.movimientos_salidas || 0)}
                                            </td>
                                            <td className="px-4 py-1.5 text-right">
                                                {(() => {
                                                    const diffPdf = resumen.salidas - (resumen.validacion_cruzada?.movimientos_salidas || 0)
                                                    return (
                                                        <span className={`font-black font-mono px-1.5 py-0.5 rounded text-[10px] ${Math.abs(diffPdf) > 1.0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            {formatCurrency(diffPdf)}
                                                        </span>
                                                    )
                                                })()}
                                            </td>
                                            <td className="px-4 py-1.5 text-right text-emerald-600 font-bold font-mono">
                                                {formatCurrency(resumen.validacion_cruzada?.movimientos_salidas || 0)}
                                            </td>
                                            <td className="px-4 py-1.5 text-right">
                                                {(() => {
                                                    const diff = resumen.salidas - (resumen.validacion_cruzada?.movimientos_salidas || 0)
                                                    return (
                                                        <span className={`font-black font-mono px-1.5 py-0.5 rounded text-[10px] ${Math.abs(diff) > 1.0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                            {formatCurrency(diff)}
                                                        </span>
                                                    )
                                                })()}
                                            </td>
                                        </tr>

                                        {/* RETENCIONES (Only FondoRenta) */}
                                        {tipoCuenta === 'FondoRenta' && (
                                            <tr className="hover:bg-slate-50/50 transition-colors">
                                                <td className="px-4 py-1.5 font-bold text-slate-600">Retenciones</td>
                                                <td className="px-4 py-1.5 text-right text-rose-600 font-mono font-bold">
                                                    {formatCurrency(resumen.retenciones || 0)}
                                                </td>
                                                <td className="px-4 py-1.5 text-right text-blue-600 font-bold font-mono">
                                                    {formatCurrency(resumen.validacion_cruzada?.movimientos_retenciones || 0)}
                                                </td>
                                                <td className="px-4 py-1.5 text-right">
                                                    {(() => {
                                                        const diffPdf = (resumen.retenciones || 0) - (resumen.validacion_cruzada?.movimientos_retenciones || 0)
                                                        return (
                                                            <span className={`font-black font-mono px-1.5 py-0.5 rounded text-[10px] ${Math.abs(diffPdf) > 1.0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                {formatCurrency(diffPdf)}
                                                            </span>
                                                        )
                                                    })()}
                                                </td>
                                                <td className="px-4 py-1.5 text-right text-emerald-600 font-bold font-mono">
                                                    {formatCurrency(resumen.validacion_cruzada?.movimientos_retenciones || 0)}
                                                </td>
                                                <td className="px-4 py-1.5 text-right">
                                                    {(() => {
                                                        const diff = (resumen.retenciones || 0) - (resumen.validacion_cruzada?.movimientos_retenciones || 0)
                                                        return (
                                                            <span className={`font-black font-mono px-1.5 py-0.5 rounded text-[10px] ${Math.abs(diff) > 1.0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                                                {formatCurrency(diff)}
                                                            </span>
                                                        )
                                                    })()}
                                                </td>
                                            </tr>
                                        )}

                                        {/* SALDO FINAL */}
                                        <tr className="bg-slate-50/30">
                                            <td className="px-4 py-2 font-black text-slate-900 uppercase text-[10px] tracking-wide">Saldo Final Esperado</td>
                                            <td className="px-4 py-2 text-right font-black font-mono text-sm text-slate-900">
                                                {formatCurrency(resumen.saldo_final)}
                                            </td>
                                            <td className="px-4 py-2 text-right text-slate-300 font-mono italic">-</td>
                                            <td className="px-4 py-2 text-right text-slate-300 font-mono italic">-</td>
                                            <td className="px-4 py-2 text-right text-slate-300 font-mono italic">-</td>
                                            <td className="px-4 py-2 text-right text-slate-300 font-mono italic">-</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>

                            {/* Banner de Estado según diferencia */}
                            {resumen.validacion_cruzada && (() => {
                                const diffEntradas = resumen.validacion_cruzada.diferencia_entradas || 0
                                const diffSalidas = resumen.validacion_cruzada.diferencia_salidas || 0
                                const totalDiff = Math.abs(diffEntradas) + Math.abs(diffSalidas)
                                const esDiferenciaPositiva = diffEntradas > 0 || diffSalidas > 0
                                const esDiferenciaNegativa = diffEntradas < 0 || diffSalidas < 0

                                if (totalDiff < 1) {
                                    // Diferencia = 0: Todo cuadra
                                    return (
                                        <div className="px-4 py-3 bg-emerald-50 border-t border-emerald-200 flex items-center gap-3">
                                            <CheckCircle className="h-5 w-5 text-emerald-600" />
                                            <span className="text-emerald-700 font-bold text-sm">
                                                Los movimientos coinciden con el extracto - Carga habilitada
                                            </span>
                                        </div>
                                    )
                                } else if (esDiferenciaPositiva) {
                                    // Diferencia > 0: Faltan movimientos
                                    const ultimaFecha = resumen.movimientos?.length
                                        ? resumen.movimientos.reduce((max, m) => m.fecha > max ? m.fecha : max, resumen.movimientos[0].fecha)
                                        : null
                                    return (
                                        <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                                            <div className="flex items-center gap-3">
                                                <AlertCircle className="h-5 w-5 text-amber-600" />
                                                <div>
                                                    <span className="text-amber-700 font-bold text-sm">
                                                        Faltan movimientos por {formatCurrency(Math.abs(diffEntradas) + Math.abs(diffSalidas))}
                                                    </span>
                                                    <p className="text-amber-600 text-xs mt-0.5">
                                                        Revise la carga de movimientos pendientes.
                                                        {ultimaFecha && <span className="font-bold"> Última fecha cargada: {ultimaFecha}</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                } else if (esDiferenciaNegativa) {
                                    // Diferencia < 0: Error en parser
                                    return (
                                        <div className="px-4 py-3 bg-rose-50 border-t border-rose-200">
                                            <div className="flex items-center gap-3">
                                                <AlertCircle className="h-5 w-5 text-rose-600" />
                                                <div>
                                                    <span className="text-rose-700 font-bold text-sm">
                                                        Error de lectura del extracto - Movimientos de más por {formatCurrency(Math.abs(diffEntradas) + Math.abs(diffSalidas))}
                                                    </span>
                                                    <p className="text-rose-600 text-xs mt-0.5">
                                                        Verifique los detalles para identificar registros duplicados o mal parseados.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                }
                                return null
                            })()}

                            <div className="px-4 py-2 bg-slate-50/50 border-t border-slate-100 flex justify-between items-center">
                                <button
                                    onClick={() => setShowDetailsManually(!showDetailsManually)}
                                    className="text-slate-400 hover:text-blue-600 text-[11px] font-black flex items-center gap-2 transition-all group uppercase tracking-widest"
                                >
                                    <div className={`p-1 rounded-lg ${showDetailsManually ? 'bg-blue-100 text-blue-600' : 'bg-slate-200 text-slate-400'} group-hover:scale-110 transition-transform`}>
                                        {showDetailsManually ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                    {showDetailsManually ? 'Ocultar Detalles' : 'Ver Detalles Detectados'}
                                </button>

                                <div className="flex items-center gap-3">
                                    {/* Botón Ver PDF - Oculto pero funcional */}
                                    {false && (file || localFilename) && (
                                        <button
                                            onClick={handleVerPdf}
                                            className="px-4 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest text-slate-600 bg-white border-2 border-slate-200 hover:border-blue-300 hover:text-blue-600 shadow-sm transition-all flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98]"
                                            title="Validar totales del extracto"
                                        >
                                            <ExternalLink size={14} className="stroke-[2.5px]" />
                                            Ver PDF
                                        </button>
                                    )}

                                    <button
                                        onClick={handleCargarDefinitivo}
                                        disabled={loading || !canUpload || isDescuadreBlocking}
                                        className={`px-5 py-2 rounded-xl font-black text-[11px] uppercase tracking-widest text-white shadow-md transition-all flex items-center gap-2
                                            ${(!canUpload || isDescuadreBlocking)
                                                ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                                : 'bg-emerald-500 hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98] shadow-emerald-100'
                                            }`}
                                    >
                                        <UploadCloud size={14} className="stroke-[3px]" />
                                        Confirmar y Cargar
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* 3. Tabla de Detalles - Flex expand para mayor espacio */}
                        {(hasDescuadre || showDetailsManually) && resumen.movimientos && (
                            <div className="flex-1 min-h-0 bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col">
                                <ExtractDetailsTable
                                    records={resumen.movimientos}
                                    onEdit={handleEditMovement}
                                    diferencias={resumen.validacion_cruzada ? {
                                        entradas: resumen.validacion_cruzada.diferencia_entradas,
                                        salidas: resumen.validacion_cruzada.diferencia_salidas,
                                        rendimientos: resumen.validacion_cruzada.diferencia_rendimientos,
                                        retenciones: resumen.validacion_cruzada.diferencia_retenciones
                                    } : undefined}
                                    esUSD={tipoCuenta.includes('USD') || tipoCuenta.includes('Dolares')}
                                />
                            </div>
                        )}
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-center gap-3 animate-in fade-in">
                        <AlertCircle className="h-5 w-5 text-rose-500" />
                        <p className="text-rose-700 text-sm font-medium">{error}</p>
                    </div>
                )}
            </div>

            {/* Modals */}
            <EditExtractMovementModal
                isOpen={showEditModal}
                onClose={() => setShowEditModal(false)}
                movimiento={editingMovement?.record}
                onSave={handleSaveMovement}
            />

            <Modal
                isOpen={showLocalModal}
                onClose={() => setShowLocalModal(false)}
                title="Seleccionar Archivo del Servidor"
                size="md"
                footer={
                    <Button variant="secondary" onClick={() => setShowLocalModal(false)}>
                        Cancelar
                    </Button>
                }
            >
                <div className="space-y-2 max-h-96 overflow-y-auto p-2">
                    {loadingFiles ? (
                        <div className="text-center py-4 text-slate-400 font-medium">Cargando archivos...</div>
                    ) : localFiles.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 font-medium">No se encontraron archivos en el servidor.</div>
                    ) : (
                        <div className="grid gap-2">
                            {localFiles.map(f => (
                                <button
                                    key={f}
                                    onClick={() => handleLocalFileSelect(f)}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left group"
                                >
                                    <FileText className="h-5 w-5 text-slate-300 group-hover:text-blue-500 transition-colors" />
                                    <span className="text-slate-700 font-bold group-hover:text-blue-700 transition-colors">{f}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </Modal>

            <Modal
                isOpen={showSuccessModal}
                onClose={() => { setShowSuccessModal(false); resetState() }}
                title="Carga Exitosa"
                size="md"
                footer={
                    <Button
                        onClick={() => { setShowSuccessModal(false); resetState() }}
                        className="w-full bg-blue-600 hover:bg-blue-700 font-bold rounded-xl h-11"
                    >
                        Entendido
                    </Button>
                }
            >
                <div className="text-center py-6 space-y-6">
                    <div className="flex justify-center">
                        <div className="bg-emerald-100 p-4 rounded-full inline-block animate-bounce shadow-sm shadow-emerald-50">
                            <CheckCircle className="text-emerald-600 w-12 h-12 stroke-[2.5px]" />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <h3 className="text-2xl font-black text-slate-900 tracking-tight">
                            {cuentaId ? cuentas.find(c => c.id === cuentaId)?.nombre : 'Cuenta Procesada'}
                        </h3>
                        <p className="text-blue-600 font-black uppercase tracking-widest text-xs">
                            {result?.periodo || 'Periodo Procesado'}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50/80 p-5 rounded-3xl border border-slate-100 group transition-all hover:bg-white hover:shadow-md">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 block">Total Leídos</span>
                            <span className="text-3xl font-black text-slate-800 tabular-nums">
                                {result?.stats?.leidos || 0}
                            </span>
                        </div>
                        <div className="bg-blue-50/50 p-5 rounded-3xl border border-blue-100 group transition-all hover:bg-white hover:shadow-md">
                            <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest mb-2 block">Cargados</span>
                            <span className="text-3xl font-black text-blue-600 tabular-nums">
                                {result?.stats?.nuevos || 0}
                            </span>
                        </div>
                        <div className="bg-orange-50/50 p-5 rounded-3xl border border-orange-100 group transition-all hover:bg-white hover:shadow-md">
                            <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest mb-2 block">Duplicados</span>
                            <span className="text-3xl font-black text-orange-600 tabular-nums">
                                {result?.stats?.duplicados || 0}
                            </span>
                        </div>
                        <div className="bg-rose-50/50 p-5 rounded-3xl border border-rose-100 group transition-all hover:bg-white hover:shadow-md">
                            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-2 block">Errores</span>
                            <span className="text-3xl font-black text-rose-600 tabular-nums">
                                {result?.stats?.errores || 0}
                            </span>
                        </div>
                    </div>
                </div>
            </Modal>

            {/* Modal para ver PDF - izquierda, sobre menú lateral */}
            {showPdfModal && pdfUrl && (
                <div className="fixed inset-0 z-50 flex items-center justify-start">
                    {/* Overlay transparente */}
                    <div
                        className="absolute inset-0 bg-black/15"
                        onClick={handleClosePdfModal}
                    />

                    {/* Panel del PDF - 35% ancho, 50% alto, alineado a la izquierda */}
                    <div className="w-[35%] h-[50%] ml-4 bg-white shadow-2xl relative flex flex-col rounded-xl overflow-hidden animate-in slide-in-from-left duration-200">
                        {/* Header */}
                        <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <span className="font-bold text-xs text-slate-700">Extracto PDF</span>
                            <button
                                onClick={handleClosePdfModal}
                                className="p-1 rounded hover:bg-slate-200 text-slate-500"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </button>
                        </div>

                        {/* PDF Viewer - sin thumbnails, con zoom y scroll */}
                        <div className="flex-1 bg-slate-100 overflow-auto">
                            <iframe
                                src={`${pdfUrl}#page=${pdfPage}&zoom=150&navpanes=0&scrollbar=1`}
                                className="w-full h-full border-0"
                                title="Extracto PDF"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
