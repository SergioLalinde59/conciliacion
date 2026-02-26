import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    LayoutDashboard,
    Wallet,
    Coins,
    ArrowRightLeft,
    Users,
    Layers,
    Tags,
    Receipt,
    ListTodo,
    UploadCloud,
    Zap,
    ChevronDown,
    ChevronRight,
    Download,
    TrendingUp,
    Sparkles,
    PieChart,
    Filter,
    FileText,
    FileCog,
    GitCompare,
    RefreshCw,
    Shield,
    Settings,
    HardDrive,
    AlertCircle,
    Unlink,
    Scale,
    Database,
    Calculator,
    Target,
    Eye,
    Calendar
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

export const Sidebar = () => {
    const { showDecimals, toggleShowDecimals, cifrasEnMillones, toggleCifrasEnMillones } = useSettings();
    const location = useLocation();

    const sectionMenus: Record<string, { path: string }[]> = useMemo(() => ({
        movimientos: [
            { path: '/movimientos' },
            { path: '/movimientos/clasificar' },
            { path: '/movimientos/cargar' },
            { path: '/conciliacion/cargar-extracto' },
            { path: '/conciliacion/matching' },
            { path: '/herramientas/mantenimiento/reclasificar-movimientos' },
            { path: '/movimientos/sugerencias' },
        ],
        reportes: [
            { path: '/reportes/egresos-centro-costo' },
            { path: '/reportes/egresos-tercero' },
            { path: '/reportes/ingresos-gastos' },
            { path: '/reportes/descargar' },
        ],
        presupuestos: [
            { path: '/reportes/presupuesto-vs-real' },
            { path: '/presupuestos/reglas' },
            { path: '/presupuestos/ejecucion-mensual' },
            { path: '/presupuestos/clasificacion' },
            { path: '/presupuestos/indicadores' },
            { path: '/presupuestos/tipos-gasto' },
            { path: '/maestros/presupuesto-config' },
        ],
        configuracion: [
            { path: '/maestros/tipos-cuenta' },
            { path: '/maestros/config-filtros' },
            { path: '/maestros/config-valores-pendientes' },
            { path: '/maestros/reglas' },
            { path: '/maestros/alias' },
            { path: '/maestros/extractores' },
            { path: '/maestros/matching' },
        ],
        maestros: [
            { path: '/maestros/cuentas' },
            { path: '/maestros/monedas' },
            { path: '/maestros/tipos-movimiento' },
            { path: '/maestros/terceros' },
            { path: '/maestros/terceros-descripciones' },
            { path: '/maestros/centros-costos' },
            { path: '/maestros/conceptos' },
        ],
        mantenimiento: [
            { path: '/herramientas/mantenimiento/reset-periodo' },
            { path: '/admin/reset-demo' },
            { path: '/herramientas/mantenimiento/configuracion' },
            { path: '/herramientas/mantenimiento/backups' },
            { path: '/herramientas/mantenimiento/maestros' },
            { path: '/herramientas/mantenimiento/presupuestos' },
            { path: '/herramientas/mantenimiento/exportar-estructura' },
            { path: '/herramientas/mantenimiento/sistema' },
        ],
    }), []);

    const getActiveSection = (pathname: string): string | null => {
        for (const [section, items] of Object.entries(sectionMenus)) {
            if (items.some(item => pathname === item.path || pathname.startsWith(item.path + '/'))) {
                return section;
            }
        }
        return null;
    };

    const [manualToggle, setManualToggle] = useState<string | null>(null);
    const activeSection = getActiveSection(location.pathname);

    useEffect(() => {
        setManualToggle(null);
    }, [location.pathname]);

    const isSectionExpanded = (sectionKey: string): boolean => {
        if (manualToggle !== null) {
            return manualToggle === sectionKey;
        }
        return sectionKey === activeSection;
    };

    const toggleSection = (section: string) => {
        if (isSectionExpanded(section)) {
            setManualToggle('__none__');
        } else {
            setManualToggle(section);
        }
    };

    const menuMaestros = [
        { name: 'Cuentas', path: '/maestros/cuentas', icon: Wallet },
        { name: 'Monedas', path: '/maestros/monedas', icon: Coins },
        { name: 'Tipo de Movimientos', path: '/maestros/tipos-movimiento', icon: ArrowRightLeft },
        { name: 'Terceros', path: '/maestros/terceros', icon: Users },
        { name: 'Alias Terceros', path: '/maestros/terceros-descripciones', icon: ListTodo },
        { name: 'Centros de Costos', path: '/maestros/centros-costos', icon: Layers },
        { name: 'Conceptos', path: '/maestros/conceptos', icon: Tags },
    ];

    const menuConfiguracion = [
        { name: 'Tipos de Cuenta', path: '/maestros/tipos-cuenta', icon: Scale },
        { name: 'Perspectivas', path: '/maestros/perspectivas', icon: Eye },
        { name: 'Config. Filtros', path: '/maestros/config-filtros', icon: Filter },
        { name: 'Config. Valores Pendientes', path: '/maestros/config-valores-pendientes', icon: AlertCircle },
        { name: 'Reglas Auto', path: '/maestros/reglas', icon: Zap },
        { name: 'Reglas Normalización', path: '/maestros/alias', icon: RefreshCw },
        { name: 'Extractores', path: '/maestros/extractores', icon: FileCog },
        { name: 'Matching Inteligente', path: '/maestros/matching', icon: Settings },
    ];

    const menuMovimientos = [
        { name: 'Movimientos', path: '/movimientos', icon: Receipt },
        { name: 'Por Clasificar', path: '/movimientos/clasificar', icon: ListTodo },
        { name: 'Cargar Movimiento', path: '/movimientos/cargar', icon: UploadCloud },
        { name: 'Cargar Extractos', path: '/conciliacion/cargar-extracto', icon: FileText },
        { name: 'Matching Inteligente', path: '/conciliacion/matching', icon: GitCompare },
        { name: 'Reclasificar Movimientos', path: '/herramientas/mantenimiento/reclasificar-movimientos', icon: Unlink },
        { name: 'Sugerencias Reclasif.', path: '/movimientos/sugerencias', icon: Sparkles },
    ];

    const menuReportes = [
        { name: 'Egresos por Centro Costo', path: '/reportes/egresos-centro-costo', icon: Layers },
        { name: 'Egresos por Tercero', path: '/reportes/egresos-tercero', icon: PieChart },
        { name: 'Ingresos y Gastos', path: '/reportes/ingresos-gastos', icon: TrendingUp },
        { name: 'Descargar Movimientos', path: '/reportes/descargar', icon: Download },
    ];

    const menuPresupuestos = [
        { name: 'Ppto vs Real', path: '/reportes/presupuesto-vs-real', icon: Target },
        { name: 'Reglas Clasificación', path: '/presupuestos/reglas', icon: Zap },

        { name: 'Ejecución Mensual', path: '/presupuestos/ejecucion-mensual', icon: Calendar },
        { name: 'Clasif. Gastos', path: '/presupuestos/clasificacion', icon: Eye },
        { name: 'Indicadores Económicos', path: '/presupuestos/indicadores', icon: TrendingUp },
        { name: 'Tipos de Gasto', path: '/presupuestos/tipos-gasto', icon: Tags },
        { name: 'Config. Ppto', path: '/maestros/presupuesto-config', icon: Settings },
    ];

    const menuMantenimiento = [
        { name: 'Reiniciar Conciliación', path: '/herramientas/mantenimiento/reset-periodo', icon: RefreshCw },
        { name: 'Reset Demo', path: '/admin/reset-demo', icon: Database },
        { name: 'Configuración', path: '/herramientas/mantenimiento/configuracion', icon: Settings },
        { name: 'Datos', path: '/herramientas/mantenimiento/backups', icon: Download },
        { name: 'Maestros', path: '/herramientas/mantenimiento/maestros', icon: Shield },
        { name: 'Presupuestos', path: '/herramientas/mantenimiento/presupuestos', icon: Calculator },
        { name: 'BD Estructura', path: '/herramientas/mantenimiento/exportar-estructura', icon: HardDrive },
        { name: 'Sistema Completo', path: '/herramientas/mantenimiento/sistema', icon: HardDrive },
    ];

    const isActive = (path: string) => location.pathname === path;

    const renderMenuSection = (title: string, items: any[], sectionKey: string) => (
        <div className="px-4 mt-4">
            <button
                onClick={() => toggleSection(sectionKey)}
                className="w-full flex items-center justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 hover:text-slate-300 transition-colors"
            >
                <span>{title}</span>
                {isSectionExpanded(sectionKey) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            <div className={`space-y-1 overflow-hidden transition-all duration-300 ${isSectionExpanded(sectionKey) ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
                }`}>
                {items.map((item) => {
                    const Icon = item.icon;
                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-all ${isActive(item.path)
                                ? 'bg-slate-800 text-blue-400 border-r-2 border-blue-400'
                                : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                                }`}
                        >
                            <Icon size={18} />
                            <span className="font-medium text-sm">{item.name}</span>
                        </Link>
                    );
                })}
            </div>
        </div>
    );

    return (
        <aside className="w-64 bg-slate-900 text-white min-h-screen flex flex-col shadow-xl no-print">
            <div className="p-4 border-b border-slate-800">
                <h2 className="text-xl font-bold flex items-center gap-2">
                    <span className="text-blue-400 text-2xl">⚡</span> Movimientos Bancarios
                </h2>
                <p className="text-slate-500 text-xs mt-1">Gestión Hexagonal</p>
            </div>

            <nav className="flex-1 py-4 overflow-y-auto">
                <div className="px-4 mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Principal</p>
                    <Link
                        to="/"
                        className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${location.pathname === '/'
                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50'
                            : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                            }`}
                    >
                        <LayoutDashboard size={20} />
                        <span className="font-medium">Dashboard</span>
                    </Link>
                </div>

                {renderMenuSection('Movimientos', menuMovimientos, 'movimientos')}
                {renderMenuSection('Reportes', menuReportes, 'reportes')}
                {renderMenuSection('Presupuestos', menuPresupuestos, 'presupuestos')}
                {renderMenuSection('Configuración', menuConfiguracion, 'configuracion')}
                {renderMenuSection('Maestros', menuMaestros, 'maestros')}
                {renderMenuSection('Mantenimiento', menuMantenimiento, 'mantenimiento')}
            </nav>


            <div className="p-4 border-t border-slate-800">
                <div className="mb-3">
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={cifrasEnMillones}
                                onChange={toggleCifrasEnMillones}
                            />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${cifrasEnMillones ? 'bg-blue-600' : 'bg-slate-700'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${cifrasEnMillones ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-slate-400 text-xs font-medium">
                            Cifras (mm)
                        </div>
                    </label>
                </div>
                <div className="mb-4">
                    <label className="flex items-center cursor-pointer">
                        <div className="relative">
                            <input
                                type="checkbox"
                                className="sr-only"
                                checked={showDecimals}
                                onChange={toggleShowDecimals}
                            />
                            <div className={`block w-10 h-6 rounded-full transition-colors ${showDecimals ? 'bg-blue-600' : 'bg-slate-700'}`}></div>
                            <div className={`dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showDecimals ? 'transform translate-x-4' : ''}`}></div>
                        </div>
                        <div className="ml-3 text-slate-400 text-xs font-medium">
                            {showDecimals ? 'Con Decimales' : 'Sin Decimales'}
                        </div>
                    </label>
                </div>
                <div className="flex items-center gap-3 text-slate-400 text-sm">
                    <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold">U</div>
                    <div>
                        <p className="text-white font-medium">Usuario</p>
                        <p className="text-xs">Admin</p>
                    </div>
                </div>
            </div>
        </aside >
    );
};
