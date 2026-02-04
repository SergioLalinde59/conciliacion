import { RotateCcw, Filter } from 'lucide-react'
import { SelectorCuenta } from '../molecules/SelectorCuenta'
import { Button } from '../atoms/Button'
import { DateRangeButtons, DateRangeInputs } from '../molecules/DateRangeSelector'
import { ClassificationFilters } from '../molecules/ClassificationFilters'
import { FilterToggles } from '../molecules/FilterToggles'
import type { Tercero, CentroCosto, Concepto } from '../../types'
import type { ConfigFiltroExclusion } from '../../types/filters'
import { useCatalogo } from '../../hooks/useCatalogo'

interface FiltrosReporteProps {
    desde: string
    hasta: string
    onDesdeChange?: (val: string) => void
    setDesde?: (val: string) => void
    onHastaChange?: (val: string) => void
    setHasta?: (val: string) => void
    cuentaId: string
    onCuentaChange?: (val: string) => void
    setCuentaId?: (val: string) => void
    terceroId?: string
    onTerceroChange?: (val: string) => void
    setTerceroId?: (val: string) => void
    centroCostoId?: string
    onCentroCostoChange?: (val: string) => void
    setCentroCostoId?: (val: string) => void
    conceptoId?: string
    onConceptoChange?: (val: string) => void
    setConceptoId?: (val: string) => void
    terceros?: Tercero[]
    centrosCostos?: CentroCosto[]
    conceptos?: Concepto[]
    onLimpiar: () => void
    showClasificacionFilters?: boolean
    showIngresosEgresos?: boolean
    mostrarIngresos?: boolean
    onMostrarIngresosChange?: (val: boolean) => void
    setMostrarIngresos?: (val: boolean) => void
    mostrarEgresos?: boolean
    onMostrarEgresosChange?: (val: boolean) => void
    setMostrarEgresos?: (val: boolean) => void
    configuracionExclusion?: ConfigFiltroExclusion[]
    centrosCostosExcluidos?: number[]
    onCentrosCostosExcluidosChange?: (val: number[]) => void
    setCentrosCostosExcluidos?: (val: number[]) => void
    soloConciliables?: boolean
    extraActions?: React.ReactNode
}

export const FiltrosReporte = ({
    desde, hasta, onDesdeChange, setDesde,
    onHastaChange, setHasta,
    cuentaId, onCuentaChange, setCuentaId,
    terceroId, onTerceroChange, setTerceroId,
    centroCostoId, onCentroCostoChange, setCentroCostoId,
    conceptoId, onConceptoChange, setConceptoId,
    terceros = [], centrosCostos = [], conceptos = [],
    onLimpiar,
    showClasificacionFilters = true,
    showIngresosEgresos = true,
    mostrarIngresos = true, onMostrarIngresosChange, setMostrarIngresos,
    mostrarEgresos = true, onMostrarEgresosChange, setMostrarEgresos,
    configuracionExclusion = [],
    centrosCostosExcluidos = [], onCentrosCostosExcluidosChange, setCentrosCostosExcluidos,
    soloConciliables = true,
    extraActions
}: FiltrosReporteProps) => {

    // Helper to prioritize the new "set" naming convetion or the old "on" one
    const _onDesde = setDesde || onDesdeChange || (() => { })
    const _onHasta = setHasta || onHastaChange || (() => { })
    const _onCuenta = setCuentaId || onCuentaChange || (() => { })
    const _onTercero = setTerceroId || onTerceroChange || (() => { })
    const _onCentroCosto = setCentroCostoId || onCentroCostoChange || (() => { })
    const _onConcepto = setConceptoId || onConceptoChange || (() => { })
    const _onMostrarIngresos = setMostrarIngresos || onMostrarIngresosChange || (() => { })
    const _onMostrarEgresos = setMostrarEgresos || onMostrarEgresosChange || (() => { })
    const _onExcluidos = setCentrosCostosExcluidos || onCentrosCostosExcluidosChange || (() => { })

    const { terceros: catTerceros, centrosCostos: catCentros, conceptos: catConceptos } = useCatalogo()
    const finalTerceros = terceros.length > 0 ? terceros : catTerceros
    const finalCentrosCostos = centrosCostos.length > 0 ? centrosCostos : catCentros
    const finalConceptos = conceptos.length > 0 ? conceptos : catConceptos

    return (
        <div className="bg-white/90 backdrop-blur-xl border-b border-slate-200 sticky top-0 z-30 px-6 py-3 shadow-sm flex flex-col">
            {/* Fila 1: Botones de Rango */}
            <div className="flex items-center gap-3 mb-1.5">
                <DateRangeButtons
                    desde={desde}
                    hasta={hasta}
                    onDesdeChange={_onDesde}
                    onHastaChange={_onHasta}
                />
            </div>

            {/* Fila 2: Fechas y Cuenta */}
            <div className="flex flex-wrap items-end gap-6 mb-3">
                <div className="flex-1 min-w-[400px]">
                    <DateRangeInputs
                        desde={desde} hasta={hasta}
                        onDesdeChange={_onDesde} onHastaChange={_onHasta}
                    />
                </div>
                <div className="w-[300px]">
                    <label className="block text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2 px-1">
                        <span className="flex items-center gap-1.5 underline decoration-slate-200 underline-offset-4">Cuenta</span>
                    </label>
                    <SelectorCuenta
                        value={cuentaId}
                        onChange={_onCuenta}
                        soloConciliables={soloConciliables}
                        showTodas={true}
                    />
                </div>
            </div>

            {/* Fila 3: Clasificación y Reiniciar */}
            <div className="flex items-end gap-6 mb-3">
                <div className="flex-1">
                    {showClasificacionFilters && (
                        <ClassificationFilters
                            terceroId={terceroId} onTerceroChange={_onTercero}
                            centroCostoId={centroCostoId} onCentroCostoChange={_onCentroCosto}
                            conceptoId={conceptoId} onConceptoChange={_onConcepto}
                            terceros={finalTerceros}
                            centrosCostos={finalCentrosCostos}
                            conceptos={finalConceptos}
                        />
                    )}
                </div>
                <div className="flex items-center gap-2 mb-1.5">
                    <Button variant="ghost" size="sm" onClick={onLimpiar} className="text-slate-400 hover:text-indigo-600 font-bold p-2 h-auto flex items-center gap-2" icon={RotateCcw}>
                        <span className="text-[9px] uppercase tracking-widest">Reiniciar</span>
                    </Button>
                    {extraActions}
                </div>
            </div>

            {/* Fila 4: Filtros Avanzados */}
            <div className="flex items-center gap-6 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2 text-slate-400">
                    <Filter size={14} className="opacity-50" />
                    <span className="text-[9px] font-black uppercase tracking-[0.2em]">Filtros Avanzados</span>
                </div>

                <FilterToggles
                    mostrarIngresos={mostrarIngresos}
                    onMostrarIngresosChange={_onMostrarIngresos}
                    mostrarEgresos={mostrarEgresos}
                    onMostrarEgresosChange={_onMostrarEgresos}
                    showIngresosEgresos={showIngresosEgresos}
                    configuracionExclusion={configuracionExclusion}
                    centrosCostosExcluidos={centrosCostosExcluidos}
                    onCentrosCostosExcluidosChange={_onExcluidos}
                />
            </div>
        </div>
    )
}
