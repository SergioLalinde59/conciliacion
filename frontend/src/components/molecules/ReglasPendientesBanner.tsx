import { useState, useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { presupuestoService } from '../../services/presupuesto.service'

interface ReglasPendientesBannerProps {
    presupuestoId: number
    onRegenerated?: () => void
}

export const ReglasPendientesBanner = ({ presupuestoId, onRegenerated }: ReglasPendientesBannerProps) => {
    const [pendientes, setPendientes] = useState(0)
    const [detalle, setDetalle] = useState<{ centro_costo_nombre: string; concepto_nombre: string; tipo_gasto: string }[]>([])
    const [regenerando, setRegenerando] = useState(false)
    const [showDetalle, setShowDetalle] = useState(false)

    useEffect(() => {
        presupuestoService.reglasPendientes(presupuestoId)
            .then(data => {
                setPendientes(data.pendientes)
                setDetalle(data.detalle)
            })
            .catch(() => setPendientes(0))
    }, [presupuestoId])

    if (pendientes === 0) return null

    const handleRegenerar = async () => {
        setRegenerando(true)
        try {
            await presupuestoService.regenerar(presupuestoId)
            setPendientes(0)
            setDetalle([])
            onRegenerated?.()
        } catch (e) {
            console.error('Error regenerando presupuesto:', e)
        } finally {
            setRegenerando(false)
        }
    }

    return (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 mb-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                    <span className="text-sm text-amber-700">
                        {pendientes} regla{pendientes > 1 ? 's' : ''} sin aplicar al presupuesto
                    </span>
                    <button
                        onClick={() => setShowDetalle(!showDetalle)}
                        className="text-xs text-amber-500 hover:text-amber-700 underline"
                    >
                        {showDetalle ? 'ocultar' : 'ver detalle'}
                    </button>
                </div>
                <button
                    onClick={handleRegenerar}
                    disabled={regenerando}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-md transition-colors disabled:opacity-50"
                >
                    <RefreshCw size={12} className={regenerando ? 'animate-spin' : ''} />
                    {regenerando ? 'Regenerando...' : 'Regenerar'}
                </button>
            </div>
            {showDetalle && detalle.length > 0 && (
                <div className="mt-2 pt-2 border-t border-amber-200">
                    <ul className="text-xs text-amber-600 space-y-0.5">
                        {detalle.map((d, i) => (
                            <li key={i}>
                                {d.centro_costo_nombre} + {d.concepto_nombre}
                                <span className="text-amber-400 ml-1">({d.tipo_gasto})</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    )
}
