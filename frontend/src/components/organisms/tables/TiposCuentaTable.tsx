import { Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '../../atoms/Button'
import type { TipoCuenta } from '../../../types'

interface Props {
    tiposCuenta: TipoCuenta[]
    loading: boolean
    onEdit: (tipoCuenta: TipoCuenta) => void
    onDelete: (id: number) => void
}

const PermisoBadge = ({ activo, label }: { activo: boolean; label: string }) => (
    <span
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium ${
            activo
                ? 'bg-green-100 text-green-700'
                : 'bg-gray-100 text-gray-400'
        }`}
        title={`${label}: ${activo ? 'Si' : 'No'}`}
    >
        {activo ? <Check size={10} /> : <X size={10} />}
        {label}
    </span>
)

export const TiposCuentaTable = ({ tiposCuenta, loading, onEdit, onDelete }: Props) => {
    if (loading) {
        return <div className="p-8 text-center text-gray-500">Cargando tipos de cuenta...</div>
    }

    if (tiposCuenta.length === 0) {
        return <div className="p-8 text-center text-gray-500">No hay tipos de cuenta registrados.</div>
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">ID</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Nombre</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center">Pesos</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider">Permisos</th>
                        <th className="py-3 px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right w-24">Acciones</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {tiposCuenta.map((tipo) => (
                        <tr key={tipo.id} className="hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-sm text-gray-600 font-mono">#{tipo.id}</td>
                            <td className="py-3 px-4">
                                <div className="text-sm font-medium text-gray-900">{tipo.nombre}</div>
                                {tipo.descripcion && (
                                    <div className="text-xs text-gray-500 mt-0.5 max-w-xs truncate">{tipo.descripcion}</div>
                                )}
                            </td>
                            <td className="py-3 px-4">
                                <div className="flex items-center gap-1 justify-center">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800" title="Peso Referencia">
                                        R:{tipo.peso_referencia}
                                    </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800" title="Peso Descripcion">
                                        D:{tipo.peso_descripcion}
                                    </span>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800" title="Peso Valor">
                                        V:{tipo.peso_valor}
                                    </span>
                                </div>
                                <div className="text-xs text-gray-400 text-center mt-1">
                                    Min ref: {tipo.longitud_min_referencia}
                                </div>
                            </td>
                            <td className="py-3 px-4">
                                <div className="flex flex-wrap gap-1">
                                    <PermisoBadge activo={tipo.permite_crear_manual} label="Crear" />
                                    <PermisoBadge activo={tipo.permite_editar} label="Editar" />
                                    <PermisoBadge activo={tipo.permite_modificar} label="Modif" />
                                    <PermisoBadge activo={tipo.permite_borrar} label="Borrar" />
                                    <PermisoBadge activo={tipo.permite_clasificar} label="Clasif" />
                                </div>
                                {tipo.responde_enter && (
                                    <div className="text-xs text-orange-600 mt-1">Enter = Guardar</div>
                                )}
                            </td>
                            <td className="py-3 px-4 text-right">
                                <Button
                                    variant="ghost-warning"
                                    size="sm"
                                    onClick={() => onEdit(tipo)}
                                    className="!p-1.5"
                                    title="Editar"
                                >
                                    <Pencil size={15} />
                                </Button>
                                <Button
                                    variant="ghost-danger"
                                    size="sm"
                                    onClick={() => {
                                        if (confirm('Desactivar este tipo de cuenta?')) {
                                            onDelete(tipo.id)
                                        }
                                    }}
                                    className="!p-1.5"
                                    title="Desactivar"
                                >
                                    <Trash2 size={15} />
                                </Button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
