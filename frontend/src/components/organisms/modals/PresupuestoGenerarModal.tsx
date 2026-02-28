import { useState, useMemo, useEffect, useRef } from 'react'
import { Sparkles, ChevronRight, ChevronLeft, CheckCircle2, XCircle, Eye, ArrowRight, X, Search } from 'lucide-react'
import { Modal } from '../../molecules/Modal'
import { Button } from '../../atoms/Button'
import { Input } from '../../atoms/Input'
import { presupuestoService } from '../../../services/presupuesto.service'
import { useIndicadores } from '../../../hooks/useIndicadores'
import { useTiposGasto } from '../../../hooks/useTiposGasto'
import type { Presupuesto, GeneracionPreview, GeneracionResult } from '../../../types/Presupuesto'
import type { TipoGasto } from '../../../types/TipoGasto'
import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL, handleResponse } from '../../../services/httpClient'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { useBudgetFormat } from '../../atoms/CurrencyDisplay'

interface Props {
    isOpen: boolean
    presupuesto: Presupuesto
    onClose: () => void
    onSuccess: () => void
    mode?: 'generar' | 'regenerar'
}

type Step = 1 | 2 | 3

const STEP_TITLES: Record<Step, string> = {
    1: 'Configuración',
    2: 'Vista Previa',
    3: 'Resultado',
}

const formatMoney = (n: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n)

export const PresupuestoGenerarModal = ({ isOpen, presupuesto, onClose, onSuccess, mode = 'generar' }: Props) => {
    const navigate = useNavigate()
    const [step, setStep] = useState<Step>(1)
    const [anioFuente, setAnioFuente] = useState(presupuesto.anio - 1)
    const [umbral, setUmbral] = useState(presupuesto.umbral_no_repetitivo)
    const [umbralEstacional, setUmbralEstacional] = useState(presupuesto.umbral_estacional)
    const [umbralPareto, setUmbralPareto] = useState(presupuesto.umbral_pareto)
    const [ccExcluidos, setCcExcluidos] = useState<number[]>([])
    const [loading, setLoading] = useState(false)
    const [preview, setPreview] = useState<GeneracionPreview | null>(null)
    const [result, setResult] = useState<GeneracionResult | null>(null)

    const { data: indicadores = [] } = useIndicadores(presupuesto.anio)
    const { data: tiposGasto = [] } = useTiposGasto()

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
        setCcExcluidos([])
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
                umbral_estacional: umbralEstacional,
            })
            setPreview(data)
            setStep(2)
        } catch (err: any) {
            toast.error(err.message || 'Error al previsualizar')
        } finally {
            setLoading(false)
        }
    }

    // --- Step 2: Generar / Regenerar ---
    const handleGenerar = async () => {
        if (!preview) return
        setLoading(true)
        try {
            const params = {
                anio_fuente: anioFuente,
                centros_costos_excluidos: ccExcluidos.length > 0 ? ccExcluidos : undefined,
                umbral,
                umbral_estacional: umbralEstacional,
            }
            const data = mode === 'regenerar'
                ? await presupuestoService.regenerar(presupuesto.id, params)
                : await presupuestoService.generar(presupuesto.id, params)
            setResult(data)
            setStep(3)
            onSuccess()
        } catch (err: any) {
            toast.error(err.message || `Error al ${mode === 'regenerar' ? 'regenerar' : 'generar'}`)
        } finally {
            setLoading(false)
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
                        {mode === 'regenerar' ? 'Regenerar Presupuesto' : 'Generar Presupuesto'}
                    </Button>
                </>
            )
        }
        return (
            <>
                <Button variant="secondary" onClick={handleClose}>Cerrar</Button>
                <Button onClick={() => { handleClose(); navigate('/reportes/presupuesto-vs-real') }}>
                    Ver Análisis <ArrowRight size={16} className="ml-1" />
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
                    <span>{mode === 'regenerar' ? 'Regenerar Presupuesto' : 'Generar Presupuesto'}</span>
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
                umbralEstacional={umbralEstacional}
                setUmbralEstacional={setUmbralEstacional}
                umbralPareto={umbralPareto}
                setUmbralPareto={setUmbralPareto}
                ccExcluidos={ccExcluidos}
                toggleCcExcluido={toggleCcExcluido}
                centrosCosto={centrosCosto}
                indicadoresMap={indicadoresMap}
                tiposGasto={tiposGasto}
            />}
            {step === 2 && preview && <Step2Preview
                preview={preview}
                presupuesto={presupuesto}
                umbralPareto={umbralPareto}
            />}
            {step === 3 && result && <Step3Result result={result} />}
        </Modal>
    )
}

