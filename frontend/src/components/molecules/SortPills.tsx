import { DataTableSortIcon } from '../atoms/DataTableSortIcon'

type SortDir = 'asc' | 'desc'

export interface SortPill {
    key: string
    label: string
}

interface SortPillsProps {
    pills: SortPill[]
    sortKey: string
    sortDir: SortDir
    onSort: (key: string) => void
}

export const SortPills = ({ pills, sortKey, sortDir, onSort }: SortPillsProps) => (
    <div className="flex items-center gap-1">
        {pills.map(pill => {
            const isActive = sortKey === pill.key
            return (
                <button
                    key={pill.key}
                    onClick={() => onSort(pill.key)}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wide transition-all border ${
                        isActive
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50 hover:text-slate-600'
                    }`}
                >
                    {pill.label}
                    <DataTableSortIcon active={isActive} direction={isActive ? sortDir : null} size={10} />
                </button>
            )
        })}
    </div>
)
