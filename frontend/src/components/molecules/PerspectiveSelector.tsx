import type { Perspectiva } from '../../types'

interface PerspectiveSelectorProps {
    perspectivas: Perspectiva[]
    selectedSlug: string
    onChange: (slug: string) => void
}

export default function PerspectiveSelector({
    perspectivas,
    selectedSlug,
    onChange,
}: PerspectiveSelectorProps) {
    if (!perspectivas.length) return null

    return (
        <div className="flex gap-1 bg-slate-100 p-1 rounded-lg w-fit">
            {perspectivas.map(p => (
                <button
                    key={p.slug}
                    onClick={() => onChange(p.slug)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                        selectedSlug === p.slug
                            ? 'bg-white text-slate-800 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                    }`}
                >
                    {p.nombre}
                </button>
            ))}
        </div>
    )
}
