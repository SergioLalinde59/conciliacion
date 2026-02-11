import React, { useState, useEffect, useRef, useMemo } from 'react'
import { apiService } from '../services/api'
import { UploadCloud, FileText, FileSpreadsheet, AlertCircle, FolderOpen, Database } from 'lucide-react'
import { Modal } from '../components/molecules/Modal'
import { Button } from '../components/atoms/Button'
import { LoadResultSummary } from '../components/molecules/LoadResultSummary'
import { SelectorCuenta } from '../components/molecules/SelectorCuenta'
import { StatCard } from '../components/molecules/StatCard'
import { DataTable } from '../components/molecules/DataTable'
import { TableHeaderCell } from '../components/atoms/TableHeaderCell'
import { fechaColumn, monedaColumn, textoColumn } from '../components/atoms/columnHelpers'
import { useCatalogo } from '../hooks/useCatalogo'

type ExtractoRegistro = {
    id: number
    cuenta_id: number
    fecha: string
    descripcion: string
    referencia: string
    valor: number
    usd: number | null
    year: number
    month: number
}

type ExtractosPorCuenta = Record<number, {
    cuenta_nombre: string
    total: number
    ingresos: number
    egresos: number
    ingresos_usd: number | null
    egresos_usd: number | null
    registros: ExtractoRegistro[]
}>

