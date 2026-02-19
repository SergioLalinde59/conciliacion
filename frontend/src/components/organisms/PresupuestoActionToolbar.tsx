import { useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Play, Lock, Calculator, Undo2, RefreshCcw, SlidersHorizontal, BarChart3 } from 'lucide-react'
import type { Presupuesto } from '../../types/Presupuesto'

interface PresupuestoActionToolbarProps {
    presupuestos: Presupuesto[]
    selectedPresupuesto: Presupuesto | null
    presupuestoId: number
    onSelectPresupuesto: (id: number) => void
    onCrear: () => void
    onEditar: (p: Presupuesto) => void
    onGenerar: (p: Presupuesto) => void
    onActivar: (p: Presupuesto) => void
    onEliminar: (p: Presupuesto) => void
    onRevertir: (p: Presupuesto) => void
    onCerrar: (p: Presupuesto) => void
    onAjuste: () => void
    onNuevaLinea: () => void
}

const ActionBtn = ({ onClick, icon: Icon, title, color }: {
    onClick: () => void; icon: typeof Plus; title: string
    color: string
}) => (
    <button
        onClick={onClick}
        className={`p-1.5 rounded-lg transition-all duration-200 ${color}`}
        title={title}
    >
        <Icon size={15} />
    </button>
)

export const PresupuestoActionToolbar = ({
    presupuestos, selectedPresupuesto, presupuestoId,
    onSelectPresupuesto, onCrear, onEditar, onGenerar,
    onActivar, onEliminar, onRevertir, onCerrar,
    onAjuste, onNuevaLinea,
}: PresupuestoActionToolbarProps) => {
    const navigate = useNavigate()
    const estado = selectedPresupuesto?.estado

    const estadoConfig: Record<string, { bg: string; text: string }> = {
        borrador: { bg: 'bg-slate-500/30', text: 'text-slate-300' },
        activo: { bg: 'bg-emerald-500/30', text: 'text-emerald-300' },
        cerrado: { bg: 'bg-rose-500/30', text: 'text-rose-300' },
    }

    const badge = estadoConfig[estado || 'borrador'] || estadoConfig.borrador

    return (
        <div className="flex items-center gap-3 flex-wrap">
            {/* Selector */}
            <select
                value={presupuestoId}
                onChange={e => onSelectPresupuesto(parseInt(e.target.value))}
                className="px-3 py-1.5 bg-white/10 border border-white/20 rounded-lg text-xs text-white focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none [&>option]:text-slate-900"
            >
                {presupuestos.map(p => (
                    <option key={p.id} value={p.id}>
                        {p.nombre} ({p.anio}) - {p.estado}
                    </option>
                ))}
            </select>

            {/* Badge estado */}
            {selectedPresupuesto && (
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badge.bg} ${badge.text}`}>
                    {estado}
                </span>
            )}

            {/* Separator */}
            <div className="w-px h-5 bg-white/20" />

            {/* Crear siempre visible */}
            <ActionBtn onClick={onCrear} icon={Plus} title="Nuevo Presupuesto" color="hover:bg-white/10 text-white/70 hover:text-white" />

            {/* Acciones por estado */}
            {selectedPresupuesto && estado === 'borrador' && (
                <>
                    <ActionBtn onClick={() => onGenerar(selectedPresupuesto)} icon={Calculator} title="Generar presupuesto" color="hover:bg-purple-500/30 text-purple-300 hover:text-purple-200" />
                    <ActionBtn onClick={() => onEditar(selectedPresupuesto)} icon={Pencil} title="Editar" color="hover:bg-amber-500/30 text-amber-300 hover:text-amber-200" />
                    <ActionBtn onClick={() => onActivar(selectedPresupuesto)} icon={Play} title="Activar" color="hover:bg-emerald-500/30 text-emerald-300 hover:text-emerald-200" />
                    <ActionBtn onClick={onAjuste} icon={SlidersHorizontal} title="Ajuste %" color="hover:bg-blue-500/30 text-blue-300 hover:text-blue-200" />
                    <ActionBtn onClick={onNuevaLinea} icon={Plus} title="Nueva Línea" color="hover:bg-cyan-500/30 text-cyan-300 hover:text-cyan-200" />
                    <ActionBtn onClick={() => onEliminar(selectedPresupuesto)} icon={Trash2} title="Eliminar" color="hover:bg-rose-500/30 text-rose-300 hover:text-rose-200" />
                </>
            )}
            {selectedPresupuesto && estado === 'activo' && (
                <>
                    <ActionBtn onClick={() => onGenerar(selectedPresupuesto)} icon={RefreshCcw} title="Regenerar presupuesto" color="hover:bg-purple-500/30 text-purple-300 hover:text-purple-200" />
                    <ActionBtn onClick={() => onRevertir(selectedPresupuesto)} icon={Undo2} title="Revertir a borrador" color="hover:bg-amber-500/30 text-amber-300 hover:text-amber-200" />
                    <ActionBtn onClick={() => onCerrar(selectedPresupuesto)} icon={Lock} title="Cerrar presupuesto" color="hover:bg-rose-500/30 text-rose-300 hover:text-rose-200" />
                </>
            )}

            {/* Separator + Ver análisis */}
            <div className="w-px h-5 bg-white/20" />
            <button
                onClick={() => navigate('/reportes/presupuesto-vs-real')}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-white transition-all text-[11px] font-semibold"
                title="Ver Análisis Ppto vs Real"
            >
                <BarChart3 size={13} />
                Ver Análisis
            </button>
        </div>
    )
}
