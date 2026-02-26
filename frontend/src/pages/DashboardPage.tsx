import { useState, useEffect, useMemo, useCallback } from 'react'
import { DashboardHero } from '../components/organisms/dashboard/DashboardHero'
import { DashboardBudget3Months } from '../components/organisms/dashboard/DashboardBudget3Months'
import { DashboardCashFlowChart } from '../components/organisms/dashboard/DashboardCashFlowChart'
import { DashboardTopExpenses } from '../components/organisms/dashboard/DashboardTopExpenses'
import { DashboardBudgetVsReal } from '../components/organisms/dashboard/DashboardBudgetVsReal'
import { dashboardService } from '../services/dashboard.service'
import { presupuestoService } from '../services/presupuesto.service'
import { usePerspectiva } from '../hooks/usePerspectiva'
import { getAnioYTD } from '../utils/dateUtils'
import { useSettings } from '../context/SettingsContext'
import type { FlujoCajaMes, ClasificacionItem } from '../services/dashboard.service'
import type { ComparacionPresupuesto, ResumenMensualPresupuesto, PresupuestoWidget } from '../types/Presupuesto'

export const DashboardPage = () => {
    // ---- ESTADO: solo fechas ----
    const [desde, setDesde] = useState(getAnioYTD().inicio)
    const [hasta, setHasta] = useState(getAnioYTD().fin)

    // ---- PERSPECTIVA (reemplaza exclusiones manuales) ----
    const { perspectivas, selectedSlug, setSelectedSlug, filterParams, ready: perspectivaReady } = usePerspectiva()
    const centrosExcluidos = filterParams.centros_costos_excluidos
    const centrosIncluidos = filterParams.centros_costos_incluidos

    // ---- DATA ----
    const [flujoMensual, setFlujoMensual] = useState<FlujoCajaMes[]>([])
    const [topEgresos, setTopEgresos] = useState<ClasificacionItem[]>([])
    const [pptoVsReal, setPptoVsReal] = useState<ComparacionPresupuesto[]>([])
    const [pptoVsRealIngresos, setPptoVsRealIngresos] = useState<ComparacionPresupuesto[]>([])
    const [pptoMensual, setPptoMensual] = useState<ResumenMensualPresupuesto[]>([])
    const [pptoMensualIngresos, setPptoMensualIngresos] = useState<ResumenMensualPresupuesto[]>([])
    const [flujoAnterior, setFlujoAnterior] = useState<FlujoCajaMes[]>([])
    const [anioPresupuesto, setAnioPresupuesto] = useState<number>(new Date().getFullYear())
    const { cifrasEnMillones } = useSettings()
    // ---- LOADING ----
    const [loadingFlujo, setLoadingFlujo] = useState(true)
    const [loadingTop, setLoadingTop] = useState(true)
    const [loadingPpto, setLoadingPpto] = useState(true)

    // Gate: no cargar data hasta que perspectiva esté lista
    const exclusionesListas = perspectivaReady

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

    const presupuestoIngresosPeriodo = useMemo(() => {
        if (!pptoMensualIngresos.length) return 0
        return pptoMensualIngresos
            .filter(m => m.mes >= mesInicio && m.mes <= mesFin)
            .reduce((sum, m) => sum + m.presupuestado, 0)
    }, [pptoMensualIngresos, mesInicio, mesFin])

    // ---- Gastos sin presupuestar acumulados ----
    const gastosSinPpto = useMemo(() => {
        if (!pptoVsReal.length) return 0
        return pptoVsReal.reduce((sum, d) => sum + (d.ejecutado_sin_ppto ?? 0), 0)
    }, [pptoVsReal])

    // ---- Fechas año anterior (shift -1 year) ----
    const desdeAnterior = useMemo(() => `${parseInt(desde.substring(0, 4), 10) - 1}${desde.substring(4)}`, [desde])
    const hastaAnterior = useMemo(() => `${parseInt(hasta.substring(0, 4), 10) - 1}${hasta.substring(4)}`, [hasta])

    // ---- Sin presupuesto por centro (para popover del Hero) ----
    const sinPptoDetalle = useMemo(() => {
        return pptoVsReal
            .filter(d => (d.ejecutado_sin_ppto ?? 0) >= 1000)
            .map(d => ({ nombre: d.nombre, monto: d.ejecutado_sin_ppto ?? 0 }))
            .sort((a, b) => b.monto - a.monto)
    }, [pptoVsReal])

    // ---- Totales año anterior ----
    const totalesAnterior = useMemo(() => {
        return flujoAnterior.reduce(
            (acc, m) => ({
                ingresos: acc.ingresos + m.ingresos,
                egresos: acc.egresos + m.egresos,
                saldo: acc.saldo + m.saldo,
            }),
            { ingresos: 0, egresos: 0, saldo: 0 }
        )
    }, [flujoAnterior])

    // ---- CARGA DE DATOS (espera exclusiones + depende de fechas) ----
    const cargarFlujo = useCallback(() => {
        if (!exclusionesListas) return
        setLoadingFlujo(true)
        dashboardService.flujoMensual(desde, hasta, centrosExcluidos, undefined, centrosIncluidos)
            .then(setFlujoMensual)
            .catch(err => console.error('Error flujo mensual:', err))
            .finally(() => setLoadingFlujo(false))
    }, [desde, hasta, centrosExcluidos, centrosIncluidos, exclusionesListas])

    const cargarTopEgresos = useCallback(() => {
        if (!exclusionesListas) return
        setLoadingTop(true)
        dashboardService.topEgresos(desde, hasta, 'centro_costo', centrosExcluidos, centrosIncluidos)
            .then(setTopEgresos)
            .catch(err => console.error('Error top egresos:', err))
            .finally(() => setLoadingTop(false))
    }, [desde, hasta, centrosExcluidos, centrosIncluidos, exclusionesListas])

    const cargarFlujoAnterior = useCallback(() => {
        if (!exclusionesListas) return
        dashboardService.flujoMensual(desdeAnterior, hastaAnterior, centrosExcluidos, undefined, centrosIncluidos)
            .then(setFlujoAnterior)
            .catch(err => console.error('Error flujo anterior:', err))
    }, [desdeAnterior, hastaAnterior, centrosExcluidos, centrosIncluidos, exclusionesListas])

    const cargarPresupuesto = useCallback(async () => {
        if (!exclusionesListas) return
        const excluidos = centrosExcluidos?.length ? centrosExcluidos : undefined
        const incluidos = centrosIncluidos?.length ? centrosIncluidos : undefined
        try {
            const widget: PresupuestoWidget = await presupuestoService.widget({ centros_costos_excluidos: excluidos, centros_costos_incluidos: incluidos })
            if (widget?.tiene_presupuesto && widget.presupuesto_id) {
                setLoadingPpto(true)
                const [comparacion, comparacionIngresos, mensual, mensualIngresos, pptoActual] = await Promise.all([
                    presupuestoService.comparar(widget.presupuesto_id, {
                        nivel: 'centro_costo',
                        mes_inicio: mesInicio,
                        mes_fin: mesFin,
                        centros_costos_excluidos: excluidos,
                        centros_costos_incluidos: incluidos,
                    }),
                    presupuestoService.comparar(widget.presupuesto_id, {
                        nivel: 'centro_costo',
                        mes_inicio: mesInicio,
                        mes_fin: mesFin,
                        centros_costos_excluidos: excluidos,
                        centros_costos_incluidos: incluidos,
                        direccion: 'ingreso',
                    }),
                    presupuestoService.compararMensual(widget.presupuesto_id, {
                        centros_costos_excluidos: excluidos,
                        centros_costos_incluidos: incluidos,
                    }),
                    presupuestoService.compararMensual(widget.presupuesto_id, {
                        centros_costos_excluidos: excluidos,
                        centros_costos_incluidos: incluidos,
                        direccion: 'ingreso',
                    }),
                    presupuestoService.obtener(widget.presupuesto_id),
                ])
                setPptoVsReal(comparacion)
                setPptoVsRealIngresos(comparacionIngresos)
                setPptoMensual(mensual)
                setPptoMensualIngresos(mensualIngresos)
                setAnioPresupuesto(pptoActual.anio)
                setLoadingPpto(false)
            } else {
                setPptoVsReal([])
                setPptoVsRealIngresos([])
                setPptoMensual([])
                setPptoMensualIngresos([])
                setLoadingPpto(false)
            }
        } catch (err) {
            console.error('Error presupuesto:', err)
            setLoadingPpto(false)
        }
    }, [centrosExcluidos, centrosIncluidos, exclusionesListas, mesInicio, mesFin])

    // ---- EFECTOS: recargar al cambiar fechas o exclusiones ----
    useEffect(() => { cargarFlujo() }, [cargarFlujo])
    useEffect(() => { cargarFlujoAnterior() }, [cargarFlujoAnterior])
    useEffect(() => { cargarTopEgresos() }, [cargarTopEgresos])
    useEffect(() => { cargarPresupuesto() }, [cargarPresupuesto])

    return (
        <div className="max-w-7xl mx-auto space-y-6">
            {/* HERO: KPIs + Date Pills + Perspectiva */}
            <DashboardHero
                realAnterior={totalesAnterior}
                anioAnterior={parseInt(desde.substring(0, 4), 10) - 1}
                presupuesto={presupuestoPeriodo}
                presupuestoIngresos={presupuestoIngresosPeriodo}
                anioCurrent={anioPresupuesto}
                ingresos={totales.ingresos}
                egresos={totales.egresos}
                flujoNeto={totales.saldo}
                gastosSinPpto={gastosSinPpto}
                sinPptoDetalle={sinPptoDetalle}
                desde={desde}
                hasta={hasta}
                onDesdeChange={setDesde}
                onHastaChange={setHasta}
                loading={loadingFlujo}
                compact={cifrasEnMillones}
                perspectivas={perspectivas}
                selectedSlug={selectedSlug}
                onPerspectivaChange={setSelectedSlug}
            />

            {/* PRESUPUESTO: 3 Meses Móvil */}
            <DashboardBudget3Months centrosExcluidos={centrosExcluidos} centrosIncluidos={centrosIncluidos} compact={cifrasEnMillones} />

            {/* FLUJO DE CAJA MENSUAL: Full width chart */}
            <DashboardCashFlowChart
                data={flujoMensual}
                presupuestoMensual={pptoMensual}
                presupuestoMensualIngresos={pptoMensualIngresos}
                isLoading={loadingFlujo}
                compact={cifrasEnMillones}
            />

            {/* BOTTOM GRID: Top Egresos + Ppto vs Real */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DashboardTopExpenses
                    data={topEgresos}
                    isLoading={loadingTop}
                    compact={cifrasEnMillones}
                />
                <DashboardBudgetVsReal
                    dataEgresos={pptoVsReal}
                    dataIngresos={pptoVsRealIngresos}
                    presupuestoEgresos={presupuestoPeriodo}
                    presupuestoIngresos={presupuestoIngresosPeriodo}
                    egresosReales={totales.egresos}
                    ingresosReales={totales.ingresos}
                    isLoading={loadingPpto}
                />
            </div>
        </div>
    )
}
