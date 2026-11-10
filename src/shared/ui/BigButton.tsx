import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'

type Variant = 'primary' | 'soft' | 'outline' | 'danger' | 'ghost'
type Size = 'md' | 'lg' | 'xl'

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: ReactNode
  fullWidth?: boolean
  loading?: boolean
}

const VARIANT: Record<Variant, string> = {
  primary:
    'bg-linear-to-br from-brand-400 to-brand-600 text-white shadow-glass hover:from-brand-500 hover:to-brand-700 active:scale-[0.98]',
  soft: 'bg-brand-100/80 text-brand-800 hover:bg-brand-200/80 border border-white/80 active:scale-[0.98]',
  outline: 'bg-white/70 text-brand-700 border-2 border-brand-300 hover:bg-brand-50 active:scale-[0.98]',
  danger:
    'bg-linear-to-br from-rose-400 to-rose-600 text-white shadow-[0_8px_30px_-12px_rgba(225,29,72,0.5)] hover:from-rose-500 hover:to-rose-700 active:scale-[0.98]',
  ghost: 'bg-transparent text-brand-700 hover:bg-brand-50',
}

// 최소 터치 영역 56px 이상 (WCAG 2.5.5 권장 44px 초과)
const SIZE: Record<Size, string> = {
  md: 'min-h-12 px-5 text-base rounded-2xl gap-2',
  lg: 'min-h-14 px-6 text-lg rounded-2xl gap-2.5',
  xl: 'min-h-20 px-7 text-xl rounded-3xl gap-3',
}

const base = 'inline-flex items-center justify-center font-bold transition-all duration-150'

/** 페이지 이동용 버튼 모양 링크 (<a> 안에 <button>을 중첩하지 않기 위함) */
export function BigLink({
  variant = 'primary',
  size = 'lg',
  fullWidth,
  icon,
  className = '',
  children,
  ...rest
}: LinkProps & { variant?: Variant; size?: Size; fullWidth?: boolean; icon?: ReactNode }) {
  return (
    <Link
      className={`${base} ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {icon && (
        <span aria-hidden className="shrink-0 [&>svg]:size-[1.3em]">
          {icon}
        </span>
      )}
      <span>{children}</span>
    </Link>
  )
}

export function BigButton({
  variant = 'primary',
  size = 'lg',
  icon,
  fullWidth,
  loading,
  className = '',
  children,
  disabled,
  ...rest
}: BigButtonProps) {
  return (
    <button
      type="button"
      className={`${base} disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 ${VARIANT[variant]} ${SIZE[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <span
          className="size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent"
          aria-hidden
        />
      ) : (
        icon && (
          <span aria-hidden className="shrink-0 [&>svg]:size-[1.3em]">
            {icon}
          </span>
        )
      )}
      <span>{children}</span>
    </button>
  )
}
