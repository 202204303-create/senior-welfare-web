import { AlertTriangle, BellRing, Check, CheckCircle2, Siren } from 'lucide-react'
import { useNoticeStore, type NoticeStore, type NoticeTone } from '@/shared/store/useNoticeStore'

const TONE: Record<NoticeTone, { cls: string; Icon: typeof BellRing; label: string }> = {
  info: { cls: 'bg-white ring-brand-300', Icon: BellRing, label: '알림' },
  success: { cls: 'bg-emerald-50 ring-emerald-300', Icon: CheckCircle2, label: '확인' },
  warn: { cls: 'bg-amber-50 ring-amber-300', Icon: AlertTriangle, label: '주의' },
  danger: { cls: 'bg-rose-50 ring-rose-300', Icon: Siren, label: '긴급' },
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })

/**
 * 화면 위쪽에 쌓이는 '지워지지 않는 알림'.
 * 사용자가 '확인했어요'를 눌러야만 사라집니다. (토스트를 쓰지 않음 — 교수님 피드백)
 */
export function NoticeStack({ useStore = useNoticeStore }: { useStore?: NoticeStore }) {
  const { notices, dismissNotice, dismissAll } = useStore()
  if (notices.length === 0) return null

  return (
    <section aria-label="확인하지 않은 알림" className="mb-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-lg font-black text-ink">
          <BellRing className="size-5 text-brand-600" aria-hidden />
          확인하지 않은 알림 {notices.length}개
        </p>
        {notices.length > 1 && (
          <button
            type="button"
            onClick={dismissAll}
            className="min-h-11 rounded-xl px-3 text-base font-bold text-brand-700 hover:bg-brand-50"
          >
            모두 확인
          </button>
        )}
      </div>
      <ul className="space-y-3" role="log" aria-live="polite">
        {notices.map((n) => {
          const { cls, Icon, label } = TONE[n.tone]
          return (
            <li key={n.id} className={`rounded-2xl p-4 shadow-glass ring-2 ${cls}`}>
              <div className="flex items-start gap-3">
                <Icon className="mt-0.5 size-6 shrink-0" aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-ink-soft">
                    {label} · {fmt(n.at)}
                  </p>
                  <p className="text-lg font-bold leading-snug">{n.message}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => dismissNotice(n.id)}
                className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-white text-base font-bold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-50"
              >
                <Check className="size-5" aria-hidden /> 확인했어요
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
