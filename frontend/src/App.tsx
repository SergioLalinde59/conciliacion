import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { MainLayout } from './components/templates/MainLayout'
import { DashboardPage } from './pages/DashboardPage'
import { CuentasPage } from './pages/CuentasPage'
import { MonedasPage } from './pages/MonedasPage'
import { TiposMovimientoPage } from './pages/TiposMovimientoPage'
import { TercerosPage } from './pages/TercerosPage'
import { TerceroDescripcionesPage } from './pages/TerceroDescripcionesPage'
import { CentrosCostosPage } from './pages/CentrosCostosPage'
import { ConceptosPage } from './pages/ConceptosPage'
import { MovimientosPage } from './pages/MovimientosPage'
import { MovimientoFormPage } from './pages/MovimientoFormPage'
import { ReporteClasificacionesPage } from './pages/ReporteClasificacionesPage'
import { ClasificarMovimientosPage } from './pages/ClasificarMovimientosPage'
import { ReporteIngresosGastosMesPage } from './pages/ReporteIngresosGastosMesPage'
import { UploadMovimientosPage } from './pages/UploadMovimientosPage'
import { UploadExtractoPage } from './pages/UploadExtractoPage'
import { ReglasPage } from './pages/ReglasPage'
import { ReglasNormalizacionPage } from './pages/ReglasNormalizacionPage'
import { CuentaExtractoresPage } from './pages/CuentaExtractoresPage'
import { DescargarMovimientosPage } from './pages/DescargarMovimientosPage'
import { SugerenciasReclasificacionPage } from './pages/SugerenciasReclasificacionPage'
import { ReporteEgresosTerceroPage } from './pages/ReporteEgresosTerceroPage'
import { ReporteEgresosCentroCostoPage } from './pages/ReporteEgresosCentroCostoPage'
import { ConfigFiltrosCentrosCostosPage } from './pages/ConfigFiltrosCentrosCostosPage'
import { ConfigValoresPendientesPage } from './pages/ConfigValoresPendientesPage'
import { ConciliacionPage } from './pages/ConciliacionPage'
import { ConciliacionMatchingPage } from './pages/ConciliacionMatchingPage'
import { CentroControlDatosPage } from './pages/CentroControlDatosPage'
import { MatchingConfigPage } from './pages/MatchingConfigPage'
import { TiposCuentaPage } from './pages/TiposCuentaPage'

import { ReconciliationResetPage } from './pages/ReconciliationResetPage'
import { ReclasificarMovimientosPage } from './pages/mantenimiento/ReclasificarMovimientosPage'
import { ExportarEstructuraPage } from './pages/mantenimiento/ExportarEstructuraPage'
import { ResetDemoPage } from './pages/ResetDemoPage'
import { PresupuestosPage } from './pages/PresupuestosPage'
import { PresupuestoDetallePage } from './pages/PresupuestoDetallePage'
import { PresupuestoVsRealPage } from './pages/PresupuestoVsRealPage'
import { PresupuestoConfigPage } from './pages/PresupuestoConfigPage'
import { TiposGastoPage } from './pages/TiposGastoPage'
import { IndicadoresEconomicosPage } from './pages/IndicadoresEconomicosPage'
import { ReglasPresupuestoPage } from './pages/ReglasPresupuestoPage'
import { ClasificacionGastosPreviewPage } from './pages/ClasificacionGastosPreviewPage'
import { EjecucionMensualPage } from './pages/EjecucionMensualPage'
import { ComparativoCifrasPage } from './pages/ComparativoCifrasPage'
import { ComparacionVersionesPage } from './pages/ComparacionVersionesPage'


