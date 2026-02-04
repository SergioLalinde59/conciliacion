import React, { useState, useEffect, useRef } from 'react'
import { apiService } from '../services/api'
import type { Cuenta } from '../types'
import { UploadCloud, FileText, AlertCircle, FolderOpen } from 'lucide-react'
import { Modal } from '../components/molecules/Modal'
import { Button } from '../components/atoms/Button'
import { LoadResultSummary } from '../components/molecules/LoadResultSummary'

// Subcomponent for Stats - Premium Style
const StatCard = ({ label, value, secondaryValue, icon, colorClass, bgColorClass, borderColor, isCurrency = true }: any) => {
    return (
        <div className={`group bg-white p-5 rounded-2xl shadow-sm border border-slate-200/60 flex items-center justify-between transition-all duration-300 hover:shadow-md ${borderColor || ''}`}>
            <div className="space-y-1">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
                <div className={`text-2xl font-black tracking-tight ${colorClass} flex items-baseline gap-2`}>
                    {isCurrency
                        ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value))
                        : value}
                    {secondaryValue !== undefined && secondaryValue !== null && (
                        <span className="text-sm opacity-40 font-medium text-slate-400">/ {secondaryValue}</span>
                    )}
                </div>
            </div>
            <div className={`p-3.5 ${bgColorClass} ${colorClass} rounded-2xl group-hover:scale-110 transition-transform duration-300 shadow-sm shadow-inner`}>
                {icon}
            </div>
        </div>
    );
};

