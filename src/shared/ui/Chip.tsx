import type { ReactNode } from 'react'

interface ChipProps {
  selected?: boolean
  onClick?: () => void
  children: ReactNode
  icon?: ReactNode
}

export function Chip({ selected, onClick, children, icon }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 rounded-full px-5 text-base font-bold transition-all active:scale-95 ${
        selected
          ? 'bg-brand-600 text-white shadow-glass ring-2 ring-brand-200'
          : 'bg-white/75 text-ink-soft ring-1 ring-brand-100 hover:bg-brand-50 hover:text-brand-700'
      }`}
    >
      {icon && (
        <span aria-hidden className="[&>svg]:size-5">
          {icon}
        </span>
      )}
      {children}
    </button>
  )
}

interface ChipGroupProps<T extends string> {
  label: string
  options: readonly T[]
  value: T
  onChange: (v: T) => void
}

export function ChipGroup<T extends string>({ label, options, value, onChange }: ChipGroupProps<T>) {
  return (
    <div role="group" aria-label={label}>
      <p className="mb-2 text-sm font-bold text-ink-soft">{label}</p>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
        {options.map((o) => (
          <Chip key={o} selected={o === value} onClick={() => onChange(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </div>
  )
}
