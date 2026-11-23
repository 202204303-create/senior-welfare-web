import { AlertTriangle, CheckCircle2, Info, RotateCw, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { BigButton } from '@/shared/ui/BigButton'

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-2xl bg-brand-100/70 ${className}`} aria-hidden />
}

export function LoadingList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" role="status" aria-label="불러오는 중">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="glass space-y-3 rounded-3xl p-5">
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      ))}
      <span className="sr-only">정보를 불러오고 있어요</span>
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="glass flex flex-col items-center gap-4 rounded-3xl p-8 text-center">
      <div className="grid size-16 place-items-center rounded-full bg-amber-100 text-amber-600">
        <AlertTriangle className="size-8" aria-hidden />
      </div>
      <div>
        <p className="text-lg font-bold">정보를 불러오지 못했어요</p>
        <p className="mt-1 text-base text-ink-soft">{message ?? '잠시 후 다시 시도해 주세요.'}</p>
      </div>
      {onRetry && (
        <BigButton variant="soft" icon={<RotateCw />} onClick={onRetry}>
          다시 시도
        </BigButton>
      )}
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  desc,
  action,
}: {
  icon: ReactNode
  title: string
  desc?: string
  action?: ReactNode
}) {
  return (
    <div className="glass flex flex-col items-center gap-3 rounded-3xl p-8 text-center">
      <div
        className="grid size-16 place-items-center rounded-full bg-brand-100 text-brand-500 [&>svg]:size-8"
        aria-hidden
      >
        {icon}
      </div>
      <p className="text-lg font-bold">{title}</p>
      {desc && <p className="text-base text-ink-soft">{desc}</p>}
      {action}
    </div>
  )
}

const NOTE_TONE = {
  info: { cls: 'bg-brand-50 text-brand-800 ring-brand-200', Icon: Info },
  success: { cls: 'bg-emerald-50 text-emerald-800 ring-emerald-200', Icon: CheckCircle2 },
  warn: { cls: 'bg-amber-50 text-amber-900 ring-amber-200', Icon: AlertTriangle },
}

/**
 * 동작 결과를 그 자리에 남겨 두는 확인 문구입니다.
 * 몇 초 뒤 사라지는 토스트는 어르신이 놓치기 쉬워 쓰지 않습니다. (교수님 피드백)
 * 다음 동작을 하거나 사용자가 닫기 전까지 계속 보입니다.
 */
export function StatusNote({
  tone = 'success',
  children,
  onClose,
  className = '',
}: {
  tone?: keyof typeof NOTE_TONE
  children: ReactNode
  onClose?: () => void
  className?: string
}) {
  const { cls, Icon } = NOTE_TONE[tone]
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-start gap-2.5 rounded-2xl px-4 py-3 text-base font-semibold ring-1 ${cls} ${className}`}
    >
      <Icon className="mt-0.5 size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">{children}</span>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="확인 문구 닫기"
          className="-my-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-lg hover:bg-black/5"
        >
          <X className="size-5" aria-hidden />
        </button>
      )}
    </div>
  )
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        className="absolute inset-0 bg-brand-900/25 backdrop-blur-sm"
        onClick={onClose}
        aria-label="닫기"
      />
      <div className="relative max-h-[90dvh] w-full max-w-lg animate-fade-up overflow-y-auto rounded-t-3xl bg-white/95 p-6 shadow-glass-lg backdrop-blur-xl sm:rounded-3xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-extrabold">{title}</h2>
          <button
            onClick={onClose}
            className="grid size-11 place-items-center rounded-xl hover:bg-brand-50"
            aria-label="닫기"
          >
            <X className="size-6" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
