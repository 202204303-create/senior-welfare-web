import { AlertTriangle, CheckCircle2, Info, RotateCw, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { useSettingsStore } from '@/shared/store/useSettingsStore'
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

const TOAST_TONE = {
  info: { cls: 'bg-brand-700', Icon: Info },
  success: { cls: 'bg-emerald-600', Icon: CheckCircle2 },
  warn: { cls: 'bg-amber-600', Icon: AlertTriangle },
}

export function Toast() {
  const toast = useSettingsStore((s) => s.toast)
  const hide = useSettingsStore((s) => s.hideToast)

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(hide, 4500)
    return () => clearTimeout(t)
  }, [toast, hide])

  if (!toast) return null
  const { cls, Icon } = TOAST_TONE[toast.tone]
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4 md:bottom-8">
      <div
        key={toast.id}
        role="status"
        aria-live="polite"
        className={`pointer-events-auto flex max-w-lg animate-fade-up items-center gap-3 rounded-2xl px-5 py-4 text-base font-semibold text-white shadow-glass-lg ${cls}`}
      >
        <Icon className="size-6 shrink-0" aria-hidden />
        <span className="flex-1">{toast.message}</span>
        <button
          onClick={hide}
          aria-label="알림 닫기"
          className="grid size-9 place-items-center rounded-lg hover:bg-white/15"
        >
          <X className="size-5" />
        </button>
      </div>
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
