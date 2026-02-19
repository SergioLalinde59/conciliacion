import { useState, useCallback } from 'react'
import toast from 'react-hot-toast'
import { presupuestoService } from '../services/presupuesto.service'
import type { Presupuesto } from '../types/Presupuesto'

export const usePresupuestoActions = (onRefresh: () => void) => {
    // Confirm modal
    const [confirmMsg, setConfirmMsg] = useState<string | null>(null)
    const [confirmAction, setConfirmAction] = useState<(() => void) | null>(null)

    const showConfirm = useCallback((msg: string, action: () => void) => {
        setConfirmMsg(msg)
        setConfirmAction(() => action)
    }, [])

    const closeConfirm = useCallback(() => {
        setConfirmMsg(null)
        setConfirmAction(null)
    }, [])

    // Generar modal
    const [generarModalOpen, setGenerarModalOpen] = useState(false)
    const [presupuestoGenerar, setPresupuestoGenerar] = useState<Presupuesto | null>(null)
    const [generarMode, setGenerarMode] = useState<'generar' | 'regenerar'>('generar')

    // Form modal
    const [formModalOpen, setFormModalOpen] = useState(false)
    const [formEditando, setFormEditando] = useState<Presupuesto | null>(null)

    // Ajuste modal
    const [ajusteModalOpen, setAjusteModalOpen] = useState(false)

    // Nueva linea modal
    const [nuevaLineaModalOpen, setNuevaLineaModalOpen] = useState(false)

    const handleCrear = useCallback(() => {
        setFormEditando(null)
        setFormModalOpen(true)
    }, [])

    const handleEditar = useCallback((p: Presupuesto) => {
        setFormEditando(p)
        setFormModalOpen(true)
    }, [])

    const handleEliminar = useCallback((p: Presupuesto) => {
        if (p.estado !== 'borrador') {
            toast.error('Solo se pueden eliminar presupuestos en borrador')
            return
        }
        showConfirm(`¿Eliminar presupuesto "${p.nombre}"?`, async () => {
            closeConfirm()
            try {
                await presupuestoService.eliminar(p.id)
                toast.success('Presupuesto eliminado')
                onRefresh()
            } catch (err: any) {
                toast.error(err.message || 'Error al eliminar')
            }
        })
    }, [showConfirm, closeConfirm, onRefresh])

    const handleActivar = useCallback((p: Presupuesto) => {
        showConfirm(`¿Activar presupuesto "${p.nombre}"?\nSolo puede haber uno activo por año.`, async () => {
            closeConfirm()
            try {
                await presupuestoService.activar(p.id)
                toast.success('Presupuesto activado')
                onRefresh()
            } catch (err: any) {
                toast.error(err.message || 'Error al activar')
            }
        })
    }, [showConfirm, closeConfirm, onRefresh])

    const handleCerrar = useCallback((p: Presupuesto) => {
        showConfirm(`¿Cerrar presupuesto "${p.nombre}"?\nNo se podrá modificar.`, async () => {
            closeConfirm()
            try {
                await presupuestoService.cerrar(p.id)
                toast.success('Presupuesto cerrado')
                onRefresh()
            } catch (err: any) {
                toast.error(err.message || 'Error al cerrar')
            }
        })
    }, [showConfirm, closeConfirm, onRefresh])

    const handleRevertir = useCallback((p: Presupuesto) => {
        showConfirm(`¿Revertir "${p.nombre}" a borrador?\nPodrá editar y regenerar líneas.`, async () => {
            closeConfirm()
            try {
                await presupuestoService.revertir(p.id)
                toast.success('Presupuesto revertido a borrador')
                onRefresh()
            } catch (err: any) {
                toast.error(err.message || 'Error al revertir')
            }
        })
    }, [showConfirm, closeConfirm, onRefresh])

    const handleGenerar = useCallback((p: Presupuesto) => {
        setPresupuestoGenerar(p)
        setGenerarMode(p.estado === 'activo' ? 'regenerar' : 'generar')
        setGenerarModalOpen(true)
    }, [])

    const handleGenerarSuccess = useCallback(() => {
        setGenerarModalOpen(false)
        toast.success('Líneas de presupuesto generadas')
        onRefresh()
    }, [onRefresh])

    const handleFormSaved = useCallback(() => {
        setFormModalOpen(false)
        onRefresh()
    }, [onRefresh])

    return {
        // Confirm modal
        confirmMsg, confirmAction, closeConfirm,
        // Generar modal
        generarModalOpen, presupuestoGenerar, generarMode,
        setGenerarModalOpen, handleGenerar, handleGenerarSuccess,
        // Form modal
        formModalOpen, formEditando, setFormModalOpen, handleCrear, handleEditar, handleFormSaved,
        // Ajuste modal
        ajusteModalOpen, setAjusteModalOpen,
        // Nueva linea modal
        nuevaLineaModalOpen, setNuevaLineaModalOpen,
        // Actions
        handleEliminar, handleActivar, handleCerrar, handleRevertir,
    }
}
