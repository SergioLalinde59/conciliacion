import { useState, useEffect, useMemo, useCallback } from 'react'
import { DashboardHero } from '../components/organisms/dashboard/DashboardHero'
import { DashboardBudget3Months } from '../components/organisms/dashboard/DashboardBudget3Months'
import { DashboardCashFlowChart } from '../components/organisms/dashboard/DashboardCashFlowChart'
import { DashboardTopExpenses } from '../components/organisms/dashboard/DashboardTopExpenses'
import { DashboardBudgetVsReal } from '../components/organisms/dashboard/DashboardBudgetVsReal'
import { dashboardService } from '../services/dashboard.service'
import { presupuestoService } from '../services/presupuesto.service'
import { apiService } from '../services/api'
import { getAnioYTD } from '../utils/dateUtils'
import type { FlujoCajaMes, ClasificacionItem } from '../services/dashboard.service'
import type { ComparacionPresupuesto, ResumenMensualPresupuesto, PresupuestoWidget } from '../types/Presupuesto'

export const DashboardPage = () => {
    // ---- ESTADO: solo fechas ----
    const [desde, setDesde] = useState(getAnioYTD().inicio)
    const [hasta, setHasta] = useState(getAnioYTD().fin)

    // ---- EXCLUSIONES (préstamos, tita, traslados) ----
    const [centrosExcluidos, setCentrosExcluidos] = useState<number[]>([])
    const [exclusionesListas, setExclusionesListas] = useState(false)

    // ---- DATA ----
    const [flujoMensual, setFlujoMensual] = useState<FlujoCajaMes[]>([])
    const [topEgresos, setTopEgresos] = useState<ClasificacionItem[]>([])
    const [pptoVsReal, setPptoVsReal] = useState<ComparacionPresupuesto[]>([])
    const [pptoMensual, setPptoMensual] = useState<ResumenMensualPresupuesto[]>([])
    const [cifrasCompactas, setCifrasCompactas] = useState(false)
    // ---- LOADING ----
    const [loadingFlujo, setLoadingFlujo] = useState(true)
    const [loadingTop, setLoadingTop] = useState(true)
    const [loadingPpto, setLoadingPpto] = useState(true)

    // ---- Cargar exclusiones al iniciar (gate: no cargar data hasta que estén listas) ----
    useEffect(() => {
        apiService.movimientos.obtenerConfiguracionFiltrosExclusion()
            .then(configs => {
                const defaults = configs
                    .filter(c => c.activo_por_defecto)
                    .map(c => c.centro_costo_id)
                setCentrosExcluidos(defaults)
            })
            .catch(console.error)
            .finally(() => setExclusionesListas(true))
    }, [])

    // ---- Totales para Hero ----
    const totales = useMemo(() => {
        return flujoMensual.reduce(
            (acc, m) => ({
                ingresos: acc.ingresos + m.ingresos,
                egresos: acc.egresos + m.egresos,
                saldo: acc.saldo + m.saldo,
            }),
            { ingresos: 0, egresos: 0, saldo: 0 }
        )
    }, [flujoMensual])

    // ---- Rango de meses del presupuesto (clamp a año actual para rangos cross-year) ----
    const { mesInicio, mesFin } = useMemo(() => {
        const anioActual = new Date().getFullYear()
        const desdeYear = parseInt(desde.substring(0, 4), 10)
        const hastaYear = parseInt(hasta.substring(0, 4), 10)
        return {
            mesInicio: desdeYear < anioActual ? 1 : parseInt(desde.substring(5, 7), 10),
            mesFin: hastaYear > anioActual ? 12 : parseInt(hasta.substring(5, 7), 10),
        }
    }, [desde, hasta])

    // ---- Presupuesto del período seleccionado ----
    const presupuestoPeriodo = useMemo(() => {
        if (!pptoMensual.length) return 0
        return pptoMensual
            .filter(m => m.mes >= mesInicio && m.mes <= mesFin)
            .reduce((sum, m) => sum + m.presupuestado, 0)
    }, [pptoMensual, mesInicio, mesFin])

    // ---- CARGA DE DATOS (espera exclusiones + depende de fechas) ----
    const cargarFlujo = useCallback(() => {
        if (!exclusionesListas) return
        setLoadingFlujo(true)
        dashboardService.flujoMensual(desde, hasta, centrosExcluidos)
            .then(setFlujoMensual)
            .catch(err => console.error('Error flujo mensual:', err))
            .finally(() => setLoadingFlujo(false))
    }, [desde, hasta, centrosExcluidos, exclusionesListas])

    const cargarTopEgresos = useCallback(() => {
        if (!exclusionesListas) return
        setLoadingTop(true)
        dashboardService.topEgresos(desde, hasta, 'centro_costo', centrosExcluidos)
            .then(setTopEgresos)
            .catch(err => console.error('Error top egresos:', err))
            .finally(() => setLoadingTop(false))
    }, [desde, hasta, centrosExcluidos, exclusionesListas])

    const cargarPresupuesto = useCallback(() => {
        if (!exclusionesListas) return
        const excluidos = centrosExcluidos.length ? centrosExcluidos : undefined
        presupuestoService.widget({ centros_costos_excluidos: excluidos })
            .then((widget: PresupuestoWidget) => {
                setCifrasCompactas(widget?.cifras_en_millones ?? false)
                if (widget?.tiene_presupuesto && widget.presupuesto_id) {
                    setLoadingPpto(true)
                    Promise.all([
                        presupuestoService.comparar(widget.presupuesto_id, {
                            nivel: 'centro_costo',
                            mes_inicio: mesInicio,
                            mes_fin: mesFin,
                            centros_costos_excluidos: excluidos,
                        }),
                        presupuestoService.compararMensual(widget.presupuesto_id, {
                            centros_costos_excluidos: excluidos,
                        }),
                    ])
                        .then(([comparacion, mensual]) => {
                            setPptoVsReal(comparacion)
                            setPptoMensual(mensual)
                        })
                        .catch(err => console.error('Error presupuesto:', err))
                        .finally(() => setLoadingPpto(false))
                } else {
                    setPptoVsReal([])
                    setPptoMensual([])
                    setLoadingPpto(false)
                }
            })
            .catch(err => {
                console.error('Error widget presupuesto:', err)
                setLoadingPpto(false)
            })
    }, [desde, hasta, centrosExcluidos, exclusionesListas, mesInicio, mesFin])

    // ---- EFECTOS: recargar al cambiar fechas o exclusiones ----
    useEffect(() => { cargarFlujo() }, [cargarFlujo])
    useEffect(() => { cargarTopEgresos() }, [cargarTopEgresos])
    useEffect(() => { cargarPresupuesto() }, [cargarPresupuesto])

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* HERO: KPIs + Date Pills */}
            <DashboardHero
                presupuesto={presupuestoPeriodo}
                ingresos={totales.ingresos}
                egresos={totales.egresos}
                flujoNeto={totales.saldo}
                desde={desde}
                hasta={hasta}
                onDesdeChange={setDesde}
                onHastaChange={setHasta}
                loading={loadingFlujo}
                compact={cifrasCompactas}
            />

            {/* PRESUPUESTO: 3 Meses Móvil */}
            <DashboardBudget3Months centrosExcluidos={centrosExcluidos} compact={cifrasCompactas} />

            {/* FLUJO DE CAJA MENSUAL: Full width chart */}
            <DashboardCashFlowChart
                data={flujoMensual}
                presupuestoMensual={pptoMensual}
                isLoading={loadingFlujo}
                compact={cifrasCompactas}
            />

            {/* BOTTOM GRID: Top Egresos + Ppto vs Real */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DashboardTopExpenses
                    data={topEgresos}
                    isLoading={loadingTop}
                    compact={cifrasCompactas}
                />
                <DashboardBudgetVsReal
                    data={pptoVsReal}
                    isLoading={loadingPpto}
                />
            </div>
        </div>
    )
}
