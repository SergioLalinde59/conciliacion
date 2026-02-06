import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { Plus } from 'lucide-react'
import type { TipoCuenta } from '../types'
import { TiposCuentaTable } from '../components/organisms/tables/TiposCuentaTable'
import { TipoCuentaModal } from '../components/organisms/modals/TipoCuentaModal'
import { CsvExportButton } from '../components/molecules/CsvExportButton'
import { API_BASE_URL } from '../config'

export const TiposCuentaPage = () => {
    const [tiposCuenta, setTiposCuenta] = useState<TipoCuenta[]>([])
    const [loading, setLoading] = useState(true)
    const [modalOpen, setModalOpen] = useState(false)
    const [itemEditando, setItemEditando] = useState<TipoCuenta | null>(null)

    const cargarTiposCuenta = () => {
        setLoading(true)
        fetch(`${API_BASE_URL}/api/tipos-cuenta`)
            .then(res => res.json())
            .then(data => {
                setTiposCuenta(data)
                setLoading(false)
            })
            .catch(err => {
                console.error("Error cargando tipos de cuenta:", err)
                toast.error("Error al cargar tipos de cuenta")
                setLoading(false)
            })
    }

    useEffect(() => {
        cargarTiposCuenta()
    }, [])

    const handleCreate = () => {
        setItemEditando(null)
        setModalOpen(true)
    }

    const handleEdit = (tipoCuenta: TipoCuenta) => {
        setItemEditando(tipoCuenta)
        setModalOpen(true)
    }

    const handleDelete = (id: number) => {
        fetch(`${API_BASE_URL}/api/tipos-cuenta/${id}`, { method: 'DELETE' })
            .then(async res => {
                if (res.ok) {
                    toast.success('Tipo de cuenta desactivado')
                    cargarTiposCuenta()
                } else {
                    const error = await res.json()
                    toast.error("Error al desactivar: " + (error.detail || "Error desconocido"))
                }
            })
            .catch(err => {
                console.error(err)
                toast.error("Error de conexion al desactivar")
            })
    }

    const handleSave = (data: Omit<TipoCuenta, 'id' | 'activo'>) => {
        const payload = {
            ...data,
            activo: true
        }

        if (itemEditando) {
            fetch(`${API_BASE_URL}/api/tipos-cuenta/${itemEditando.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(async res => {
                if (res.ok) {
                    toast.success('Tipo de cuenta actualizado')
                    setModalOpen(false)
                    cargarTiposCuenta()
                } else {
                    const error = await res.json()
                    toast.error("Error al actualizar: " + (error.detail || "Error desconocido"))
                }
            })
        } else {
            fetch(`${API_BASE_URL}/api/tipos-cuenta`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            }).then(async res => {
                if (res.ok) {
                    toast.success('Tipo de cuenta creado')
                    setModalOpen(false)
                    cargarTiposCuenta()
                } else {
                    const error = await res.json()
                    toast.error("Error al crear: " + (error.detail || "Error desconocido"))
                }
            })
        }
    }

    const csvColumns = [
        { key: 'id' as const, label: 'ID' },
        { key: 'nombre' as const, label: 'Nombre' },
        { key: 'peso_referencia' as const, label: 'Peso Ref' },
        { key: 'peso_descripcion' as const, label: 'Peso Desc' },
        { key: 'peso_valor' as const, label: 'Peso Valor' },
        { key: 'longitud_min_referencia' as const, label: 'Long Min Ref' },
    ]

    return (
        <div className="max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Tipos de Cuenta</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Configura los pesos de clasificacion para cada tipo de cuenta bancaria
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <CsvExportButton data={tiposCuenta} columns={csvColumns} filenamePrefix="tipos_cuenta" />
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
                    >
                        <Plus size={18} />
                        Nuevo Tipo
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <TiposCuentaTable
                    tiposCuenta={tiposCuenta}
                    loading={loading}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                />
            </div>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-semibold text-blue-900 mb-2">Como funcionan los pesos</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                    <li><strong>Peso Referencia:</strong> Importancia del numero de referencia al buscar movimientos similares</li>
                    <li><strong>Peso Descripcion:</strong> Importancia del texto de descripcion</li>
                    <li><strong>Peso Valor:</strong> Importancia del monto del movimiento</li>
                    <li><strong>Longitud Min Referencia:</strong> Solo se usa la referencia si tiene al menos esta cantidad de caracteres</li>
                </ul>
            </div>

            <TipoCuentaModal
                isOpen={modalOpen}
                tipoCuenta={itemEditando}
                onClose={() => setModalOpen(false)}
                onSave={handleSave}
            />
        </div>
    )
}
