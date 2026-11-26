import { AlertTriangle, Check, CheckCheck, Clock, Siren } from 'lucide-react'
import type { ReactNode } from 'react'
import { alertTime, type AlertLevel } from '@/features/care/lib/alertDisplay'

/**
 * 어르신·보호자 화면이 함께 쓰는 알림 한 줄.
 * 단계(긴급/확인 필요)마다 색·아이콘·글자를 하나로 맞춰, 어느 화면에서 봐도 같은 모양으로 보입니다.
 * - 긴급: 빨강 + 사이렌 (SOS 만)
 * - 확인 필요: 주황 + 세모 느낌표 (기상·복약 미확인 등)
 */
const LEVEL = {
  urgent: {
    label: '긴급',
    Icon: Siren,
    box: 'bg-rose-50 ring-rose-200',
    icon: 'bg-rose-600 text-white',
    chip: 'bg-rose-600 text-white',
  },
  warn: {
    label: '확인 필요',
    Icon: AlertTriangle,
    box: 'bg-amber-50 ring-amber-200',
    icon: 'bg-amber-500 text-white',
    chip: 'bg-amber-100 text-amber-900',
  },
} as const

export type AlertStatus =
  | { kind: 'pending'; text?: string }
  | { kind: 'acked'; text: string }
  | { kind: 'resolved'; text: string }
  | { kind: 'none' }

export function AlertRow({
  level,
  text,
  at,
  status = { kind: 'none' },
  action,
  done = false,
}: {
  level: AlertLevel
  text: string
  /** 언제 생긴 일인지 (ISO). 없으면 시각을 쓰지 않음 */
  at?: string
  status?: AlertStatus
  /** 오른쪽/아래 버튼 (확인했어요, 지우기 등) */
  action?: ReactNode
  /** 확인·해결된 지난 알림이면 흐리게 */
  done?: boolean
}) {
  const s = LEVEL[level]
  return (
    <li className={`rounded-2xl p-4 ring-1 ${done ? 'bg-white/70 ring-brand-100' : s.box}`}>
      <div className="flex items-start gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full ${done ? 'bg-slate-200 text-slate-500' : s.icon}`}
          aria-hidden
        >
          <s.Icon className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-bold whitespace-nowrap ${done ? 'bg-slate-100 text-slate-600' : s.chip}`}
            >
              {s.label}
            </span>
            {at && <span className="text-sm text-ink-soft">{alertTime(at)}</span>}
          </p>
          <p className={`mt-1 text-base leading-snug font-semibold ${done ? 'text-ink-soft' : 'text-ink'}`}>
            {text}
          </p>
          {status.kind === 'pending' && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-ink-soft">
              <Clock className="size-4 shrink-0" aria-hidden /> {status.text ?? '아직 확인 전'}
            </p>
          )}
          {status.kind === 'acked' && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
              <CheckCheck className="size-4 shrink-0" aria-hidden /> {status.text}
            </p>
          )}
          {status.kind === 'resolved' && (
            <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
              <Check className="size-4 shrink-0" strokeWidth={3} aria-hidden /> {status.text}
            </p>
          )}
        </div>
      </div>
      {action && <div className="mt-3">{action}</div>}
    </li>
  )
}
