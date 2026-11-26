import { GRADE_LABEL, waitLabel, type QueueCard, type QueueView } from '@/features/worker/lib/queue'
import { GRADE_TAG, OK_TAG, fmtDateTime, kbd, paneHead, tag, td, th } from '@/features/worker/ui/styles'

/** 왼쪽: 오늘 큐 표 (등급 → 기다린 시간), 아래에 정상 어르신 */
export function QueueTable({
  cards,
  normal,
  waiting,
  selected,
  onSelect,
  now,
  todayKey,
}: {
  cards: QueueCard[]
  normal: QueueView['normal']
  waiting: QueueView['waiting']
  selected: string | null
  onSelect: (code: string) => void
  now: Date
  todayKey: string
}) {
  const rowCls = (code: string) =>
    `cursor-pointer ${selected === code ? 'bg-blue-50 shadow-[inset_3px_0_0_#2563eb]' : 'hover:bg-slate-50'}`
  const onKey = (code: string) => (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onSelect(code)
    }
  }
  return (
    <div className="flex min-h-0 flex-col">
      <div className={paneHead}>
        오늘 큐 <span className="font-normal text-slate-500">등급 → 기다린 시간</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr>
              <th className={th}>등급</th>
              <th className={th}>이름</th>
              <th className={th}>이유</th>
              <th className={th}>대기</th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c) => (
              <tr
                key={c.row.code}
                className={rowCls(c.row.code)}
                onClick={() => onSelect(c.row.code)}
                onKeyDown={onKey(c.row.code)}
                tabIndex={0}
                aria-selected={selected === c.row.code}
              >
                <td className={td}>
                  <span className={`${tag} ${GRADE_TAG[c.grade]}`} title={GRADE_LABEL[c.grade]}>
                    {c.grade}
                  </span>
                </td>
                <td className={td}>
                  <b className="whitespace-nowrap">{c.row.displayName}</b>
                  {c.row.tags.length > 0 && (
                    <div className="text-[11px] text-slate-500">{c.row.tags.join(' · ')}</div>
                  )}
                </td>
                <td className={`${td} text-[12px] text-slate-600`}>
                  {c.issues.map((i) => i.text).join(' · ')}
                  {c.issues[0]?.lastAction?.followUpAt && (
                    <div className="text-[11px] text-blue-700">
                      {fmtDateTime(c.issues[0].lastAction.followUpAt, todayKey)} 재시도
                    </div>
                  )}
                </td>
                <td className={`${td} whitespace-nowrap tabular-nums`}>
                  {waitLabel(c.since, now).replace('째', '')}
                </td>
              </tr>
            ))}
            {cards.length === 0 && (
              <tr>
                <td colSpan={4} className={`${td} py-4 text-center text-emerald-700`}>
                  지금 처리할 일이 없어요.
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {(normal.length > 0 || waiting.length > 0) && (
          <div className="border-y border-slate-200 bg-slate-50 px-2 py-1.5 text-[12px] text-slate-500">
            정상 {normal.length}명{waiting.length > 0 && ` · 요약 준비 중 ${waiting.length}명`}
          </div>
        )}
        <table className="w-full border-collapse text-[13px]">
          <tbody>
            {normal.map(({ row, summary }) => (
              <tr
                key={row.code}
                className={rowCls(row.code)}
                onClick={() => onSelect(row.code)}
                onKeyDown={onKey(row.code)}
                tabIndex={0}
                aria-selected={selected === row.code}
              >
                <td className={td}>
                  <span className={`${tag} ${OK_TAG}`}>정상</span>
                </td>
                <td className={`${td} whitespace-nowrap`}>{row.displayName}</td>
                <td className={`${td} text-[12px] text-slate-600`}>
                  기상 {summary.todayWakeAt ? fmtDateTime(summary.todayWakeAt, todayKey) : '전'} · 약{' '}
                  {summary.todayMedDone}/{summary.todayMedTotal}
                </td>
                <td className={`${td} text-[12px] text-slate-400`}>
                  {summary.handledToday ? '처리 오늘' : ''}
                </td>
              </tr>
            ))}
            {waiting.map((row) => (
              <tr key={row.code}>
                <td className={td}>
                  <span className={`${tag} border-slate-300 text-slate-500`}>대기</span>
                </td>
                <td className={`${td} whitespace-nowrap`}>{row.displayName}</td>
                <td colSpan={2} className={`${td} text-[12px] text-slate-500`}>
                  요약 준비 중 (10분 안에 나타나요)
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="hidden border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-500 md:block">
        <span className={kbd}>J</span>/<span className={kbd}>K</span> 이동 · <span className={kbd}>/</span>{' '}
        검색 · <span className={kbd}>?</span> 단축키
      </div>
    </div>
  )
}
