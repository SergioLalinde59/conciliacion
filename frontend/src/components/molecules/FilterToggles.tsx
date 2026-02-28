
import { Checkbox } from '../atoms/Checkbox'

interface FilterTogglesProps {
    mostrarIngresos?: boolean
    onMostrarIngresosChange?: (checked: boolean) => void
    mostrarEgresos?: boolean
    onMostrarEgresosChange?: (checked: boolean) => void
    showIngresosEgresos?: boolean
}

export const FilterToggles = ({
    mostrarIngresos = true,
    onMostrarIngresosChange,
    mostrarEgresos = true,
    onMostrarEgresosChange,
    showIngresosEgresos = false,
}: FilterTogglesProps) => {
    return (
        <div className="flex flex-wrap items-center gap-6">
            {/* Income/Expense Filters */}
            {showIngresosEgresos && onMostrarIngresosChange && onMostrarEgresosChange && (
                <>
                    <Checkbox
                        label="Ver Ingresos"
                        checked={!!mostrarIngresos}
                        onChange={(e) => onMostrarIngresosChange(e.target.checked)}
                        className="text-emerald-600"
                    />
                    <Checkbox
                        label="Ver Egresos"
                        checked={!!mostrarEgresos}
                        onChange={(e) => onMostrarEgresosChange(e.target.checked)}
                        className="text-rose-600"
                    />
                </>
            )}
        </div>
    )
}
