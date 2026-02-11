import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Calculator, Pencil } from 'lucide-react'
import type { Presupuesto } from '../types/Presupuesto'
import { presupuestoService } from '../services/presupuesto.service'
import { Button } from '../components/atoms/Button'
import { PresupuestoSemaforoModal } from '../components/organisms/modals/PresupuestoSemaforoModal'

export const PresupuestoConfigPage = () => {
    const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [itemEditando, setItemEditando] = useState<Presupuesto | null>(null)

    const cargarDatos = async () => {
        setLoading(true)
        try {
            const data = await presupuestoService.listar()
            setPresupuestos(data)
        } catch (err: any) {
            toast.error('Error al cargar presupuestos')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => { cargarDatos() }, [])

    const handleEdit = (item: Presupuesto) => {
        setItemEditando(item)
        setModalOpen(true)
    }

    const handleSave = async (data: { semaforo_verde_hasta: number; semaforo_amarillo_hasta: number; umbral_minimo_mensual: number; umbral_minimo_anual: number }) => {
        if (!itemEditando) return
        try {
            await presupuestoService.actualizar(itemEditando.id, data)
            toast.success('Semáforos actualizados')
            setModalOpen(false)
            cargarDatos()
        } catch (err: any) {
            toast.error(err.message || 'Error al actualizar')
        }
    }

    const estadoBadge = (estado: string) => {
        const map: Record<string, string> = {
            borrador: 'bg-gray-100 text-gray-600',
            activo: 'bg-emerald-100 text-emerald-700',
            cerrado: 'bg-slate-200 text-slate-600',
        }
        return (
            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${map[estado] ?? map.borrador}`}>
                {estado.charAt(0).toUpperCase() + estado.slice(1)}
            </span>
        )
    }

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                    <Calculator className="text-blue-600" size={24} />
                    <h1 className="text-2xl font-bold text-gray-900">Config. Semáforos Presupuesto</h1>
                </div>
                <p className="text-sm text-gray-500 ml-9">
                    Configura los umbrales de variación porcentual (verde/amarillo/rojo) para cada presupuesto.
                </p>
            </div>

            {/* Tabla */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Año</th>
                            <th className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Nombre</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Estado</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Verde hasta</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Amarillo hasta</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Rojo desde</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Umbral Mensual</th>
                            <th className="text-center text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Umbral Anual</th>
                            <th className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider px-4 py-3">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {loading ? (
                            <tr><td colSpan={9} className="text-center py-8 text-gray-400">Cargando...</td></tr>
                        ) : presupuestos.length === 0 ? (
                            <tr><td colSpan={9} className="text-center py-8 text-gray-400">No hay presupuestos registrados</td></tr>
                        ) : presupuestos.map(p => (
                            <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 text-sm font-mono font-medium text-gray-700">{p.anio}</td>
                                <td className="px-4 py-3 text-sm text-gray-700">{p.nombre}</td>
                                <td className="px-4 py-3 text-center">{estadoBadge(p.estado)}</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-emerald-600 font-medium">≤ {p.semaforo_verde_hasta}%</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-amber-600 font-medium">≤ {p.semaforo_amarillo_hasta}%</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-rose-600 font-medium">&gt; {p.semaforo_amarillo_hasta}%</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-gray-600 font-medium font-mono text-sm">
                                        {p.umbral_minimo_mensual > 0 ? `$${p.umbral_minimo_mensual.toLocaleString()}` : '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-gray-600 font-medium font-mono text-sm">
                                        {p.umbral_minimo_anual > 0 ? `$${p.umbral_minimo_anual.toLocaleString()}` : '-'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                    <Button
                                        variant="ghost-warning"
                                        size="sm"
                                        icon={Pencil}
                                        onClick={() => handleEdit(p)}
                                    >
                                        Editar
                                    </Button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <PresupuestoSemaforoModal
                isOpen={modalOpen}
                onClose={() => setModalOpen(false)}
                item={itemEditando}
                onSave={handleSave}
            />
        </div>
    )
}
