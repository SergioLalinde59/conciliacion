import { useState, useMemo } from 'react'
import { Sparkles, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Eye, ArrowRight } from 'lucide-react'
import { Modal } from '../../molecules/Modal'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'
import { presupuestoService } from '../../../services/presupuesto.service'
import { useIndicadores } from '../../../hooks/useIndicadores'
import type { Presupuesto, GeneracionPreview, GeneracionResult, NoRepetitivoInfo, FijoSinMontoInfo } from '../../../types/Presupuesto'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL, handleResponse } from '../../../services/httpClient'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'

interface Props {
    isOpen: boolean
    presupuesto: Presupuesto
    onClose: () => void
    onSuccess: () => void
}

type Step = 1 | 2 | 3

const STEP_TITLES: Record<Step, string> = {
    1: 'Configuración',
    2: 'Vista Previa',
    3: 'Resultado',
}

const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

export const PresupuestoGenerarModal = ({ isOpen, presupuesto, onClose, onSuccess }: Props) => {
    const navigate = useNavigate()
    const [step, setStep] = useState<Step>(1)
    const [anioFuente, setAnioFuente] = useState(presupuesto.anio - 1)
    const [umbral, setUmbral] = useState(presupuesto.umbral_no_repetitivo || 4)
    const [ccExcluidos, setCcExcluidos] = useState<number[]>([])
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<GeneracionPreview | null>(null)
    const [result, setResult] = useState<GeneracionResult | null>(null)
    const [noRepIncluidos, setNoRepIncluidos] = useState<Set<string>>(new Set())
    const [montosFijos, setMontosFijos] = useState<Record<string, number>>({})

    const { data: indicadores = [] } = useIndicadores(presupuesto.anio)

    const { data: centrosCosto = [] } = useQuery({
        queryKey: ['centros-costo-select'],
        queryFn: () => fetch(`${API_BASE_URL}/api/centros-costos`).then(handleResponse) as Promise<{ id: number; nombre: string }[]>,
        staleTime: 10 * 60 * 1000,
    })

    // Indicadores únicos por nombre
    const indicadoresMap = useMemo(() => {
        const map: Record<string, { nombre: string; valor: number }> = {}
        for (const ind of indicadores) {
            if (!map[ind.indicador]) {
                map[ind.indicador] = { nombre: ind.indicador, valor: ind.valor_porcentaje }
            }
        }
        return map
    }, [indicadores])

    const handleReset = () => {
        setStep(1)
        setPreview(null)
        setResult(null)
        setNoRepIncluidos(new Set())
        setMontosFijos({})
    }

    const handleClose = () => {
        handleReset()
        onClose()
    }

    // --- Step 1: Previsualizar ---
    const handlePrevisualizar = async () => {
        setLoading(true)
        try {
            const data = await presupuestoService.previsualizar(presupuesto.id, {
                anio_fuente: anioFuente,
                centros_costos_excluidos: ccExcluidos.length > 0 ? ccExcluidos : undefined,
                umbral,
            })
            setPreview(data)
            setNoRepIncluidos(new Set())
            setStep(2)
        } catch (err: any) {
            toast.error(err.message || 'Error al previsualizar')
        } finally {
            setLoading(false)
        }
    }

    // --- Step 2: Generar ---
    const handleGenerar = async () => {
        if (!preview) return
        setLoading(true)
        try {
            // Construir lista de no-repetitivos incluidos manualmente
            const incluidos = preview.no_repetitivos
                .filter(nr => noRepIncluidos.has(nrKey(nr)))
                .map(nr => ({
                    centro_costo_id: nr.centro_costo_id,
                    concepto_id: nr.concepto_id,
                    tercero_id: nr.tercero_id,
                    mes: nr.mes,
                    monto: nr.monto,
                }))

            // Construir lista de montos fijos (agrupados por CC/Concepto/Tercero)
            const montosFijosPayload = preview.fijos_sin_monto?.length
                ? [...new Set(preview.fijos_sin_monto.map(fijoGroupKey))].map(key => {
                    const sample = preview.fijos_sin_monto.find(f => fijoGroupKey(f) === key)!
                    return {
                        centro_costo_id: sample.centro_costo_id,
                        concepto_id: sample.concepto_id,
                        tercero_id: sample.tercero_id,
                        monto_fijo: montosFijos[key] ?? 0,
                    }
                })
                : undefined

            const data = await presupuestoService.generar(presupuesto.id, {
                anio_fuente: anioFuente,
                centros_costos_excluidos: ccExcluidos.length > 0 ? ccExcluidos : undefined,
                umbral,
                no_repetitivos_incluidos: incluidos.length > 0 ? incluidos : undefined,
                montos_fijos: montosFijosPayload,
            })
            setResult(data)
            setStep(3)
            onSuccess()
        } catch (err: any) {
            toast.error(err.message || 'Error al generar')
        } finally {
            setLoading(false)
        }
    }

    const nrKey = (nr: NoRepetitivoInfo) =>
        `${nr.centro_costo_id}-${nr.concepto_id ?? 'x'}-${nr.tercero_id ?? 'x'}-${nr.mes}`

    const fijoGroupKey = (f: FijoSinMontoInfo) =>
        `${f.centro_costo_id}-${f.concepto_id ?? 'x'}-${f.tercero_id ?? 'x'}`

    const toggleNoRep = (nr: NoRepetitivoInfo) => {
        const key = nrKey(nr)
        setNoRepIncluidos(prev => {
            const next = new Set(prev)
            if (next.has(key)) next.delete(key)
            else next.add(key)
            return next
        })
    }

    const toggleAllNoRep = () => {
        if (!preview) return
        if (noRepIncluidos.size === preview.no_repetitivos.length) {
            setNoRepIncluidos(new Set())
        } else {
            setNoRepIncluidos(new Set(preview.no_repetitivos.map(nrKey)))
        }
    }

    const toggleCcExcluido = (id: number) => {
        setCcExcluidos(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    // --- Render footer by step ---
    const renderFooter = () => {
        if (step === 1) {
            return (
                <>
                    <Button variant="secondary" onClick={handleClose} disabled={loading}>Cancelar</Button>
                    <Button onClick={handlePrevisualizar} icon={Eye} isLoading={loading}
                        disabled={indicadores.length === 0}>
                        Previsualizar
                    </Button>
                </>
            )
        }
        if (step === 2) {
            return (
                <>
                    <Button variant="secondary" onClick={() => setStep(1)} disabled={loading}>
                        <ChevronLeft size={16} className="mr-1" /> Volver
                    </Button>
                    <Button onClick={handleGenerar} icon={Sparkles} isLoading={loading}>
                        Generar Presupuesto
                    </Button>
                </>
            )
        }
        return (
            <>
                <Button variant="secondary" onClick={handleClose}>Cerrar</Button>
                <Button onClick={() => { handleClose(); navigate(`/presupuestos/${presupuesto.id}/detalle`) }}>
                    Ver Detalle <ArrowRight size={16} className="ml-1" />
                </Button>
            </>
        )
    }

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={
                <div className="flex items-center gap-3">
                    <span>Generar Presupuesto</span>
                    <div className="flex items-center gap-1 text-xs">
                        {([1, 2, 3] as Step[]).map(s => (
                            <div key={s} className={`flex items-center gap-1 ${s <= step ? 'text-blue-600' : 'text-slate-400'}`}>
                                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold
                                    ${s === step ? 'bg-blue-600 text-white' : s < step ? 'bg-blue-100 text-blue-600' : 'bg-slate-100'}`}>
                                    {s}
                                </span>
                                <span className="hidden sm:inline">{STEP_TITLES[s]}</span>
                                {s < 3 && <ChevronRight size={12} />}
                            </div>
                        ))}
                    </div>
                </div>
            }
            size="xl"
            footer={renderFooter()}
        >
            {step === 1 && <Step1Config
                presupuesto={presupuesto}
                anioFuente={anioFuente}
                setAnioFuente={setAnioFuente}
                umbral={umbral}
                setUmbral={setUmbral}
                ccExcluidos={ccExcluidos}
                toggleCcExcluido={toggleCcExcluido}
                centrosCosto={centrosCosto}
                indicadoresMap={indicadoresMap}
            />}
            {step === 2 && preview && <Step2Preview
                preview={preview}
                noRepIncluidos={noRepIncluidos}
                toggleNoRep={toggleNoRep}
                toggleAllNoRep={toggleAllNoRep}
                nrKey={nrKey}
                montosFijos={montosFijos}
                setMontosFijos={setMontosFijos}
                fijoGroupKey={fijoGroupKey}
            />}
            {step === 3 && result && <Step3Result result={result} />}
        </Modal>
    )
}

// ==========================================
// Step 1: Configuración
// ==========================================
function Step1Config({ presupuesto, anioFuente, setAnioFuente, umbral, setUmbral, ccExcluidos, toggleCcExcluido, centrosCosto, indicadoresMap }: {
    presupuesto: Presupuesto
    anioFuente: number
    setAnioFuente: (v: number) => void
    umbral: number
    setUmbral: (v: number) => void
    ccExcluidos: number[]
    toggleCcExcluido: (id: number) => void
    centrosCosto: { id: number; nombre: string }[]
    indicadoresMap: Record<string, { nombre: string; valor: number }>
}) {
    const tieneIndicadores = Object.keys(indicadoresMap).length > 0

    return (
        <div className="space-y-5">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                Se tomarán los egresos reales del año fuente, se clasificarán por tipo de gasto
                y se aplicarán aumentos según indicadores económicos para generar <strong>{presupuesto.nombre}</strong>.
            </div>

            {/* Indicadores panel */}
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Indicadores configurados para {presupuesto.anio}</h4>
                {tieneIndicadores ? (
                    <div className="grid grid-cols-2 gap-2">
                        {Object.entries(indicadoresMap).map(([nombre, info]) => (
                            <div key={nombre} className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm">
                                <CheckCircle2 size={16} className="text-green-500 shrink-0" />
                                <span className="font-medium text-green-700">{nombre}</span>
                                <span className="text-green-600">+{info.valor}%</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                        <XCircle size={16} className="text-red-500" />
                        No hay indicadores para {presupuesto.anio}. Configure indicadores antes de generar.
                    </div>
                )}
            </div>

            {/* Año fuente + Umbral */}
            <div className="grid grid-cols-2 gap-4">
                <Input
                    label="Año Fuente (datos reales)"
                    type="number"
                    value={anioFuente}
                    onChange={e => setAnioFuente(parseInt(e.target.value) || presupuesto.anio - 1)}
                    min={2020}
                    max={presupuesto.anio}
                />
                <div>
                    <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">
                        Umbral No Repetitivos
                    </label>
                    <div className="mt-1">
                        <input
                            type="range" min={1} max={6} value={umbral}
                            onChange={e => setUmbral(Number(e.target.value))}
                            className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                            <span>1 mes</span>
                            <span className="font-semibold text-blue-600">{umbral} meses</span>
                            <span>6 meses</span>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">Gastos con actividad en ≤{umbral} meses se excluyen</p>
                </div>
            </div>

            {/* CC a excluir */}
            {centrosCosto.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Centros de Costo a excluir</h4>
                    <div className="max-h-40 overflow-y-auto border rounded-lg p-2 space-y-1">
                        {centrosCosto.map(cc => (
                            <label key={cc.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-slate-50 px-2 py-1 rounded">
                                <input
                                    type="checkbox"
                                    checked={ccExcluidos.includes(cc.id)}
                                    onChange={() => toggleCcExcluido(cc.id)}
                                    className="rounded border-slate-300"
                                />
                                <span className={ccExcluidos.includes(cc.id) ? 'text-slate-400 line-through' : ''}>
                                    {cc.nombre}
                                </span>
                            </label>
                        ))}
                    </div>
                </div>
            )}

            <div className="text-xs text-gray-500">
                Las líneas existentes con la misma combinación CC/Concepto/Tercero/Mes se actualizarán.
            </div>
        </div>
    )
}

// ==========================================
// Step 2: Vista Previa
// ==========================================
function Step2Preview({ preview, noRepIncluidos, toggleNoRep, toggleAllNoRep, nrKey, montosFijos, setMontosFijos, fijoGroupKey }: {
    preview: GeneracionPreview
    noRepIncluidos: Set<string>
    toggleNoRep: (nr: NoRepetitivoInfo) => void
    toggleAllNoRep: () => void
    nrKey: (nr: NoRepetitivoInfo) => string
    montosFijos: Record<string, number>
    setMontosFijos: React.Dispatch<React.SetStateAction<Record<string, number>>>
    fijoGroupKey: (f: FijoSinMontoInfo) => string
}) {
    const { resumen, no_repetitivos, fijos_sin_monto = [] } = preview

    // Agrupar fijos por (CC, Concepto, Tercero) para mostrar UN input por grupo
    const fijosAgrupados = useMemo(() => {
        const groups: Record<string, { key: string; sample: FijoSinMontoInfo; meses: number; montoPromedio: number }> = {}
        for (const f of fijos_sin_monto) {
            const key = fijoGroupKey(f)
            if (!groups[key]) {
                groups[key] = { key, sample: f, meses: 0, montoPromedio: 0 }
            }
            groups[key].meses++
            groups[key].montoPromedio += f.monto_base
        }
        for (const g of Object.values(groups)) {
            g.montoPromedio = g.montoPromedio / g.meses
        }
        return Object.values(groups)
    }, [fijos_sin_monto, fijoGroupKey])

    const tipoBadgeColor: Record<string, string> = {
        fijo: 'bg-blue-100 text-blue-700',
        variable: 'bg-green-100 text-green-700',
        salarial: 'bg-purple-100 text-purple-700',
        estacional: 'bg-amber-100 text-amber-700',
        no_repetitivo: 'bg-red-100 text-red-700',
    }

    return (
        <div className="space-y-4">
            {/* Resumen superior */}
            <div className="grid grid-cols-4 gap-3">
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-slate-800">{resumen.total_lineas}</div>
                    <div className="text-xs text-slate-500">Líneas regulares</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-sm font-bold text-slate-800">{formatMoney(resumen.total_base)}</div>
                    <div className="text-xs text-slate-500">Monto base</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-sm font-bold text-blue-700">{formatMoney(resumen.total_presupuestado)}</div>
                    <div className="text-xs text-slate-500">Presupuestado</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-3 text-center">
                    <div className="text-2xl font-bold text-green-600">+{resumen.pct_aumento_promedio.toFixed(1)}%</div>
                    <div className="text-xs text-slate-500">Aumento promedio</div>
                </div>
            </div>

            {/* Desglose por tipo */}
            <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Por tipo de gasto</h4>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(resumen.por_tipo).map(([tipo, count]) => (
                        <span key={tipo} className={`px-3 py-1 rounded-full text-xs font-medium ${tipoBadgeColor[tipo] || 'bg-slate-100 text-slate-700'}`}>
                            {tipo}: {count}
                        </span>
                    ))}
                </div>
            </div>

            {/* Desglose por indicador */}
            {resumen.indicadores && Object.keys(resumen.indicadores).length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-slate-700 mb-2">Indicadores aplicados</h4>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(resumen.indicadores).map(([nombre, info]) => (
                            <span key={nombre} className="bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-medium">
                                {nombre} +{info.valor}% → {resumen.por_indicador?.[nombre] || 0} líneas
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Gastos fijos pendientes de monto */}
            {fijosAgrupados.length > 0 && (
                <div>
                    <h4 className="text-sm font-semibold text-amber-700 mb-2">
                        Gastos fijos sin monto configurado ({fijosAgrupados.length})
                    </h4>
                    <p className="text-xs text-slate-500 mb-2">
                        Ingrese el monto mensual conocido. Si deja vacio, se usara el monto del ano anterior sin aumento.
                    </p>
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                        <table className="w-full text-xs">
                            <thead className="bg-amber-50 text-amber-700 sticky top-0">
                                <tr>
                                    <th className="px-2 py-1.5 text-left">Centro Costo</th>
                                    <th className="px-2 py-1.5 text-left">Concepto</th>
                                    <th className="px-2 py-1.5 text-left">Tercero</th>
                                    <th className="px-2 py-1.5 text-center">Meses</th>
                                    <th className="px-2 py-1.5 text-right">Monto Anterior</th>
                                    <th className="px-2 py-1.5 text-right">Monto Nuevo</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-amber-50">
                                {fijosAgrupados.map(g => (
                                    <tr key={g.key} className="hover:bg-slate-50">
                                        <td className="px-2 py-1.5">{g.sample.centro_costo_nombre || g.sample.centro_costo_id}</td>
                                        <td className="px-2 py-1.5">{g.sample.concepto_nombre || '-'}</td>
                                        <td className="px-2 py-1.5">{g.sample.tercero_nombre || '-'}</td>
                                        <td className="px-2 py-1.5 text-center">{g.meses}</td>
                                        <td className="px-2 py-1.5 text-right font-mono">{formatMoney(g.montoPromedio)}</td>
                                        <td className="px-2 py-1.5 text-right">
                                            <input
                                                type="number"
                                                placeholder={Math.round(g.montoPromedio).toString()}
                                                value={montosFijos[g.key] ?? ''}
                                                onChange={e => setMontosFijos(prev => ({
                                                    ...prev,
                                                    [g.key]: e.target.value ? Number(e.target.value) : undefined as unknown as number
                                                }))}
                                                className="w-28 border rounded px-2 py-1 text-right text-xs"
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* No repetitivos */}
            {no_repetitivos.length > 0 && (
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-sm font-semibold text-red-700">
                            Gastos no repetitivos excluidos ({no_repetitivos.length})
                        </h4>
                        <button onClick={toggleAllNoRep}
                            className="text-xs text-blue-600 hover:underline">
                            {noRepIncluidos.size === no_repetitivos.length ? 'Deseleccionar todos' : 'Incluir todos'}
                        </button>
                    </div>
                    <div className="max-h-48 overflow-y-auto border rounded-lg">
                        <table className="w-full text-xs">
                            <thead className="bg-red-50 text-red-700 sticky top-0">
                                <tr>
                                    <th className="px-2 py-1.5 text-left">Incluir</th>
                                    <th className="px-2 py-1.5 text-left">Centro Costo</th>
                                    <th className="px-2 py-1.5 text-left">Concepto</th>
                                    <th className="px-2 py-1.5 text-left">Tercero</th>
                                    <th className="px-2 py-1.5 text-center">Mes</th>
                                    <th className="px-2 py-1.5 text-right">Monto</th>
                                    <th className="px-2 py-1.5 text-left">Razón</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-red-50">
                                {no_repetitivos.map(nr => {
                                    const key = nrKey(nr)
                                    return (
                                        <tr key={key} className={`hover:bg-slate-50 ${noRepIncluidos.has(key) ? 'bg-green-50' : ''}`}>
                                            <td className="px-2 py-1.5 text-center">
                                                <input
                                                    type="checkbox"
                                                    checked={noRepIncluidos.has(key)}
                                                    onChange={() => toggleNoRep(nr)}
                                                    className="rounded border-slate-300"
                                                />
                                            </td>
                                            <td className="px-2 py-1.5">{nr.centro_costo_nombre || nr.centro_costo_id}</td>
                                            <td className="px-2 py-1.5">{nr.concepto_nombre || '-'}</td>
                                            <td className="px-2 py-1.5">{nr.tercero_nombre || '-'}</td>
                                            <td className="px-2 py-1.5 text-center">{nr.mes}</td>
                                            <td className="px-2 py-1.5 text-right font-mono">{formatMoney(nr.monto)}</td>
                                            <td className="px-2 py-1.5 text-slate-500">{nr.razon}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                    {noRepIncluidos.size > 0 && (
                        <p className="text-xs text-green-600 mt-1">
                            {noRepIncluidos.size} gasto(s) se incluirán manualmente en el presupuesto
                        </p>
                    )}
                </div>
            )}

            {no_repetitivos.length === 0 && (
                <div className="text-sm text-slate-500 bg-slate-50 rounded-lg p-3">
                    No se detectaron gastos no repetitivos. Todas las líneas se incluirán.
                </div>
            )}
        </div>
    )
}

// ==========================================
// Step 3: Resultado
// ==========================================
function Step3Result({ result }: { result: GeneracionResult }) {
    return (
        <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <CheckCircle2 size={48} className="text-green-500 mx-auto mb-3" />
                <h3 className="text-xl font-bold text-green-800 mb-1">Presupuesto generado exitosamente</h3>
                <p className="text-green-600 text-sm">
                    Se procesaron las líneas según clasificación e indicadores económicos
                </p>
            </div>

            <div className="grid grid-cols-4 gap-3">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-blue-700">{result.lineas_generadas}</div>
                    <div className="text-xs text-blue-500 mt-1">Lineas generadas</div>
                </div>
                <div className="bg-red-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-red-600">{result.lineas_excluidas}</div>
                    <div className="text-xs text-red-500 mt-1">Excluidas</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-green-600">{result.incluidos_manualmente}</div>
                    <div className="text-xs text-green-500 mt-1">Incluidas manual</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                    <div className="text-3xl font-bold text-amber-600">{result.fijos_incluidos || 0}</div>
                    <div className="text-xs text-amber-500 mt-1">Fijos con monto</div>
                </div>
            </div>

            {result.resumen && (
                <div className="bg-slate-50 rounded-lg p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                        <span className="text-slate-600">Monto base total:</span>
                        <span className="font-mono font-medium">{formatMoney(result.resumen.total_base)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">Monto presupuestado:</span>
                        <span className="font-mono font-medium text-blue-700">{formatMoney(result.resumen.total_presupuestado)}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-600">Aumento promedio:</span>
                        <span className="font-medium text-green-600">+{result.resumen.pct_aumento_promedio.toFixed(1)}%</span>
                    </div>
                </div>
            )}
        </div>
    )
}