// ==========================================
// Step 1: Configuración
// ==========================================

function Step1Config({ presupuesto, anioFuente, setAnioFuente, umbral, setUmbral, umbralEstacional, setUmbralEstacional, umbralPareto, setUmbralPareto, ccExcluidos, toggleCcExcluido, centrosCosto, indicadoresMap, tiposGasto }: {
    presupuesto: Presupuesto
    anioFuente: number
    setAnioFuente: (v: number) => void
    umbral: number
    setUmbral: (v: number) => void
    umbralEstacional: number
    setUmbralEstacional: (v: number) => void
    umbralPareto: number
    setUmbralPareto: (v: number) => void
    ccExcluidos: number[]
    toggleCcExcluido: (id: number) => void
    centrosCosto: { id: number; nombre: string }[]
    indicadoresMap: Record<string, { nombre: string; valor: number }>
    tiposGasto: TipoGasto[]
}) {
    const fmt = useBudgetFormat()
    const tieneIndicadores = Object.keys(indicadoresMap).length > 0

    // Indicadores salariales: todos los que NO son IPC ni null
    const ipcNombre = tiposGasto.find(t => t.tipo === 'Variable')?.indicador_default
    const indicadoresSalariales = useMemo(() => {
        return Object.values(indicadoresMap)
            .filter(ind => ind.nombre !== ipcNombre)
            .sort((a, b) => b.valor - a.valor)
    }, [indicadoresMap, ipcNombre])

    const ipcValor = ipcNombre ? indicadoresMap[ipcNombre]?.valor : null
    const tieneMaterialidad = presupuesto.umbral_minimo_mensual > 0 || presupuesto.umbral_minimo_anual > 0

    return (
        <div className="space-y-5">
            {/* Error: sin indicadores */}
            {!tieneIndicadores && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-sm text-red-700">
                    <XCircle size={16} className="text-red-500 shrink-0" />
                    No hay indicadores para {presupuesto.anio}. Configure indicadores antes de generar.
                </div>
            )}

            {/* Año fuente */}
            <div className="max-w-48">
                <Input
                    label="Año Fuente"
                    type="number"
                    value={anioFuente}
                    onChange={e => setAnioFuente(parseInt(e.target.value) || presupuesto.anio - 1)}
                    min={2020}
                    max={presupuesto.anio}
                />
            </div>

            {/* Cinta infográfica: tipos de gasto */}
            {tieneIndicadores && (
                <div className="flex items-stretch bg-slate-50 rounded-lg border border-slate-200 divide-x divide-slate-200 text-center">
                    {/* Variable */}
                    <div className="flex-1 py-2.5 px-1">
                        <div className="text-[10px] text-slate-500 font-medium">Variable</div>
                        <div className="text-sm font-bold text-emerald-600 mt-0.5">+{ipcValor ?? '?'}%</div>
                    </div>
                    {/* Salarial */}
                    <div className="flex-1 py-2.5 px-1">
                        <div className="text-[10px] text-slate-500 font-medium">Salarial</div>
                        <div className="mt-0.5 space-y-px">
                            {indicadoresSalariales.map(ind => {
                                const label = ind.nombre.replace('Aumento ', '').replace('Salario ', '')
                                return (
                                    <div key={ind.nombre} className="text-[11px] leading-tight">
                                        <span className="text-slate-400">{label}</span>{' '}
                                        <span className="font-semibold text-purple-600">+{ind.valor}%</span>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                    {/* Fijo */}
                    <div className="flex-1 py-2.5 px-1">
                        <div className="text-[10px] text-slate-500 font-medium">Fijo</div>
                        <div className="text-sm font-bold text-blue-600 mt-0.5">$/mes</div>
                    </div>
                    {/* Estacional */}
                    <div className="flex-1 py-2.5 px-1">
                        <div className="text-[10px] text-slate-500 font-medium">Estacional</div>
                        <div className="text-sm font-bold text-amber-600 mt-0.5">+{ipcValor ?? '?'}%</div>
                    </div>
                    {/* Monto Mín */}
                    <div className="flex-1 py-2.5 px-1">
                        <div className="text-[10px] text-slate-500 font-medium">Monto Mín</div>
                        {tieneMaterialidad ? (
                            <div className="mt-0.5 space-y-px">
                                {presupuesto.umbral_minimo_mensual > 0 && (
                                    <div className="text-[11px] font-semibold text-slate-600 leading-tight">
                                        {fmt(presupuesto.umbral_minimo_mensual)}/mes
                                    </div>
                                )}
                                {presupuesto.umbral_minimo_anual > 0 && (
                                    <div className="text-[11px] font-semibold text-slate-600 leading-tight">
                                        {fmt(presupuesto.umbral_minimo_anual)}/año
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-sm font-bold text-slate-400 mt-0.5">—</div>
                        )}
                    </div>
                    {/* No Repetitivo */}
                    <div className="flex-1 py-2.5 px-1">
                        <div className="text-[10px] text-slate-500 font-medium">No Repet.</div>
                        <div className="text-sm font-bold text-slate-400 mt-0.5">Excluido</div>
                    </div>
                </div>
            )}

            {/* Umbrales de clasificación */}
            <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">
                    Clasificación (meses)
                </label>
                <div className="grid grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="text-[10px] text-slate-500 font-medium ml-0.5">No Repetitivo (≤ N meses)</label>
                        <input
                            type="range" min={1} max={6} value={umbral}
                            onChange={e => setUmbral(Number(e.target.value))}
                            className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>1</span>
                            <span className="font-semibold text-blue-600">{umbral} meses</span>
                            <span>6</span>
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-medium ml-0.5">Estacional (≤ N meses + keywords)</label>
                        <input
                            type="range" min={1} max={6} value={umbralEstacional}
                            onChange={e => setUmbralEstacional(Number(e.target.value))}
                            className="w-full accent-blue-600"
                        />
                        <div className="flex justify-between text-xs text-slate-500">
                            <span>1</span>
                            <span className="font-semibold text-blue-600">{umbralEstacional} meses</span>
                            <span>6</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Umbral Pareto (Top CC) */}
            <div>
                <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider ml-0.5">
                    Top Centros de Costo
                </label>
                <p className="text-[11px] text-slate-400 ml-0.5 mt-0.5 mb-2">
                    Monto mínimo anual para aparecer en el gráfico de vista previa
                </p>
                <div className="max-w-64">
                    <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
                        <input
                            type="text"
                            value={umbralPareto.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                            onChange={e => {
                                const raw = e.target.value.replace(/\D/g, '')
                                setUmbralPareto(raw ? parseInt(raw) : 0)
                            }}
                            className="w-full pl-7 pr-3 py-2 border border-gray-200 rounded-lg text-sm font-mono outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-gray-300 transition-all bg-white text-right"
                        />
                    </div>
                </div>
            </div>

            {/* CC a excluir */}
            {centrosCosto.length > 0 && (
                <CcExcluirCombobox
                    centrosCosto={centrosCosto}
                    ccExcluidos={ccExcluidos}
                    toggleCcExcluido={toggleCcExcluido}
                />
            )}
        </div>
    )
}

// ==========================================
// Step 2: Vista Previa
// ==========================================
function Step2Preview({ preview, presupuesto, umbralPareto }: {
    preview: GeneracionPreview
    presupuesto: Presupuesto
    umbralPareto: number
}) {
    const { resumen, no_repetitivos } = preview
    const fmt = useBudgetFormat()

    const tieneMaterialidad = presupuesto.umbral_minimo_mensual > 0 || presupuesto.umbral_minimo_anual > 0

    const tipoColor: Record<string, string> = {
        variable: 'text-emerald-600',
        fijo: 'text-blue-600',
        salarial: 'text-purple-600',
        estacional: 'text-amber-600',
    }

    const tipoLabel: Record<string, string> = {
        variable: 'Variable',
        fijo: 'Fijo',
        salarial: 'Salarial',
        estacional: 'Estacional',
    }

    // Pareto: datos por CC con acumulado
    const ccData = resumen.por_centro_costo || []
    const maxMonto = Math.max(...ccData.map(cc => cc.monto_presupuestado), 1)

    const ccWithPareto = useMemo(() => {
        let cumPct = 0
        return ccData.map(cc => {
            const pct = resumen.total_presupuestado > 0
                ? (cc.monto_presupuestado / resumen.total_presupuestado) * 100
                : 0
            cumPct += pct
            return { ...cc, pct, cumPct, isTop: cc.monto_presupuestado >= umbralPareto }
        })
    }, [ccData, resumen.total_presupuestado, umbralPareto])

    return (
        <div className="space-y-4">
            {/* Resumen compacto */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-slate-700">{presupuesto.nombre}</span>
                    <span className="text-lg font-bold text-blue-700">{formatMoney(resumen.total_presupuestado)}</span>
                </div>

                {/* Cinta infográfica: resultado por tipo */}
                <div className="flex items-stretch bg-white rounded-lg border border-slate-200 divide-x divide-slate-200 text-center">
                    {Object.entries(resumen.por_tipo).map(([tipo, count]) => (
                        <div key={tipo} className="flex-1 py-2 px-1">
                            <div className="text-[10px] text-slate-500 font-medium">{tipoLabel[tipo] || tipo}</div>
                            <div className={`text-sm font-bold mt-0.5 ${tipoColor[tipo] || 'text-slate-600'}`}>{count}</div>
                        </div>
                    ))}
                    {resumen.pct_aumento_promedio > 0 && (
                        <div className="flex-1 py-2 px-1">
                            <div className="text-[10px] text-slate-500 font-medium">Aumento</div>
                            <div className="text-sm font-bold text-green-600 mt-0.5">+{resumen.pct_aumento_promedio.toFixed(1)}%</div>
                        </div>
                    )}
                    {no_repetitivos.length > 0 && (
                        <div className="flex-1 py-2 px-1">
                            <div className="text-[10px] text-slate-500 font-medium">No Repet.</div>
                            <div className="text-sm font-bold text-slate-400 mt-0.5">{no_repetitivos.length} excl.</div>
                        </div>
                    )}
                </div>

                {/* Footnotes */}
                <div className="flex items-center gap-3 text-xs text-slate-400">
                    <span>{resumen.total_lineas} líneas</span>
                    {tieneMaterialidad && (
                        <>
                            <span className="text-slate-300">|</span>
                            <span>
                                Materialidad: {presupuesto.umbral_minimo_mensual > 0 && `≥${fmt(presupuesto.umbral_minimo_mensual)}/mes`}
                                {presupuesto.umbral_minimo_mensual > 0 && presupuesto.umbral_minimo_anual > 0 && ' • '}
                                {presupuesto.umbral_minimo_anual > 0 && `≥${fmt(presupuesto.umbral_minimo_anual)}/año`}
                            </span>
                        </>
                    )}
                </div>
            </div>

            {/* Pareto por Centro de Costo (solo el 80%) */}
            {ccWithPareto.length > 0 && (() => {
                const top = ccWithPareto.filter(cc => cc.isTop)
                const rest = ccWithPareto.filter(cc => !cc.isTop)
                const restTotal = rest.reduce((s, cc) => s + cc.monto_presupuestado, 0)
                return (
                    <div>
                        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                            Top Centros de Costo ({top.length} de {ccWithPareto.length}) <span className="normal-case font-normal text-slate-400">&ge; {fmt(umbralPareto)}/año</span>
                        </h4>
                        <div className="space-y-1">
                            {top.map(cc => (
                                <div key={cc.centro_costo_id} className="flex items-center gap-2 text-xs">
                                    <span className="w-36 truncate text-slate-700 font-medium shrink-0"
                                        title={`${cc.centro_costo_id} - ${cc.centro_costo_nombre}`}
                                    >
                                        {cc.centro_costo_id} - {cc.centro_costo_nombre}
                                    </span>
                                    <div className="flex-1 bg-slate-100 rounded-full h-3.5 overflow-hidden">
                                        <div
                                            className="h-full rounded-full bg-blue-500"
                                            style={{ width: `${(cc.monto_presupuestado / maxMonto) * 100}%` }}
                                        />
                                    </div>
                                    <span className="w-16 text-right font-mono text-slate-600 shrink-0">
                                        {fmt(cc.monto_presupuestado)}
                                    </span>
                                    <span className="w-8 text-right font-mono text-slate-400 shrink-0">
                                        {cc.pct.toFixed(0)}%
                                    </span>
                                    <span className="w-10 text-right font-mono text-blue-500 shrink-0">
                                        {cc.cumPct.toFixed(0)}%
                                    </span>
                                </div>
                            ))}
                            {rest.length > 0 && (
                                <div className="flex items-center gap-2 text-xs text-slate-400 pt-1 border-t border-slate-100">
                                    <span className="w-36 truncate font-medium shrink-0">
                                        Otros ({rest.length})
                                    </span>
                                    <div className="flex-1" />
                                    <span className="w-16 text-right font-mono shrink-0">
                                        {fmt(restTotal)}
                                    </span>
                                    <span className="w-8 text-right font-mono shrink-0">
                                        {(100 - (top[top.length - 1]?.cumPct || 0)).toFixed(0)}%
                                    </span>
                                    <span className="w-10 text-right font-mono shrink-0">
                                        100%
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                )
            })()}
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
                <h3 className="text-xl font-bold text-green-800 mb-1">
                    Presupuesto {result.version ? 'regenerado' : 'generado'}
                </h3>
                {result.version && (
                    <p className="text-sm text-green-600">Versión {result.version}</p>
                )}
            </div>

            <div className="bg-slate-50 rounded-lg p-4 space-y-1.5 text-sm">
                {result.resumen && (
                    <div className="flex justify-between">
                        <span className="text-slate-600">Total presupuestado:</span>
                        <span className="font-mono font-bold text-blue-700">{formatMoney(result.resumen.total_presupuestado)}</span>
                    </div>
                )}
                <div className="flex justify-between text-slate-500">
                    <span>Líneas generadas</span>
                    <span className="font-mono">{result.lineas_generadas}</span>
                </div>
                {result.lineas_excluidas > 0 && (
                    <div className="flex justify-between text-slate-500">
                        <span>No repetitivos excluidos</span>
                        <span className="font-mono">{result.lineas_excluidas}</span>
                    </div>
                )}
                {result.incluidos_manualmente > 0 && (
                    <div className="flex justify-between text-slate-500">
                        <span>Incluidos manualmente</span>
                        <span className="font-mono">{result.incluidos_manualmente}</span>
                    </div>
                )}
            </div>
        </div>
    )
}

// ==========================================
// Combobox para CC a excluir
// ==========================================
function CcExcluirCombobox({ centrosCosto, ccExcluidos, toggleCcExcluido }: {
    centrosCosto: { id: number; nombre: string }[]
    ccExcluidos: number[]
    toggleCcExcluido: (id: number) => void
}) {
    const [busqueda, setBusqueda] = useState('')
    const [abierto, setAbierto] = useState(false)
    const containerRef = useRef<HTMLDivElement>(null)
    const inputRef = useRef<HTMLInputElement>(null)
    const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({})

    const disponibles = useMemo(() => {
        const filtro = busqueda.trim().toLowerCase()
        return centrosCosto
            .filter(cc => !ccExcluidos.includes(cc.id))
            .filter(cc => !filtro || cc.id.toString().includes(filtro) || cc.nombre.toLowerCase().includes(filtro))
    }, [centrosCosto, ccExcluidos, busqueda])

    // Calcular posición fixed del dropdown
    const actualizarPosicion = () => {
        if (!inputRef.current) return
        const rect = inputRef.current.getBoundingClientRect()
        setDropdownStyle({
            position: 'fixed',
            top: rect.bottom + 4,
            left: rect.left,
            width: rect.width,
            zIndex: 9999,
        })
    }

    const abrirDropdown = () => {
        actualizarPosicion()
        setAbierto(true)
    }

    // Cerrar dropdown al hacer click fuera
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setAbierto(false)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const seleccionar = (id: number) => {
        toggleCcExcluido(id)
        setBusqueda('')
        setAbierto(false)
    }

    return (
        <div>
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Centros de Costo a excluir</h4>
            <div ref={containerRef}>
                <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={busqueda}
                        onChange={e => { setBusqueda(e.target.value); abrirDropdown() }}
                        onFocus={abrirDropdown}
                        placeholder="Buscar por número o nombre..."
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 hover:border-gray-300 transition-all bg-white"
                    />
                </div>
                {abierto && disponibles.length > 0 && (
                    <div style={dropdownStyle} className="bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {disponibles.map(cc => (
                            <button
                                key={cc.id}
                                type="button"
                                onClick={() => seleccionar(cc.id)}
                                className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition-colors flex items-center gap-2"
                            >
                                <span className="text-gray-400 font-mono text-xs w-6 text-right shrink-0">{cc.id}</span>
                                <span className="text-gray-700">{cc.nombre}</span>
                            </button>
                        ))}
                    </div>
                )}
                {abierto && busqueda && disponibles.length === 0 && (
                    <div style={dropdownStyle} className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-3 text-sm text-gray-400">
                        Sin resultados
                    </div>
                )}
            </div>
            {ccExcluidos.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                    {ccExcluidos.map(id => {
                        const cc = centrosCosto.find(c => c.id === id)
                        return (
                            <span key={id} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-medium">
                                {cc ? `${cc.id} - ${cc.nombre}` : id}
                                <button
                                    type="button"
                                    onClick={() => toggleCcExcluido(id)}
                                    className="p-0.5 rounded-full hover:bg-slate-300 transition-colors"
                                >
                                    <X size={12} />
                                </button>
                            </span>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
