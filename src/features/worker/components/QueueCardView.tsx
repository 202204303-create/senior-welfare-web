import { Phone, Pill, Sun } from 'lucide-react'
import { GRADE_BADGE } from '@/features/worker/components/QueueSummaryBar'
import { GRADE_LABEL, RESULT_LABEL, waitLabel } from '@/features/worker/lib/queue'
import type { QueueCard } from '@/features/worker/lib/queue'
import { BigButton } from '@/shared/ui'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** 오늘 큐의 어르신 한 명(이슈를 묶은 카드). "왜 여기 있나?"를 이슈 칩으로 보여 줍니다. */
export function QueueCardView({
  card,
  now,
  onHandle,
}: {
  card: QueueCard
  now: Date
  onHandle: (card: QueueCard) => void
}) {
  const { summary, issues } = card
  return (
    <li className="glass space-y-3 rounded-3xl p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-extrabold ring-2 ${GRADE_BADGE[card.grade]}`}>
          {card.grade} {GRADE_LABEL[card.grade]}
        </span>
        <span className="text-sm font-bold text-ink-soft">{waitLabel(card.since, now)} 기다림</span>
      </div>
      <h3 className="text-2xl font-black">{card.row.displayName} 님</h3>

      <ul className="flex flex-wrap gap-2" aria-label="확인이 필요한 이유">
        {issues.map((i, idx) => (
          <li
            key={`${i.type}-${i.alertId ?? idx}`}
            className={`rounded-2xl px-3 py-2 text-sm font-bold ring-1 ${GRADE_BADGE[i.grade]}`}
          >
            {i.text}
            {i.lastAction && (
              <span className="mt-0.5 block font-semibold opacity-80">
                {fmtTime(i.lastAction.at)} · {RESULT_LABEL[i.lastAction.result]}
                {i.lastAction.followUpAt ? ` · ${fmtTime(i.lastAction.followUpAt)} 재시도` : ''}
              </span>
            )}
          </li>
        ))}
      </ul>

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-brand-100">
          <dt className="flex items-center gap-1 font-bold text-ink-soft">
            <Sun className="size-4" aria-hidden /> 오늘 기상
          </dt>
          <dd className="mt-0.5 text-base font-extrabold">
            {summary.todayWakeAt ? `${fmtTime(summary.todayWakeAt)} 확인` : '확인 전'}
          </dd>
        </div>
        <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-brand-100">
          <dt className="flex items-center gap-1 font-bold text-ink-soft">
            <Pill className="size-4" aria-hidden /> 오늘 복약
          </dt>
          <dd className="mt-0.5 text-base font-extrabold">
            {summary.todayMedTotal === 0 ? '없음' : `${summary.todayMedDone}/${summary.todayMedTotal}개`}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap gap-2">
        {summary.elderPhone && (
          <a
            href={`tel:${summary.elderPhone}`}
            aria-label={`${card.row.displayName} 님께 전화하기 ${summary.elderPhone}`}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/80 bg-brand-100/80 px-5 text-base font-bold text-brand-800"
          >
            <Phone className="size-5" aria-hidden /> 어르신 전화
          </a>
        )}
        <BigButton size="md" onClick={() => onHandle(card)}>
          처리하기
        </BigButton>
      </div>
    </li>
  )
}