export const UploadMovimientosPage: React.FC = () => {
    const [file, setFile] = useState<File | null>(null)
    const [tipoCuenta, setTipoCuenta] = useState('')
    const [cuentaId, setCuentaId] = useState<number | null>(null)
    const [cuentas, setCuentas] = useState<Cuenta[]>([])

    // Status
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)

    // Local Files State
    const [localFilename, setLocalFilename] = useState<string | null>(null)
    const [showLocalModal, setShowLocalModal] = useState(false)
    const [localFiles, setLocalFiles] = useState<string[]>([])
    const [loadingFiles, setLoadingFiles] = useState(false)

    // Modal Success State
    const [showSuccessModal, setShowSuccessModal] = useState(false)

    // Ref for file input
    const fileInputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        // Load accounts
        apiService.cuentas.listar()
            .then(setCuentas)
            .catch(err => console.error(err))
    }, [])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0])
            setLocalFilename(null)
            setResult(null)
            setError(null)
            setShowSuccessModal(false)
        }
    }

    const handleOpenLocalPicker = async () => {
        setLoadingFiles(true)
        setShowLocalModal(true)
        try {
            const files = await apiService.archivos.listarDirectorios('movimientos')
            setLocalFiles(files)
        } catch (err: any) {
            console.error(err)
            setError("Error al listar archivos del servidor")
        } finally {
            setLoadingFiles(false)
        }
    }

    const handleLocalFileSelect = async (filename: string) => {
        setShowLocalModal(false)
        setLocalFilename(filename)
        setFile(null)
        if (fileInputRef.current) fileInputRef.current.value = ''

        // Trigger analysis immediately
        await handleAnalizarLocal(filename)
    }

    // State for analysis mode
    const [analyzed, setAnalyzed] = useState(false)
    const [stats, setStats] = useState<{ leidos: number, duplicados: number, nuevos: number, actualizables?: number } | null>(null)
    const [movimientosPreview, setMovimientosPreview] = useState<any[]>([])
    const [updateExisting, setUpdateExisting] = useState(false)

    const handleAnalizar = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!file) return

        setLoading(true)
        setError(null)
        setResult(null)
        setStats(null)
        setMovimientosPreview([])
        setUpdateExisting(true)

        try {
            const data = await apiService.archivos.analizar(file, tipoCuenta, cuentaId || undefined)
            setStats(data.estadisticas)
            setMovimientosPreview(data.movimientos)
            setAnalyzed(true)
        } catch (err: any) {
            setError(err.message || "Error al analizar archivo")
        } finally {
            setLoading(false)
        }
    }

    const handleAnalizarLocal = async (filename: string) => {
        setLoading(true)
        setError(null)
        setResult(null)
        setStats(null)
        setMovimientosPreview([])
        setUpdateExisting(true)

        try {
            const data = await apiService.archivos.procesarLocal(
                filename,
                'movimientos',
                tipoCuenta,
                cuentaId || undefined,
                false,
                undefined, undefined,
                'analizar'
            )
            setStats(data.estadisticas)
            setMovimientosPreview(data.movimientos)
            setAnalyzed(true)
        } catch (err: any) {
            setError(err.message || "Error al analizar archivo local")
        } finally {
            setLoading(false)
        }
    }

    const handleCargarDefinitivo = async () => {
        if ((!file && !localFilename) || !cuentaId) return

        setLoading(true)
        try {
            let data;
            if (localFilename) {
                data = await apiService.archivos.procesarLocal(
                    localFilename,
                    'movimientos',
                    tipoCuenta,
                    cuentaId,
                    updateExisting,
                    undefined, undefined,
                    'cargar'
                )
            } else if (file) {
                data = await apiService.archivos.cargar(file, tipoCuenta, cuentaId, updateExisting)
            }

            setResult(data)
            setShowSuccessModal(true)
            setAnalyzed(false)
            setFile(null)
            setLocalFilename(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        } catch (err: any) {
            setError(err.message || "Error al cargar movimientos")
        } finally {
            setLoading(false)
        }
    }

    // Reset analysis if file changes
    useEffect(() => {
        setAnalyzed(false)
        setStats(null)
        setUpdateExisting(false)
    }, [file, tipoCuenta])

    const handleCloseSuccessModal = () => {
        setShowSuccessModal(false)
        setResult(null)
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Header section */}
            <div className="px-6 pt-6 pb-2 bg-white">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-sm border border-blue-100">
                        <UploadCloud size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Cargar Movimientos Bancarios</h1>
                        <p className="text-slate-500 text-sm mt-1">Sube archivos PDF de extractos bancarios para procesar nuevos movimientos</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto flex flex-col">
                {/* 1. Selección */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
                    <form onSubmit={handleAnalizar} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-2">Cuenta Asociada</label>
                                <select
                                    value={cuentaId || ''}
                                    onChange={(e) => {
                                        const id = Number(e.target.value)
                                        setCuentaId(id)
                                        setFile(null)
                                        setLocalFilename(null)
                                        if (fileInputRef.current) fileInputRef.current.value = ''
                                        setAnalyzed(false)
                                        setStats(null)
                                        setMovimientosPreview([])
                                        setResult(null)
                                        setError(null)
                                        const cuenta = cuentas.find(c => c.id === id)
                                        if (cuenta) {
                                            setTipoCuenta(cuenta.nombre)
                                        }
                                    }}
                                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 py-2.5"
                                >
                                    <option value="">Seleccione una cuenta...</option>
                                    {cuentas.filter(c => c.permite_carga).map(c => (
                                        <option key={c.id} value={c.id}>{c.nombre}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                            <input
                                type="file"
                                id="file-upload"
                                accept=".pdf"
                                onChange={handleFileChange}
                                className="hidden"
                                ref={fileInputRef}
                            />
                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                <FileText className={`h-12 w-12 mb-2 ${file ? 'text-blue-500' : 'text-gray-400'}`} />
                                <span className="text-lg font-medium text-gray-700">
                                    {file ? file.name : localFilename ? `(Servidor) ${localFilename}` : "Seleccionar archivo PDF"}
                                </span>
                                <span className="text-sm text-gray-500 mt-1">
                                    {file ? `${(file.size / 1024).toFixed(1)} KB` : "Haz clic para buscar en tu equipo"}
                                </span>
                            </label>
                        </div>

                        <div className="text-center">
                            <span className="text-sm text-gray-500">¿El archivo está en el servidor?</span>
                            <button
                                type="button"
                                onClick={handleOpenLocalPicker}
                                className="ml-2 text-sm text-blue-600 hover:text-blue-800 font-medium underline inline-flex items-center gap-1"
                            >
                                <FolderOpen size={14} />
                                Explorar Carpeta Predeterminada
                            </button>
                        </div>

                        {!analyzed && !result && (
                            <button
                                type="submit"
                                disabled={loading || (!file && !localFilename)}
                                className={`w-full py-3 px-4 rounded-lg font-medium text-white shadow-sm transition-colors
                                ${loading || (!file && !localFilename)
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-blue-600 hover:bg-blue-700'
                                    }`}
                            >
                                {loading ? 'Analizando...' : 'Analizar Archivo'}
                            </button>
                        )}
                    </form>
                </div>

                {/* 2. Estadísticas de Validación */}
                {stats && analyzed && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <StatCard
                            label="Registros Leídos"
                            value={stats.leidos}
                            icon={<FileText className="w-5 h-5" />}
                            colorClass="text-slate-600"
                            bgColorClass="bg-slate-50"
                            borderColor="group-hover:border-slate-300"
                            isCurrency={false}
                        />
                        <StatCard
                            label="Duplicados"
                            value={stats.duplicados}
                            icon={<AlertCircle className="w-5 h-5" />}
                            colorClass="text-orange-600"
                            bgColorClass="bg-orange-50"
                            borderColor="group-hover:border-orange-200"
                            isCurrency={false}
                        />
                        <StatCard
                            label="Actualizables"
                            value={stats.actualizables || 0}
                            icon={<UploadCloud className="w-5 h-5" />}
                            colorClass="text-blue-600"
                            bgColorClass="bg-blue-50"
                            borderColor="group-hover:border-blue-200"
                            isCurrency={false}
                        />
                        <StatCard
                            label="A Cargar"
                            value={stats.nuevos}
                            icon={<UploadCloud className="w-5 h-5" />}
                            colorClass="text-green-600"
                            bgColorClass="bg-green-50"
                            borderColor="group-hover:border-green-200"
                            isCurrency={false}
                        />
                    </div>
                )}

                {/* 3. Previsualización de Datos */}
                {movimientosPreview.length > 0 && (
                    <div className="flex-1 min-h-[400px] bg-white rounded-3xl shadow-sm border border-slate-200 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="flex justify-between items-center bg-slate-50/50 p-4 border-b border-slate-100">
                            <h3 className="font-black text-slate-800 text-[11px] uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                                Previsualización de Datos Extraídos
                                <span className="ml-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                    {movimientosPreview.length}
                                </span>
                            </h3>
                        </div>

                        <div className="flex-1 overflow-auto relative">
                            <table className="min-w-full divide-y divide-gray-200 border-separate border-spacing-0">
                                <thead className="bg-slate-50 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Estado</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Fecha</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Descripción</th>
                                        <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider text-center border-b border-slate-100">Referencia</th>
                                        <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Moneda</th>
                                        <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider border-b border-slate-100">Valor</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-slate-100 text-sm">
                                    {movimientosPreview.map((mov, idx) => (
                                        <tr key={idx} className={`${mov.es_duplicado ? "bg-orange-50/30 text-slate-500" : mov.es_actualizable ? "bg-blue-50/30 text-slate-700" : "hover:bg-slate-50"} transition-colors`}>
                                            <td className="px-4 py-2.5 whitespace-nowrap">
                                                {mov.es_duplicado ? (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 text-orange-700 uppercase">
                                                        Duplicado
                                                    </span>
                                                ) : mov.es_actualizable ? (
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 uppercase">
                                                            Actualizable
                                                        </span>
                                                        {mov.descripcion_actual && (
                                                            <span className="text-[9px] text-blue-500 font-medium" title={mov.descripcion_actual}>
                                                                (Exist: {mov.descripcion_actual.substring(0, 15)}...)
                                                            </span>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 uppercase">
                                                        Nuevo
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2.5 whitespace-nowrap font-medium text-slate-600 text-[12px]">{mov.fecha}</td>
                                            <td className="px-4 py-2.5 text-slate-700 text-[12px] leading-tight">{mov.descripcion}</td>
                                            <td className="px-4 py-2.5 font-mono text-[11px] text-center text-slate-500">{mov.referencia || '-'}</td>
                                            <td className="px-4 py-2.5 text-center text-[10px] font-bold text-slate-400">{mov.moneda}</td>
                                            <td className={`px-4 py-2.5 text-right font-bold text-[13px] ${(() => {
                                                const val = Number(mov.valor);
                                                if (val > 0) return 'text-emerald-600';
                                                if (val < 0) return 'text-rose-600';
                                                return 'text-blue-600';
                                            })()
                                                }`}>
                                                {new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(mov.valor))}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* 4. Footer Actions */}
                {stats && analyzed && (
                    <div className="flex flex-col gap-4 p-6 bg-slate-50/50 rounded-3xl border border-slate-200">
                        {(stats.actualizables || 0) > 0 && (
                            <div className="flex items-center gap-3 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                                <input
                                    type="checkbox"
                                    id="updateExisting"
                                    checked={updateExisting}
                                    onChange={(e) => setUpdateExisting(e.target.checked)}
                                    className="h-5 w-5 text-blue-600 rounded-lg border-slate-300 focus:ring-blue-500"
                                />
                                <label htmlFor="updateExisting" className="text-sm font-semibold text-blue-900 cursor-pointer">
                                    Actualizar descripción de {stats.actualizables} registros existentes (Misma Fecha y Valor)
                                    <span className="block text-xs font-medium text-blue-600 mt-0.5">
                                        Si se desmarca, se crearán como nuevos registros.
                                    </span>
                                </label>
                            </div>
                        )}

                        <div className="flex justify-end gap-4">
                            <button
                                onClick={() => {
                                    setAnalyzed(false)
                                    setStats(null)
                                    setMovimientosPreview([])
                                    setFile(null)
                                    setLocalFilename(null)
                                    setCuentaId(null)
                                    setTipoCuenta('')
                                    if (fileInputRef.current) {
                                        fileInputRef.current.value = ''
                                    }
                                }}
                                className="px-6 py-2.5 text-slate-500 hover:text-slate-700 font-bold text-[13px] transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleCargarDefinitivo}
                                disabled={!cuentaId || (stats.nuevos + (stats.actualizables || 0)) === 0}
                                className={`px-8 py-2.5 rounded-xl font-black text-[13px] uppercase tracking-widest text-white shadow-lg shadow-green-100 transition-all flex items-center gap-2
                                    ${!cuentaId || (stats.nuevos + (stats.actualizables || 0)) === 0
                                        ? 'bg-slate-300 cursor-not-allowed shadow-none'
                                        : 'bg-emerald-500 hover:bg-emerald-600 hover:scale-[1.02] active:scale-[0.98]'
                                    }`}
                            >
                                <UploadCloud size={18} className="stroke-[3px]" />
                                {(stats.nuevos + (stats.actualizables || 0)) > 0 ? `Cargar/Actualizar ${stats.nuevos + (stats.actualizables || 0)} Registros` : 'Nada nuevo para cargar'}
                            </button>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200 flex items-center gap-3">
                        <AlertCircle className="h-5 w-5 text-rose-500" />
                        <p className="text-rose-700 text-sm font-medium">{error}</p>
                    </div>
                )}
            </div>

            <Modal
                isOpen={showLocalModal}
                onClose={() => setShowLocalModal(false)}
                title="Seleccionar Archivo del Servidor"
                size="xl"
                footer={
                    <Button variant="secondary" onClick={() => setShowLocalModal(false)}>
                        Cancelar
                    </Button>
                }
            >
                <div className="space-y-4 max-h-96 overflow-y-auto p-2">
                    {loadingFiles ? (
                        <div className="text-center py-4 text-slate-400 font-medium">Cargando archivos...</div>
                    ) : localFiles.length === 0 ? (
                        <div className="text-center py-4 text-slate-400 font-medium">No se encontraron archivos PDF en el directorio configurado.</div>
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
                    <p className="text-[10px] text-slate-400 text-center mt-4 font-bold uppercase tracking-widest">
                        Directorio: {`MovimientosPendientes`}
                    </p>
                </div>
            </Modal>

            <Modal
                isOpen={showSuccessModal}
                onClose={handleCloseSuccessModal}
                title="Resultado de la Carga"
                size="md"
                footer={
                    <Button onClick={handleCloseSuccessModal} className="w-full">
                        Entendido
                    </Button>
                }
            >
                {result && (
                    <LoadResultSummary
                        result={result}
                        tipoCuenta={tipoCuenta}
                        cuentaId={cuentaId}
                    />
                )}
            </Modal>
        </div>
    )
}
