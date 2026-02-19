import { AlertTriangle, AlertCircle, Info, CheckCircle } from 'lucide-react'

type MessageType = 'error' | 'warning' | 'info' | 'success' | 'confirm'

interface MessageModalProps {
    message: string | null
    onClose: () => void
    onConfirm?: () => void
    type?: MessageType
    title?: string
    confirmLabel?: string
    cancelLabel?: string
}

const config: Record<MessageType, { defaultTitle: string; titleColor: string; icon: typeof AlertCircle; btnClass: string }> = {
    error: { defaultTitle: 'Error', titleColor: 'text-red-600', icon: AlertCircle, btnClass: 'bg-red-600 hover:bg-red-700' },
    warning: { defaultTitle: 'Advertencia', titleColor: 'text-amber-600', icon: AlertTriangle, btnClass: 'bg-amber-600 hover:bg-amber-700' },
    info: { defaultTitle: 'Información', titleColor: 'text-blue-600', icon: Info, btnClass: 'bg-blue-600 hover:bg-blue-700' },
    success: { defaultTitle: 'Éxito', titleColor: 'text-green-600', icon: CheckCircle, btnClass: 'bg-green-600 hover:bg-green-700' },
    confirm: { defaultTitle: 'Confirmar', titleColor: 'text-blue-600', icon: Info, btnClass: 'bg-blue-600 hover:bg-blue-700' },
}

export const MessageModal = ({ message, onClose, onConfirm, type = 'error', title, confirmLabel, cancelLabel }: MessageModalProps) => {
    if (!message) return null

    const cfg = config[type]
    const Icon = cfg.icon
    const isConfirm = !!onConfirm

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
            <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
                <div className="flex items-center gap-2 mb-3">
                    <Icon size={20} className={cfg.titleColor} />
                    <h2 className={`text-lg font-bold ${cfg.titleColor}`}>{title || cfg.defaultTitle}</h2>
                </div>
                <p className="text-sm text-slate-700 mb-5 whitespace-pre-line">{message}</p>
                <div className="flex justify-end gap-2">
                    {isConfirm && (
                        <button onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
                            {cancelLabel || 'Cancelar'}
                        </button>
                    )}
                    <button onClick={isConfirm ? onConfirm : onClose}
                        className={`px-4 py-2 text-sm text-white rounded-lg transition-colors ${cfg.btnClass}`}>
                        {confirmLabel || (isConfirm ? 'Aceptar' : 'Aceptar')}
                    </button>
                </div>
            </div>
        </div>
    )
}
