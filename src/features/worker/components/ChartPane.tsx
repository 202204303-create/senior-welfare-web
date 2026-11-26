import { Phone, Pin } from 'lucide-react'
import { useState } from 'react'
import { addNote, type NoteCategory } from '@/features/worker/api/chart'
import type { ElderChart } from '@/features/worker/hooks/useElderChart'
import { buildTimeline, medGrid, weekStats, type TimelineKind } from '@/features/worker/lib/chart'
import { GRADE_LABEL, RESULT_LABEL } from '@/features/worker/lib/queue'
import type { OpenIssue, QueueRow, Summary } from '@/features/worker/types'
import { GRADE_TAG, OK_TAG, btn, fmtDateTime, tag, td, th } from '@/features/worker/ui/styles'

type Tab = 'timeline' | 'overview' | 'meds' | 'actions' | 'notes'
const TABS: { id: Tab; label: string }[] = [
  { id: 'timeline', label: '타임라인' },
  { id: 'overview', label: '개요' },
  { id: 'meds', label: '복약' },
  { id: 'actions', label: '상담 기록' },
  { id: 'notes', label: '특이사항' },
]
const FILTERS: { id: TimelineKind | 'all'; label: string }[] = [
  { id: 'all', label: '전체' },
  { id: 'alert', label: '알림' },
  { id: 'record', label: '기록' },
  { id: 'action', label: '상담' },
]
const TAG_STYLE: Record<string, string> = {
  긴급: GRADE_TAG.P1,
  알림: GRADE_TAG.P3,
  기록: 'border-slate-300 text-slate-600',
  상담: 'border-blue-300 bg-blue-50 text-blue-800',
  정정: 'border-slate-400 bg-slate-100 text-slate-700',
}
const ago = (iso: string, now: Date) => {
  const m = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (m < 1) return '방금'
  if (m < 60) return `${m}분 전`
  if (m < 1440) return `${Math.floor(m / 60)}시간 전`
  return `${Math.floor(m / 1440)}일 전`
}

