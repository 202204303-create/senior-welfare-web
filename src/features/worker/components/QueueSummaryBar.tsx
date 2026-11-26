import { GRADE_LABEL, GRADES } from '@/features/worker/lib/queue'
import type { QueueView } from '@/features/worker/lib/queue'
import type { Grade } from '@/features/worker/types'

const GRADE_CHIP: Record<Grade, string> = {
  P1: 'bg-rose-100 text-rose-800 ring-rose-300',
  P2: 'bg-orange-100 text-orange-800 ring-orange-300',
  P3: 'bg-amber-100 text-amber-800 ring-amber-300',
  P4: 'bg-yellow-100 text-yellow-800 ring-yellow-300',
  P5: 'bg-sky-100 text-sky-800 ring-sky-300',
}
export const GRADE_BADGE = GRADE_CHIP

/** 오늘 관리 대상 요약: 등급별 개수(누르면 그 등급만 보기)와 처리 진행률 */
export function QueueSummaryBar({
  view,
  filter,
  onFilter,
}: {
  view: QueueView
  filter: Grade | null
  onFilter: (g: Grade | null) => void
}) {
  const pct = view.managed ? Math.round((view.done / view.managed) * 100) : 0
  return (
    <section aria-label="오늘 관리 요약" className="glass space-y-3 rounded-3xl p-4">
      <p className="text-lg font-extrabold">
        오늘 관리 {view.managed}명 · 처리 완료 {view.done}/{view.managed}
      </p>
      <div
        role="progressbar"
        aria-label="오늘 처리 진행률"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        className="h-3 overflow-hidden rounded-full bg-brand-100"
      >
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="등급별로 보기">
        <button
          type="button"
          aria-pressed={filter === null}
          onClick={() => onFilter(null)}
          className={`min-h-12 rounded-full px-4 text-base font-bold ring-2 ${
            filter === null ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white/80 text-ink ring-brand-200'
          }`}
        >
          전체 {view.cards.length}
        </button>
        {GRADES.map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={filter === g}
            onClick={() => onFilter(filter === g ? null : g)}
            disabled={view.counts[g] === 0}
            className={`min-h-12 rounded-full px-4 text-base font-bold ring-2 disabled:opacity-40 ${GRADE_CHIP[g]} ${
              filter === g ? 'outline-3 outline-offset-2 outline-ink' : ''
            }`}
          >
            {GRADE_LABEL[g]} {view.counts[g]}
          </button>
        ))}
      </div>
    </section>
  )
}
