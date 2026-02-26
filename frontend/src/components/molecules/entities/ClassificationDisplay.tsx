
import { EntityDisplay } from './EntityDisplay'
import { cn } from '../../../utils/cn'

interface Entity {
    id: number | string
    nombre: string
}

interface ClassificationDisplayProps {
    centroCosto?: Entity | null
    concepto?: Entity | null
    className?: string
}

export const ClassificationDisplay = ({
    centroCosto,
    concepto,
    className
}: ClassificationDisplayProps) => {

    // Case: Unclassified
    if (!centroCosto && !concepto) {
        return (
            <span className="inline-flex items-center px-1 py-0.5 rounded text-[12px] font-medium bg-amber-50 text-amber-700 border border-amber-100 italic leading-none">
                Sin clasificar
            </span>
        )
    }

    // Case: Single Classification
    return (
        <div className={cn("flex flex-col gap-0.5", className)}>
            {centroCosto && (
                <EntityDisplay
                    id={centroCosto.id}
                    nombre={centroCosto.nombre}
                    className="text-[12px]"
                    nameClassName="text-slate-700 font-bold"
                />
            )}
            {concepto && (
                <EntityDisplay
                    id={concepto.id}
                    nombre={concepto.nombre}
                    className="text-[11px] pl-1" // Slight indent for hierarchy
                    idClassName="bg-transparent border-0 text-slate-300" // Subtler ID for concept
                    nameClassName="text-slate-500 italic font-normal"
                />
            )}
        </div>
    )
}
