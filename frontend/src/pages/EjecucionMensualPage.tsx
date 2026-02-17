import { useState, useEffect, useMemo } from 'react'
import { usePresupuestos, usePresupuestoComparacionMensual } from '../hooks/usePresupuesto'
import { useConfiguracionExclusion } from '../hooks/useReportes'
import { BudgetExecutionTable } from '../components/organisms/BudgetExecutionTable'
import { FiltrosReporte } from '../components/organisms/FiltrosReporte'
import { Calendar } from 'lucide-react'

export const EjecucionMensualPage = () => {
    const { data: presupuestos = [] } = usePresupuestos()
    const { data: configExclusion = [], isFetched: exclusionConfigLoaded } = useConfiguracionExclusion()

    const [presupuestoId, setPresupuestoId] = useState<number>(0)

    // Filtros
    const [terceroId, setTerceroId] = useState('')
    const [centroCostoId, setCentroCostoId] = useState('')
    const [conceptoId, setConceptoId] = useState('')
    const [mostrarIngresos, setMostrarIngresos] = useState(true)
    const [mostrarEgresos, setMostrarEgresos] = useState(true)

    // CC Exclusion
    const [centrosCostosExcluidos, setCentrosCostosExcluidos] = useState<number[] | null>(null)
    const actualCentrosCostosExcluidos = useMemo(() => centrosCostosExcluidos ?? [], [centrosCostosExcluidos])

    // Seleccionar presupuesto activo por defecto
    const selectedPresupuesto = presupuestos.find(p => p.id === presupuestoId)

    useEffect(() => {
        if (presupuestos.length > 0 && !presupuestoId) {
            const activo = presupuestos.find(p => p.estado === 'activo')
            setPresupuestoId(activo?.id || presupuestos[0].id)
        }
    }, [presupuestos, presupuestoId])

    // Cargar exclusiones por defecto
    useEffect(() => {
        if (exclusionConfigLoaded && centrosCostosExcluidos === null) {
            const defaults = configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id)
            setCentrosCostosExcluidos(defaults)
        }
    }, [configExclusion, centrosCostosExcluidos, exclusionConfigLoaded])

    const ccIdFilter = centroCostoId ? Number(centroCostoId) : undefined
    const conceptoIdFilter = conceptoId ? Number(conceptoId) : undefined
    const terceroIdFilter = terceroId ? Number(terceroId) : undefined

    const mensualParams = useMemo(() => ({
        centros_costos_excluidos: actualCentrosCostosExcluidos.length > 0 ? actualCentrosCostosExcluidos : undefined,
        centro_costo_id: ccIdFilter,
        concepto_id: conceptoIdFilter,
        tercero_id: terceroIdFilter,
    }), [actualCentrosCostosExcluidos, ccIdFilter, conceptoIdFilter, terceroIdFilter])

    const { data: mensual = [], isLoading } = usePresupuestoComparacionMensual(presupuestoId, mensualParams)

    const handleLimpiar = () => {
        setTerceroId('')
        setCentroCostoId('')
        setConceptoId('')
        setMostrarIngresos(true)
        setMostrarEgresos(true)
        if (configExclusion.length > 0) {
            setCentrosCostosExcluidos(configExclusion.filter(d => d.activo_por_defecto).map(d => d.centro_costo_id))
        } else {
            setCentrosCostosExcluidos([])
        }
    }

    return (
        <div className="flex flex-col h-full bg-slate-50/50 overflow-hidden">
            {/* Header */}
            <div className="px-6 pt-6 pb-2 bg-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
                        <Calendar className="w-6 h-6" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900">Ejecución Mensual</h1>
                        <p className="text-slate-500 text-sm mt-0.5">Detalle mes a mes: año anterior, presupuestado, ejecutado, variación y consumo</p>
                    </div>
                </div>
                <select
                    value={presupuestoId}
                    onChange={e => setPresupuestoId(parseInt(e.target.value))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                >
                    {presupuestos.map(p => (
                        <option key={p.id} value={p.id}>
                            {p.nombre} ({p.anio}) - {p.estado}
                        </option>
                    ))}
                </select>
            </div>

            {/* Filtros */}
            <FiltrosReporte
                terceroId={terceroId} setTerceroId={setTerceroId}
                centroCostoId={centroCostoId} setCentroCostoId={setCentroCostoId}
                conceptoId={conceptoId} setConceptoId={setConceptoId}
                configuracionExclusion={configExclusion}
                centrosCostosExcluidos={actualCentrosCostosExcluidos}
                setCentrosCostosExcluidos={setCentrosCostosExcluidos}
                mostrarIngresos={mostrarIngresos}
                setMostrarIngresos={setMostrarIngresos}
                mostrarEgresos={mostrarEgresos}
                setMostrarEgresos={setMostrarEgresos}
                onLimpiar={handleLimpiar}
                showIngresosEgresos={false}
                showClasificacionFilters={true}
            />

            {/* Contenido */}
            <div className="flex-1 min-h-0 p-6 overflow-auto">
                {isLoading ? (
                    <div className="flex items-center justify-center py-20 text-slate-400">Cargando datos...</div>
                ) : (
                    <BudgetExecutionTable
                        data={mensual}
                        semaforoVerde={selectedPresupuesto?.semaforo_verde_hasta}
                        semaforoAmarillo={selectedPresupuesto?.semaforo_amarillo_hasta}
                        compact={selectedPresupuesto?.cifras_en_millones}
                    />
                )}
            </div>
        </div>
    )
}