/** 가운데: 어르신 차트. 고정 헤더 · 📌 특이사항 · 탭(타임라인, 개요, 복약, 상담 기록, 특이사항) */
export function ChartPane({
  row,
  summary,
  issues,
  chart,
  now,
  todayKey,
  hideHeader = false,
}: {
  row: QueueRow
  summary: Summary | null
  issues: OpenIssue[]
  chart: ElderChart
  now: Date
  todayKey: string
  /** 이름·전화 머리말을 숨김 (쉬운 화면에서 위쪽에 이미 보여 줄 때) */
  hideHeader?: boolean
}) {
  const [tab, setTab] = useState<Tab>('timeline')
  const [filter, setFilter] = useState<TimelineKind | 'all'>('all')
  const { family } = chart
  const meds = family?.medications ?? []
  const timeline = buildTimeline(meds, chart.days, chart.alerts, chart.actions)
  const stats = weekStats(meds, chart.days, todayKey)
  const today = chart.days[todayKey]
  const takenToday = meds.filter((m) => today?.takenMeds?.[m.id]).length
  const pinned = chart.notes.filter((n) => n.pinned)
  const phone = family?.elderPhone || summary?.elderPhone
  const grade = summary?.highestGrade

  return (
    <div className="flex min-h-0 flex-col text-[13px]">
      {/* 고정 헤더 */}
      <div className={`border-b border-slate-200 px-4 py-3 ${hideHeader ? 'hidden' : ''}`}>
        <h2 className="flex flex-wrap items-center gap-2 text-[17px] font-bold">
          {grade ? (
            <span className={`${tag} ${GRADE_TAG[grade]}`}>
              {grade} {summary?.status}
            </span>
          ) : (
            <span className={`${tag} ${OK_TAG}`}>정상</span>
          )}
          {row.displayName}
          <span className="text-[13px] font-normal text-slate-600">
            {[row.dong, ...row.tags].filter(Boolean).join(' · ')}
            {row.dong || row.tags.length ? ' · ' : ''}가족 코드 {row.code}
          </span>
        </h2>
        <p className="mt-1 text-slate-600">
          마지막 연락 {summary?.lastContactAt ? fmtDateTime(summary.lastContactAt, todayKey) : '기록 없음'} ·
          앱 마지막 사용 {family?.lastSeenAt ? ago(family.lastSeenAt, now) : '기록 없음'}
          {family?.guardianName ? ` · 보호자 ${family.guardianName}` : ''}
        </p>
        {phone && (
          <a href={`tel:${phone}`} className={`${btn} mt-2`}>
            <Phone className="size-3.5" aria-hidden /> 어르신 {phone}
          </a>
        )}
      </div>
      {pinned.length > 0 && (
        <p className="flex items-start gap-1.5 border-b border-amber-300 bg-amber-50 px-4 py-1.5 text-amber-900">
          <Pin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            <b>특이사항</b> {pinned.map((n) => n.text).join(' · ')}
          </span>
        </p>
      )}

      {/* 탭 */}
      <div className="flex border-b border-slate-300 px-2" role="tablist" aria-label="차트">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 ${tab === t.id ? 'border-b-2 border-blue-700 font-bold text-blue-800' : 'text-slate-500'}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3" role="tabpanel">
        {chart.error && (
          <p
            role="alert"
            className="mb-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900"
          >
            기록을 읽지 못했어요: {chart.error}
          </p>
        )}
        {family === undefined && !chart.error && <p className="text-slate-500">불러오는 중…</p>}
        {family === null && <p className="text-slate-500">이 어르신의 기록이 아직 없어요.</p>}

        {family && (tab === 'timeline' || tab === 'overview') && (
          <dl className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['오늘 기상', today?.wakeUpAt ? fmtDateTime(today.wakeUpAt, todayKey) : '미확인'],
              ['오늘 복약', `${takenToday} / ${meds.length}`],
              ['이번 주 기상', `${stats.wakeDays} / ${stats.totalDays}일`],
              ['이번 주 복약', stats.medRate === null ? '약 없음' : `${stats.medRate}%`],
            ].map(([k, v]) => (
              <div key={k} className="rounded border border-slate-200 p-2">
                <dt className="text-[12px] text-slate-500">{k}</dt>
                <dd className="text-[16px] font-bold">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {family && tab === 'timeline' && (
          <>
            <div className="mb-2 flex gap-1" role="group" aria-label="타임라인 거르기">
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  aria-pressed={filter === f.id}
                  onClick={() => setFilter(f.id)}
                  className={`rounded-[3px] border px-2 py-0.5 text-[12px] ${
                    filter === f.id ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 bg-white'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <table className="w-full border-collapse">
              <tbody>
                {timeline
                  .filter((e) => filter === 'all' || e.kind === filter)
                  .map((e) => (
                    <tr key={e.key}>
                      <td className={`${td} w-24 whitespace-nowrap text-slate-500 tabular-nums`}>
                        {fmtDateTime(e.at, todayKey)}
                      </td>
                      <td className={`${td} w-14`}>
                        <span className={`${tag} ${TAG_STYLE[e.tag]}`}>{e.tag}</span>
                      </td>
                      <td className={td}>{e.text}</td>
                      <td className={`${td} whitespace-nowrap text-[12px] text-slate-400`}>{e.by}</td>
                    </tr>
                  ))}
                {timeline.length === 0 && (
                  <tr>
                    <td className={`${td} text-slate-500`}>최근 7일 기록이 없어요.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {family && tab === 'overview' && (
          <>
            <p className="mb-1 font-bold">열린 이슈</p>
            {issues.length === 0 ? (
              <p className="text-emerald-700">지금 확인이 필요한 일이 없어요.</p>
            ) : (
              <ul className="space-y-1">
                {issues.map((i, idx) => (
                  <li key={`${i.type}-${idx}`} className="flex items-start gap-2">
                    <span className={`${tag} ${GRADE_TAG[i.grade]}`}>{GRADE_LABEL[i.grade]}</span>
                    <span>
                      {i.text}
                      {i.lastAction && (
                        <span className="block text-[12px] text-slate-500">
                          {fmtDateTime(i.lastAction.at, todayKey)} {RESULT_LABEL[i.lastAction.result]}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {family && tab === 'meds' && <MedTable chart={chart} todayKey={todayKey} />}

        {family && tab === 'actions' && (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>시각</th>
                <th className={th}>내용</th>
                <th className={th}>작성</th>
              </tr>
            </thead>
            <tbody>
              {timeline
                .filter((e) => e.kind === 'action')
                .map((e) => (
                  <tr key={e.key}>
                    <td className={`${td} whitespace-nowrap text-slate-500`}>
                      {fmtDateTime(e.at, todayKey)}
                    </td>
                    <td className={td}>
                      <span className={`${tag} ${TAG_STYLE[e.tag]} mr-1`}>{e.tag}</span>
                      {e.text}
                    </td>
                    <td className={`${td} whitespace-nowrap text-[12px] text-slate-400`}>{e.by}</td>
                  </tr>
                ))}
              {!timeline.some((e) => e.kind === 'action') && (
                <tr>
                  <td colSpan={3} className={`${td} text-slate-500`}>
                    상담 기록이 없어요. 오른쪽 처리 패널에서 남겨요.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'notes' && <NotesTab code={row.code} chart={chart} todayKey={todayKey} />}
      </div>
    </div>
  )
}

function MedTable({ chart, todayKey }: { chart: ElderChart; todayKey: string }) {
  const grid = medGrid(chart.family?.medications ?? [], chart.days, todayKey)
  if (grid.rows.length === 0) return <p className="text-slate-500">등록된 약이 없어요.</p>
  const CELL = {
    taken: ['✓', 'text-emerald-700'],
    missed: ['놓침', 'bg-rose-50 font-bold text-rose-700'],
    none: ['-', 'text-slate-300'],
  } as const
  return (
    <table className="w-full border-collapse">
      <thead>
        <tr>
          <th className={th}>약</th>
          {grid.days.map((d) => (
            <th key={d} className={`${th} text-center`}>
              {Number(d.slice(8))}일
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {grid.rows.map(({ med, cells }) => (
          <tr key={med.id}>
            <td className={td}>
              <b>{med.name}</b>{' '}
              <span className="text-[12px] text-slate-500">
                {med.slot} {med.time}
              </span>
            </td>
            {cells.map((c, i) => (
              <td key={grid.days[i]} className={`${td} text-center ${CELL[c][1]}`}>
                {CELL[c][0]}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
      <caption className="caption-bottom pt-2 text-left text-[12px] text-slate-500">
        ✓ 드심 · 놓침: 그날 기록은 있는데 체크 안 함 · -: 기록 없음 또는 오늘
      </caption>
    </table>
  )
}

function NotesTab({ code, chart, todayKey }: { code: string; chart: ElderChart; todayKey: string }) {
  const [text, setText] = useState('')
  const [category, setCategory] = useState<NoteCategory>('의료')
  const [pinned, setPinned] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async () => {
    if (!text.trim()) return
    setSaving(true)
    setError(null)
    try {
      await addNote(code, { text: text.trim(), category, pinned })
      setText('')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }
  return (
    <div className="space-y-3">
      <ul className="space-y-1">
        {chart.notes.map((n) => (
          <li key={n.id} className="flex items-start gap-2 rounded border border-slate-200 px-2 py-1.5">
            <span className={`${tag} border-slate-300 text-slate-600`}>{n.category}</span>
            <span className="flex-1">
              {n.pinned && '📌 '}
              {n.text}
            </span>
            <span className="text-[12px] text-slate-400">{fmtDateTime(n.createdAt, todayKey)}</span>
          </li>
        ))}
        {chart.notes.length === 0 && <li className="text-slate-500">특이사항이 없어요.</li>}
      </ul>
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-slate-200 p-2">
        <label className="sr-only" htmlFor="note-category">
          분류
        </label>
        <select
          id="note-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as NoteCategory)}
          className="rounded border border-slate-300 px-1.5 py-1"
        >
          <option>의료</option>
          <option>생활</option>
          <option>연락</option>
        </select>
        <label className="sr-only" htmlFor="note-text">
          특이사항 내용
        </label>
        <input
          id="note-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="예: 청력 약함, 크게 천천히 말하기"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1"
        />
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> 📌 고정
        </label>
        <button type="button" onClick={() => void submit()} disabled={saving || !text.trim()} className={btn}>
          추가
        </button>
      </div>
      {error && (
        <p role="alert" className="text-amber-800">
          추가하지 못했어요: {error}
        </p>
      )}
      <p className="text-[12px] text-slate-500">
        특이사항은 지울 수 없어요. 📌 고정한 항목은 차트 맨 위에 늘 보여요.
      </p>
    </div>
  )
}
