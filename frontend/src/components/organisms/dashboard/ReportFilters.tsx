import { DateRangeButtons, DateRangeInputs } from '../../molecules/DateRangeSelector'
import { FilterToggles } from '../../molecules/FilterToggles'
import { Button } from '../../atoms/Button'
import { RefreshCw } from 'lucide-react'
import { SelectorCuenta } from '../../molecules/SelectorCuenta'
import { ClassificationFilters } from '../../molecules/ClassificationFilters'

interface ReportFiltersProps {
    // Date Range
    fechaInicio: string
    fechaFin: string
    onFechaInicioChange: (val: string) => void
    onFechaFinChange: (val: string) => void

    // Classification Filters
    terceroId?: string
    onTerceroChange: (val: string) => void
    centroCostoId?: string
    onCentroCostoChange: (val: string) => void
    conceptoId?: string
    onConceptoChange: (val: string) => void

    // Account Filter
    cuentaId?: string
    onCuentaChange: (val: string) => void

    // Toggles


    mostrarIngresos: boolean
    onMostrarIngresosChange: (val: boolean) => void
    mostrarEgresos: boolean
    onMostrarEgresosChange: (val: boolean) => void

    configuracionExclusion: any[]
    centrosCostosExcluidos: number[]
    onCentrosCostosExcluidosChange: (ids: number[]) => void

    // Data
    terceros: any[]
    centrosCostos: any[]
    conceptos: any[]

    // Actions
    onReset: () => void
}

export const ReportFilters = ({
    fechaInicio,
    fechaFin,
    onFechaInicioChange,
    onFechaFinChange,

    terceroId,
    onTerceroChange,
    centroCostoId,
    onCentroCostoChange,
    conceptoId,
    onConceptoChange,

    cuentaId,
    onCuentaChange,



    mostrarIngresos,
    onMostrarIngresosChange,
    mostrarEgresos,
    onMostrarEgresosChange,

    configuracionExclusion,
    centrosCostosExcluidos,
    onCentrosCostosExcluidosChange,

    terceros,
    centrosCostos,
    conceptos,

    onReset
}: ReportFiltersProps) => {

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-6">
            {/* Fila 1: Botones por rangos de fecha definidos */}
            <div className="flex flex-col md:flex-row justify-start items-center gap-4">
                <DateRangeButtons
                    desde={fechaInicio}
                    hasta={fechaFin}
                    onDesdeChange={onFechaInicioChange}
                    onHastaChange={onFechaFinChange}
                />
            </div>

            {/* Fila 2: Desde - Hasta y La Cuenta */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-end">
                {/* Date Inputs - Assuming DateRangeInputs handles its own layout (usually 2 cols) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <DateRangeInputs
                        desde={fechaInicio}
                        hasta={fechaFin}
                        onDesdeChange={onFechaInicioChange}
                        onHastaChange={onFechaFinChange}
                    />
                </div>
                {/* Account Combo */}
                <SelectorCuenta
                    value={cuentaId || ''}
                    onChange={onCuentaChange}
                    showTodas={true}
                />
            </div>

            {/* Fila 3: Tercero - Centro de Costos y Concepto */}
            <ClassificationFilters
                terceroId={terceroId}
                onTerceroChange={onTerceroChange}
                centroCostoId={centroCostoId}
                onCentroCostoChange={onCentroCostoChange}
                conceptoId={conceptoId}
                onConceptoChange={onConceptoChange}
                terceros={terceros}
                centrosCostos={centrosCostos}
                conceptos={conceptos}
            />

            {/* Fila 4: Checkbox y Limpiar Filtros */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 pt-2 border-t border-gray-50 mt-4">
                <FilterToggles


                    showIngresosEgresos={true}
                    mostrarIngresos={mostrarIngresos}
                    onMostrarIngresosChange={onMostrarIngresosChange}
                    mostrarEgresos={mostrarEgresos}
                    onMostrarEgresosChange={onMostrarEgresosChange}

                    configuracionExclusion={configuracionExclusion}
                    centrosCostosExcluidos={centrosCostosExcluidos}
                    onCentrosCostosExcluidosChange={onCentrosCostosExcluidosChange}
                />

                <Button variant="ghost" size="sm" onClick={onReset} className="text-gray-500 hover:text-gray-700">
                    <RefreshCw size={14} className="mr-2" />
                    Limpiar Filtros
                </Button>
            </div>
        </div>
    )
}
