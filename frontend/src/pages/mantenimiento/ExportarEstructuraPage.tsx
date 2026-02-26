import React, { useState } from 'react'
import { HardDrive, Save, Loader2, ChevronDown, ChevronRight, Database, Shield, CheckCircle2, FileText } from 'lucide-react'
import { API_BASE_URL } from '../../services/httpClient'
import { toast } from 'react-hot-toast'

const TABLAS_CON_DATOS = [
    { id: 'cuentas', label: 'Cuentas' },
    { id: 'monedas', label: 'Monedas' },
    { id: 'tipomov', label: 'Tipos de Movimiento' },
    { id: 'terceros', label: 'Terceros' },
    { id: 'tercero_descripciones', label: 'Alias Terceros' },
    { id: 'centro_costos', label: 'Centros de Costos' },
    { id: 'conceptos', label: 'Conceptos' },
    { id: 'tipo_cuenta', label: 'Tipos de Cuenta' },
    { id: 'config_filtros_centro_costos', label: 'Filtros CC Excluidos' },
    { id: 'config_valores_pendientes', label: 'Config. Valores Pendientes' },
    { id: 'reglas_clasificacion', label: 'Reglas de Clasificación' },
    { id: 'matching_alias', label: 'Reglas Normalización' },
    { id: 'cuenta_extractores', label: 'Extractores por Cuenta' },
    { id: 'configuracion_matching', label: 'Config. Matching' },
    { id: 'tipos_gasto', label: 'Tipos de Gasto' },
    { id: 'indicadores_economicos', label: 'Indicadores Económicos' },
    { id: 'reglas_presupuesto', label: 'Reglas de Presupuesto' },
    { id: 'perspectivas', label: 'Perspectivas' },
]

const TABLAS_SIN_DATOS = [
    { id: 'conciliaciones', label: 'Conciliaciones' },
    { id: 'movimientos_encabezado', label: 'Movimientos (Encabezado)' },
    { id: 'movimientos_detalle', label: 'Movimientos (Detalle)' },
    { id: 'movimientos_extracto', label: 'Movimientos Extracto Bancario' },
    { id: 'movimiento_vinculaciones', label: 'Vinculaciones (Matches)' },
    { id: 'presupuestos', label: 'Presupuestos' },
    { id: 'presupuesto_detalle', label: 'Presupuesto Detalle' },
    { id: 'presupuesto_versiones', label: 'Versiones de Presupuesto' },
]

interface ExportResult {
    mensaje: string
    archivo: string
    ruta: string
    size: number
}

export const ExportarEstructuraPage: React.FC = () => {
    const [generating, setGenerating] = useState(false)
    const [showConDatos, setShowConDatos] = useState(false)
    const [showSinDatos, setShowSinDatos] = useState(false)
    const [lastExport, setLastExport] = useState<ExportResult | null>(null)

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        return `${(bytes / 1024).toFixed(0)} KB`
    }

    const handleGenerate = async () => {
        setGenerating(true)
        setLastExport(null)
        try {
            const response = await fetch(`${API_BASE_URL}/api/admin/exportar-estructura`)

            if (!response.ok) {
                const error = await response.json()
                throw new Error(error.detail || 'Error al exportar')
            }

            const data: ExportResult = await response.json()
            setLastExport(data)
            toast.success(`Script generado: ${data.archivo}`)
        } catch (error: any) {
            console.error('Error exportando estructura', error)
            toast.error(error.message || 'Error al exportar estructura')
        } finally {
            setGenerating(false)
        }
    }

    return (
        <div className="max-w-3xl mx-auto p-6">
            {/* Header */}
            <div className="flex items-center gap-4 mb-8">
                <div className="p-3 bg-indigo-100 text-indigo-600 rounded-xl">
                    <HardDrive size={32} />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Exportar BD Estructura</h1>
                    <p className="text-gray-500">Genera un script SQL para recrear la base de datos en otra máquina.</p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
                {/* Descripción */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
                    <Database className="text-blue-600 h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-blue-800">
                        <strong>El script incluye:</strong>
                        <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5">
                            <li>Estructura completa (CREATE TABLE, constraints, indexes) de <strong>todas</strong> las tablas</li>
                            <li>Datos (INSERT) de tablas maestras y configuración ({TABLAS_CON_DATOS.length} tablas)</li>
                            <li>Tablas operativas vacías — solo estructura ({TABLAS_SIN_DATOS.length} tablas)</li>
                        </ul>
                    </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex gap-3">
                    <Shield className="text-green-600 h-5 w-5 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-green-800">
                        <strong>La base de datos original no se modifica.</strong>
                        <p className="mt-1">Esta operación es de solo lectura — genera y descarga el archivo .sql sin alterar ningún dato.</p>
                    </div>
                </div>

                {/* Tablas con datos */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setShowConDatos(!showConDatos)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-emerald-50 hover:bg-emerald-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            {showConDatos ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="font-bold text-emerald-800 text-sm">
                                Tablas con datos ({TABLAS_CON_DATOS.length})
                            </span>
                        </div>
                        <span className="text-xs bg-emerald-200 text-emerald-800 px-2 py-0.5 rounded-full font-bold">
                            Estructura + INSERT
                        </span>
                    </button>
                    {showConDatos && (
                        <div className="divide-y divide-gray-100">
                            {TABLAS_CON_DATOS.map(t => (
                                <div key={t.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-emerald-400" />
                                    <span className="text-gray-700">{t.label}</span>
                                    <span className="text-gray-400 text-xs font-mono">({t.id})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Tablas sin datos */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                        onClick={() => setShowSinDatos(!showSinDatos)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            {showSinDatos ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <span className="font-bold text-gray-700 text-sm">
                                Tablas solo estructura ({TABLAS_SIN_DATOS.length})
                            </span>
                        </div>
                        <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full font-bold">
                            Solo CREATE TABLE
                        </span>
                    </button>
                    {showSinDatos && (
                        <div className="divide-y divide-gray-100">
                            {TABLAS_SIN_DATOS.map(t => (
                                <div key={t.id} className="px-4 py-2 flex items-center gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full bg-gray-300" />
                                    <span className="text-gray-500">{t.label}</span>
                                    <span className="text-gray-400 text-xs font-mono">({t.id})</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Resultado */}
                {lastExport && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4 flex gap-3">
                        <CheckCircle2 className="text-emerald-600 h-5 w-5 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-emerald-800 space-y-1">
                            <p className="font-bold">{lastExport.mensaje}</p>
                            <div className="flex items-center gap-2 text-emerald-700">
                                <FileText size={14} />
                                <span className="font-mono text-xs">{lastExport.archivo}</span>
                                <span className="text-emerald-500">({formatSize(lastExport.size)})</span>
                            </div>
                            <p className="text-xs text-emerald-600 mt-1">Guardado en: ./data/SQL/</p>
                        </div>
                    </div>
                )}

                {/* Botón generar */}
                <div className="pt-2">
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="w-full px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {generating ? (
                            <>
                                <Loader2 size={20} className="animate-spin" />
                                Generando script SQL...
                            </>
                        ) : (
                            <>
                                <Save size={20} />
                                Generar Script SQL
                            </>
                        )}
                    </button>
                    <p className="text-xs text-gray-400 text-center mt-2">
                        El archivo .sql se guarda en la carpeta data/SQL del servidor
                    </p>
                </div>
            </div>
        </div>
    )
}