export const UploadMovimientosPage: React.FC = () => {
    const [tipoArchivo, setTipoArchivo] = useState<'xlsx' | 'pdf'>('xlsx')
    const [file, setFile] = useState<File | null>(null)
    const [tipoCuenta, setTipoCuenta] = useState('')
    const [cuentaId, setCuentaId] = useState<number | null>(null)

    // Cuentas desde catálogo centralizado
    const { cuentas } = useCatalogo()

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

    // Extractos existentes por cuenta (cargados al inicio)
    const [extractosPorCuenta, setExtractosPorCuenta] = useState<ExtractosPorCuenta>({})
    const [loadingExtractos, setLoadingExtractos] = useState(false)

    // Ref for file input
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Cargar extractos de todas las cuentas al montar
    useEffect(() => {
        const cargarExtractos = async () => {
            setLoadingExtractos(true)
            try {
                const data = await apiService.archivos.obtenerExtractosTodasCuentas(50)
                setExtractosPorCuenta(data)
            } catch (err) {
                console.error('Error cargando extractos existentes:', err)
            } finally {
                setLoadingExtractos(false)
            }
        }
        cargarExtractos()
    }, [])

    // Extractos de la cuenta seleccionada
    const extractosCuentaActual = useMemo(() => {
        if (!cuentaId || !extractosPorCuenta[cuentaId]) return null
        return extractosPorCuenta[cuentaId]
    }, [cuentaId, extractosPorCuenta])

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
    const [filtroEstado, setFiltroEstado] = useState<'todos' | 'duplicados' | 'actualizables' | 'nuevos' | ''>('todos')
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
        setFiltroEstado('todos')
    }, [file, tipoCuenta, tipoArchivo])

    const conteoFiltros = useMemo(() => ({
        todos: movimientosPreview.length,
        duplicados: movimientosPreview.filter((m: any) => m.es_duplicado).length,
        actualizables: movimientosPreview.filter((m: any) => m.es_actualizable).length,
        nuevos: movimientosPreview.filter((m: any) => !m.es_duplicado && !m.es_actualizable).length,
    }), [movimientosPreview])

    const movimientosFiltrados = useMemo(() => {
        switch (filtroEstado) {
            case 'duplicados': return movimientosPreview.filter((m: any) => m.es_duplicado);
            case 'actualizables': return movimientosPreview.filter((m: any) => m.es_actualizable);
            case 'nuevos': return movimientosPreview.filter((m: any) => !m.es_duplicado && !m.es_actualizable);
            default: return movimientosPreview;
        }
    }, [filtroEstado, movimientosPreview])

    useEffect(() => {
        if (conteoFiltros.nuevos > 0) {
            setFiltroEstado('nuevos')
        } else if (conteoFiltros.actualizables > 0) {
            setFiltroEstado('actualizables')
        } else {
            setFiltroEstado('')
        }
    }, [conteoFiltros])

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
                        <p className="text-slate-500 text-sm mt-1">Carga los movimientos bancarios a procesar</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-4 space-y-4 overflow-y-auto flex flex-col">
                {/* 1. Selección */}
                <div className="bg-white rounded-3xl shadow-sm border border-slate-200 p-6 space-y-6">
                    <form onSubmit={handleAnalizar} className="space-y-4">
                        {/* Selector tipo de archivo */}
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Tipo de Archivo</label>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => { setTipoArchivo('xlsx'); setFile(null); setLocalFilename(null); setAnalyzed(false); setStats(null); setMovimientosPreview([]); if (fileInputRef.current) fileInputRef.current.value = '' }}
                                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border-2 font-bold text-sm transition-all duration-200 ${
                                        tipoArchivo === 'xlsx'
                                            ? 'border-emerald-400 bg-emerald-50 text-emerald-700 shadow-sm shadow-emerald-100'
                                            : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-500'
                                    }`}
                                >
                                    <FileSpreadsheet size={20} className={tipoArchivo === 'xlsx' ? 'text-emerald-500' : 'text-slate-300'} />
                                    Excel (.xlsx)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setTipoArchivo('pdf'); setFile(null); setLocalFilename(null); setAnalyzed(false); setStats(null); setMovimientosPreview([]); if (fileInputRef.current) fileInputRef.current.value = '' }}
                                    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-xl border-2 font-bold text-sm transition-all duration-200 ${
                                        tipoArchivo === 'pdf'
                                            ? 'border-red-400 bg-red-50 text-red-700 shadow-sm shadow-red-100'
                                            : 'border-slate-200 bg-white text-slate-400 hover:border-slate-300 hover:text-slate-500'
                                    }`}
                                >
                                    <FileText size={20} className={tipoArchivo === 'pdf' ? 'text-red-500' : 'text-slate-300'} />
                                    PDF
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <SelectorCuenta
                                    value={cuentaId || ''}
                                    onChange={(value) => {
                                        const id = Number(value)
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
                                    label="Cuenta Asociada"
                                    soloPermiteCarga={true}
                                    soloConciliables={false}
                                />
                            </div>
                        </div>

                        {/* Registros existentes de la cuenta */}
                        {cuentaId && extractosCuentaActual && extractosCuentaActual.total > 0 && (
                            <div className="bg-amber-50/50 border border-amber-200 rounded-xl p-4">
                                {/* Estadísticas resumen */}
                                <div className="grid grid-cols-3 gap-3 mb-4">
                                    <div className="bg-white rounded-lg p-3 border border-amber-100 text-center">
                                        <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wide">Registros</p>
                                        <p className="text-lg font-black text-amber-800">{extractosCuentaActual.total}</p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-emerald-100 text-center">
                                        <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Ingresos</p>
                                        <p className="text-lg font-black text-emerald-600">
                                            {extractosCuentaActual.ingresos_usd !== null
                                                ? `US$ ${extractosCuentaActual.ingresos_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                                : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(extractosCuentaActual.ingresos)
                                            }
                                        </p>
                                    </div>
                                    <div className="bg-white rounded-lg p-3 border border-rose-100 text-center">
                                        <p className="text-[10px] font-bold text-rose-600 uppercase tracking-wide">Egresos</p>
                                        <p className="text-lg font-black text-rose-600">
                                            {extractosCuentaActual.egresos_usd !== null
                                                ? `US$ ${extractosCuentaActual.egresos_usd.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                                                : new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(extractosCuentaActual.egresos)
                                            }
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 mb-2">
                                    <Database size={14} className="text-amber-500" />
                                    <span className="font-medium text-amber-700 text-xs">
                                        Últimos movimientos
                                        {extractosCuentaActual.total > extractosCuentaActual.registros.length && (
                                            <span className="text-amber-500 ml-1">
                                                ({extractosCuentaActual.registros.length} de {extractosCuentaActual.total})
                                            </span>
                                        )}
                                    </span>
                                </div>
                                <div className="bg-white rounded-lg border border-amber-100">
                                    <DataTable<ExtractoRegistro>
                                        data={extractosCuentaActual.registros}
                                        getRowKey={(r) => r.id}
                                        rowPy="py-1"
                                        stickyHeader
                                        maxHeight={160}
                                        showActions={false}
                                        rounded={false}
                                        columns={[
                                            fechaColumn<ExtractoRegistro>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, (r) => r.fecha, { width: 'w-24' }),
                                            textoColumn<ExtractoRegistro>('descripcion', <TableHeaderCell>Descripción</TableHeaderCell>, (r) => r.descripcion, {
                                                cellClassName: 'truncate max-w-[200px] text-[12px] text-slate-700',
                                            }),
                                            monedaColumn<ExtractoRegistro>('valor', <TableHeaderCell>Valor</TableHeaderCell>,
                                                (r) => r.usd !== null ? r.usd : r.valor,
                                                (r) => r.usd !== null ? 'USD' : 'COP',
                                                { decimals: 0 }
                                            ),
                                        ]}
                                    />
                                </div>
                                <p className="text-[10px] text-amber-600 mt-2 font-medium">
                                    Estos registros serán reemplazados al cargar un nuevo extracto del mismo período.
                                </p>
                            </div>
                        )}

                        {cuentaId && loadingExtractos && (
                            <div className="text-center py-2 text-slate-400 text-sm">Cargando registros existentes...</div>
                        )}

                        {cuentaId && !loadingExtractos && extractosCuentaActual && extractosCuentaActual.total === 0 && (
                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                                <Database size={24} className="mx-auto text-slate-300 mb-2" />
                                <p className="text-slate-500 text-sm">No hay registros de extracto para esta cuenta</p>
                            </div>
                        )}

                        <div className={`border-2 border-dashed rounded-lg p-6 text-center hover:bg-gray-50 transition-colors ${
                            tipoArchivo === 'xlsx' ? 'border-emerald-300' : 'border-red-300'
                        }`}>
                            <input
                                type="file"
                                id="file-upload"
                                accept={tipoArchivo === 'xlsx' ? '.xlsx' : '.pdf'}
                                onChange={handleFileChange}
                                className="hidden"
                                ref={fileInputRef}
                            />
                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                                {tipoArchivo === 'xlsx'
                                    ? <FileSpreadsheet className={`h-12 w-12 mb-2 ${file ? 'text-emerald-500' : 'text-gray-400'}`} />
                                    : <FileText className={`h-12 w-12 mb-2 ${file ? 'text-red-500' : 'text-gray-400'}`} />
                                }
                                <span className="text-lg font-medium text-gray-700">
                                    {file ? file.name : localFilename ? `(Servidor) ${localFilename}` : tipoArchivo === 'xlsx' ? "Seleccionar archivo Excel (.xlsx)" : "Seleccionar archivo PDF"}
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
                                    {movimientosFiltrados.length}
                                    {filtroEstado !== 'todos' && filtroEstado !== '' && <span className="opacity-60"> / {movimientosPreview.length}</span>}
                                </span>
                            </h3>
                        </div>

                        <div className="px-4 py-2.5 border-b border-slate-100 bg-white">
                            <div className="flex gap-1.5 flex-wrap">
                                {[
                                    { key: 'todos', label: 'Todos', active: 'bg-slate-700 text-white' },
                                    { key: 'duplicados', label: 'Duplicados', active: 'bg-orange-100 text-orange-700' },
                                    { key: 'actualizables', label: 'Actualizables', active: 'bg-blue-100 text-blue-700' },
                                    { key: 'nuevos', label: 'A Cargar', active: 'bg-emerald-100 text-emerald-700' },
                                ].map(f => (
                                    <button
                                        key={f.key}
                                        onClick={() => setFiltroEstado(f.key as typeof filtroEstado)}
                                        className={`px-3 py-1 rounded-full text-[11px] font-bold transition-all duration-200 ${
                                            filtroEstado === f.key
                                                ? f.active
                                                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                        }`}
                                    >
                                        {f.label}
                                        <span className="ml-1.5 opacity-70">({conteoFiltros[f.key as keyof typeof conteoFiltros]})</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                            <DataTable
                                data={movimientosFiltrados}
                                getRowKey={(_row: any, idx: number) => idx}
                                rowPy="py-1.5"
                                stickyHeader
                                showActions={false}
                                rounded={false}
                                className="border-none"
                                maxHeight="none"
                                style={{ flex: 1, minHeight: 0 }}
                                columns={[
                                    {
                                        key: 'estado',
                                        header: <TableHeaderCell>Estado</TableHeaderCell>,
                                        width: 'w-28',
                                        accessor: (mov: any) => (
                                            mov.es_duplicado ? (
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
                                            )
                                        )
                                    },
                                    fechaColumn<any>('fecha', <TableHeaderCell>Fecha</TableHeaderCell>, (mov) => mov.fecha, { width: 'w-24' }),
                                    textoColumn<any>('descripcion', <TableHeaderCell>Descripción</TableHeaderCell>, (mov) => mov.descripcion),
                                    textoColumn<any>('referencia', <TableHeaderCell>Referencia</TableHeaderCell>, (mov) => mov.referencia || '-', {
                                        align: 'center',
                                        cellClassName: 'font-mono text-[11px] text-slate-500',
                                        width: 'w-28',
                                    }),
                                    textoColumn<any>('moneda', <TableHeaderCell>Moneda</TableHeaderCell>, (mov) => mov.moneda, {
                                        align: 'center',
                                        cellClassName: 'text-[10px] font-bold text-slate-400',
                                        width: 'w-20',
                                    }),
                                    monedaColumn<any>('valor', <TableHeaderCell>Valor</TableHeaderCell>, (mov) => Number(mov.valor), 'COP', { decimals: 0 }),
                                ]}
                            />
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
                    ) : localFiles.filter(f => f.toLowerCase().endsWith(tipoArchivo === 'xlsx' ? '.xlsx' : '.pdf')).length === 0 ? (
                        <div className="text-center py-4 text-slate-400 font-medium">No se encontraron archivos {tipoArchivo === 'xlsx' ? 'Excel (.xlsx)' : 'PDF'} en el directorio configurado.</div>
                    ) : (
                        <div className="grid gap-2">
                            {localFiles.filter(f => f.toLowerCase().endsWith(tipoArchivo === 'xlsx' ? '.xlsx' : '.pdf')).map(f => (
                                <button
                                    key={f}
                                    onClick={() => handleLocalFileSelect(f)}
                                    className="flex items-center gap-3 p-4 rounded-2xl border border-slate-100 hover:bg-blue-50/50 hover:border-blue-200 transition-all text-left group"
                                >
                                    {f.toLowerCase().endsWith('.xlsx')
                                        ? <FileSpreadsheet className="h-5 w-5 text-emerald-400 group-hover:text-emerald-600 transition-colors" />
                                        : <FileText className="h-5 w-5 text-red-300 group-hover:text-red-500 transition-colors" />
                                    }
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
