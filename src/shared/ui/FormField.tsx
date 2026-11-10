import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react'

const fieldCls =
  'w-full min-h-14 rounded-2xl bg-white/85 px-4 text-lg text-ink ring-2 ring-brand-100 outline-none transition placeholder:text-ink-soft/60 focus:ring-brand-400 focus-visible:outline-none'

interface BaseProps {
  label: string
  hint?: ReactNode
  autoFilled?: boolean
}

export function TextField({
  label,
  hint,
  autoFilled,
  className = '',
  ...rest
}: BaseProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
        {label}
        {autoFilled && <AutoBadge />}
      </label>
      <input id={id} className={`${fieldCls} ${autoFilled ? 'bg-brand-50/90' : ''}`} {...rest} />
      {hint && <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}

export function SelectField({
  label,
  hint,
  autoFilled,
  options,
  className = '',
  ...rest
}: BaseProps & SelectHTMLAttributes<HTMLSelectElement> & { options: readonly string[] }) {
  const id = useId()
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-2 flex items-center gap-2 text-base font-bold text-ink">
        {label}
        {autoFilled && <AutoBadge />}
      </label>
      <select
        id={id}
        className={`${fieldCls} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 fill=%22none%22 stroke=%22%230b7fd2%22 stroke-width=%222.5%22 viewBox=%220 0 24 24%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:24px] bg-[right_1rem_center] bg-no-repeat pr-12`}
        {...rest}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {hint && <p className="mt-1.5 text-sm text-ink-soft">{hint}</p>}
    </div>
  )
}

function AutoBadge() {
  return (
    <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-bold text-brand-700">
      자동 입력됨
    </span>
  )
}