function App() {
    return (
        <Router>
            <MainLayout>
                <Routes>
                    <Route path="/" element={<DashboardPage />} />
                    <Route path="/maestros/monedas" element={<MonedasPage />} />
                    <Route path="/maestros/cuentas" element={<CuentasPage />} />
                    <Route path="/maestros/tipos-movimiento" element={<TiposMovimientoPage />} />
                    <Route path="/maestros/terceros" element={<TercerosPage />} />
                    <Route path="/maestros/terceros-descripciones" element={<TerceroDescripcionesPage />} />
                    <Route path="/maestros/centros-costos" element={<CentrosCostosPage />} />
                    <Route path="/maestros/conceptos" element={<ConceptosPage />} />
                    <Route path="/maestros/config-filtros" element={<ConfigFiltrosCentrosCostosPage />} />
                    <Route path="/maestros/config-valores-pendientes" element={<ConfigValoresPendientesPage />} />
                    <Route path="/maestros/reglas" element={<ReglasPage />} />
                    <Route path="/maestros/alias" element={<ReglasNormalizacionPage />} />
                    <Route path="/maestros/extractores" element={<CuentaExtractoresPage />} />
                    <Route path="/maestros/matching" element={<MatchingConfigPage />} />
                    <Route path="/maestros/tipos-cuenta" element={<TiposCuentaPage />} />
                    <Route path="/maestros/presupuesto-config" element={<PresupuestoConfigPage />} />
                    <Route path="/movimientos" element={<MovimientosPage />} />
                    <Route path="/movimientos/cargar" element={<UploadMovimientosPage />} />
                    <Route path="/conciliacion/cargar-extracto" element={<UploadExtractoPage />} />
                    <Route path="/movimientos/nuevo" element={<MovimientoFormPage />} />
                    <Route path="/movimientos/reporte" element={<ReporteClasificacionesPage />} />
                    <Route path="/movimientos/sugerencias" element={<SugerenciasReclasificacionPage />} />
                    <Route path="/reportes/egresos-tercero" element={<ReporteEgresosTerceroPage />} />
                    <Route path="/reportes/egresos-centro-costo" element={<ReporteEgresosCentroCostoPage />} />
                    <Route path="/reportes/ingresos-gastos" element={<ReporteIngresosGastosMesPage />} />
                    <Route path="/reportes/descargar" element={<DescargarMovimientosPage />} />
                    <Route path="/movimientos/clasificar" element={<ClasificarMovimientosPage />} />
                    <Route path="/movimientos/editar/:id" element={<MovimientoFormPage />} />
                    <Route path="/conciliacion" element={<ConciliacionPage />} />
                    <Route path="/conciliacion/matching" element={<ConciliacionMatchingPage />} />
                    <Route path="/herramientas/control-datos" element={<CentroControlDatosPage />} />
                    <Route path="/herramientas/mantenimiento/reset-periodo" element={<ReconciliationResetPage />} />
                    <Route path="/herramientas/mantenimiento/reclasificar-movimientos" element={<ReclasificarMovimientosPage />} />
                    <Route path="/admin/reset-demo" element={<ResetDemoPage />} />
                    <Route path="/presupuestos" element={<PresupuestosPage />} />
                    <Route path="/presupuestos/:id/detalle" element={<PresupuestoDetallePage />} />
                    <Route path="/presupuestos/:id/comparar-versiones" element={<ComparacionVersionesPage />} />
                    <Route path="/presupuestos/tipos-gasto" element={<TiposGastoPage />} />
                    <Route path="/presupuestos/indicadores" element={<IndicadoresEconomicosPage />} />
                    <Route path="/presupuestos/reglas" element={<ReglasPresupuestoPage />} />
                    <Route path="/presupuestos/clasificacion" element={<ClasificacionGastosPreviewPage />} />
                    <Route path="/presupuestos/ejecucion-mensual" element={<EjecucionMensualPage />} />
                    <Route path="/presupuestos/comparativo-cifras" element={<ComparativoCifrasPage />} />
                    <Route path="/reportes/presupuesto-vs-real" element={<PresupuestoVsRealPage />} />
                    <Route path="/herramientas/mantenimiento/exportar-estructura" element={<ExportarEstructuraPage />} />
                    <Route path="/herramientas/mantenimiento/:categoria" element={<CentroControlDatosPage />} />
                    <Route path="/mvtos/*" element={
                        <div className="p-8">
                            <h1 className="text-2xl font-bold text-gray-400">Próximamente</h1>
                            <p className="text-gray-500">Módulo de movimientos en construcción.</p>
                        </div>
                    } />
                </Routes>
            </MainLayout>
        </Router>
    )
}

export default App
