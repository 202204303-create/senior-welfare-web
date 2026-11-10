import type { HTMLAttributes, ReactNode } from 'react'

interface InfoCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title?: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  tone?: 'glass' | 'sky' | 'solid'
  padded?: boolean
}

const TONE = {
  glass: 'glass',
  sky: 'glass-sky',
  solid: 'bg-white border border-brand-100 shadow-glass',
}

export function InfoCard({
  title,
  subtitle,
  icon,
  action,
  tone = 'glass',
  padded = true,
  className = '',
  children,
  ...rest
}: InfoCardProps) {
  return (
    <section className={`${TONE[tone]} rounded-3xl ${padded ? 'p-5 sm:p-6' : ''} ${className}`} {...rest}>
      {(title || icon || action) && (
        <header className="mb-4 flex items-start gap-3">
          {icon && (
            <div
              className="grid size-12 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-brand-100 to-white text-brand-600 shadow-sm ring-1 ring-white [&>svg]:size-6"
              aria-hidden
            >
              {icon}
            </div>
          )}
          <div className="min-w-0 flex-1">
            {title && <h2 className="text-xl font-extrabold leading-snug text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-base text-ink-soft">{subtitle}</p>}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
