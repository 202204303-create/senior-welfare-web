import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  LogOut,
  Phone,
  Search,
  Siren,
  Undo2,
  UserRound,
} from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useAccountAuth } from '@/features/auth/hooks/useAccountAuth'
import { todayKey as toKey } from '@/features/care/store/useCareStore'
import { undoActions, type SavedAction } from '@/features/worker/api/actions'
import { ChartPane } from '@/features/worker/components/ChartPane'
import { QuickActions } from '@/features/worker/components/QuickActions'
import { WorkerPushSetup } from '@/features/worker/components/WorkerPushSetup'
import { useAssignments } from '@/features/worker/hooks/useAssignments'
import { useElderChart } from '@/features/worker/hooks/useElderChart'
import { useWorkerQueue } from '@/features/worker/hooks/useWorkerQueue'
import { buildQueue, waitLabel, type QueueCard } from '@/features/worker/lib/queue'
import { isSampleCode } from '@/features/worker/lib/sampleElders'
import type { Grade, Overlay, QueueRow, Summary } from '@/features/worker/types'
import { fmtDateTime } from '@/features/worker/ui/styles'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import { useNow } from '@/shared/hooks/useNow'

const UNDO_SECONDS = 5

/**
 * 어려운 등급(P1~P5) 대신 네 가지 말로 보여 줍니다. (복지사 화면 쉽게 — 팀 피드백)
 * 긴급: 긴급 요청(SOS) · 확인 필요: 보호자 미확인·기상 미확인·복약 누락 · 연락 필요: 며칠째 연락 없음 · 괜찮음
 */
type Level = 'urgent' | 'warn' | 'contact' | 'ok'
const levelOf = (g: Grade | null | undefined): Level =>
  !g ? 'ok' : g === 'P1' ? 'urgent' : g === 'P5' ? 'contact' : 'warn'
const LEVEL: Record<Level, { label: string; chip: string; card: string; Icon: typeof Siren }> = {
  urgent: {
    label: '긴급',
    chip: 'bg-rose-600 text-white',
    card: 'border-l-rose-600 bg-rose-50',
    Icon: Siren,
  },
  warn: {
    label: '확인 필요',
    chip: 'bg-amber-500 text-white',
    card: 'border-l-amber-500 bg-amber-50',
    Icon: AlertTriangle,
  },
  contact: {
    label: '연락 필요',
    chip: 'bg-sky-600 text-white',
    card: 'border-l-sky-600 bg-sky-50',
    Icon: Phone,
  },
  ok: {
    label: '괜찮음',
    chip: 'bg-emerald-600 text-white',
    card: 'border-l-emerald-500 bg-white',
    Icon: Check,
  },
}
type Filter = 'all' | Level

/**
 * 복지사 화면 (쉬운 화면).
 * 왼쪽: 지금 확인할 어르신 카드(급한 순) + 괜찮은 어르신. 오른쪽(휴대폰은 눌러서): 왜 확인해야 하는지 · 오늘 상태 · 큰 처리 버튼.
 * 자세한 기록(타임라인·복약·상담·특이사항)은 '자세한 기록 보기'를 눌러야 펼쳐집니다.
 */
export function WorkerPage() {
  const { signOut } = useAccountAuth()
  const { assignments, loading: assignLoading, error: assignError } = useAssignments()
  const { rows, error } = useWorkerQueue(assignments)
  const now = useNow(30_000)
  const todayKey = toKey(now)
  const [overlays, setOverlays] = useState<Record<string, Overlay>>({})
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [showDetail, setShowDetail] = useState(false) // 휴대폰: 목록 ↔ 상세
  const [showChart, setShowChart] = useState(false)
  const [undo, setUndo] = useState<{ saved: SavedAction; name: string; label: string } | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)

  const view = buildQueue(rows, overlays)
  const q = search.trim().toLowerCase()
  const match = (r: QueueRow) =>
    !q || [r.displayName, r.dong, r.code, ...r.tags].some((s) => s.toLowerCase().includes(q))
  const counts: Record<Level, number> = { urgent: 0, warn: 0, contact: 0, ok: view.normal.length }
  view.cards.forEach((c) => counts[levelOf(c.grade)]++)

  const cards = view.cards.filter((c) => match(c.row) && (filter === 'all' || filter === levelOf(c.grade)))
  const normal = filter === 'all' || filter === 'ok' ? view.normal.filter((n) => match(n.row)) : []
  const order = [...cards.map((c) => c.row.code), ...normal.map((n) => n.row.code)]
  const current = selectedCode && order.includes(selectedCode) ? selectedCode : (order[0] ?? null)
  const card = view.cards.find((c) => c.row.code === current)
  const normalRow = view.normal.find((n) => n.row.code === current)
  const row = card?.row ?? normalRow?.row ?? null
  const summary = card?.summary ?? normalRow?.summary ?? null
  const issues = card?.issues ?? []
  const chart = useElderChart(current)

  const select = (code: string) => {
    setSelectedCode(code)
    setShowDetail(true)
    setShowChart(false)
  }

  useEffect(() => {
    if (!undo) return
    const id = setTimeout(() => setUndo(null), UNDO_SECONDS * 1000)
    return () => clearTimeout(id)
  }, [undo])

  const onSaved = (saved: SavedAction, overlay: Overlay, label: string) => {
    setOverlays((prev) => ({ ...prev, [saved.code]: overlay }))
    setUndo({ saved, name: row?.displayName ?? '', label })
    setUndoError(null)
  }
  const doUndo = async () => {
    if (!undo) return
    const { saved } = undo
    setUndo(null)
    try {
      await undoActions(saved)
      setOverlays((prev) => {
        const next = { ...prev }
        delete next[saved.code]
        return next
      })
    } catch (e) {
      setUndoError(`되돌리지 못했어요. 다시 눌러 주세요. (${(e as Error).message})`)
    }
  }

  const blocking = !isFirebaseEnabled
    ? '서버 연결이 설정되지 않았어요. 복지사 화면은 Firebase 설정이 있어야 동작해요.'
    : assignError
      ? `담당 목록을 읽지 못했어요: ${assignError}`
      : !assignLoading && assignments.length === 0
        ? '담당 어르신이 아직 없어요. 관리자가 배정하면 나타나요.'
        : null

  const FILTERS: { id: Filter; label: string; n: number }[] = [
    { id: 'all', label: '전체', n: assignments.length },
    { id: 'urgent', label: '긴급', n: counts.urgent },
    { id: 'warn', label: '확인 필요', n: counts.warn },
    { id: 'contact', label: '연락 필요', n: counts.contact },
    { id: 'ok', label: '괜찮음', n: counts.ok },
  ]

  return (
    <div className="flex h-dvh flex-col bg-slate-100 text-[15px] leading-normal text-slate-800">
      {/* 위쪽 막대 */}
      <header className="bg-slate-800 px-3 py-2 text-slate-100">
        <div className="flex items-center gap-2">
          <b className="text-[17px] whitespace-nowrap text-white">늘봄 복지사</b>
          <span className="text-[13px] whitespace-nowrap text-slate-300">담당 {assignments.length}명</span>
          <div className="ml-auto flex items-center gap-2 text-[13px] whitespace-nowrap">
            <WorkerPushSetup codes={assignments.map((a) => a.code).filter((c) => !isSampleCode(c))} />
            <button
              type="button"
              onClick={signOut}
              className="flex items-center gap-1 rounded px-2 py-1 hover:bg-slate-700"
            >
              <LogOut className="size-4" aria-hidden /> 로그아웃
            </button>
          </div>
        </div>
      </header>

      {blocking ? (
        <p className="m-4 rounded-lg border border-slate-300 bg-white p-4">{blocking}</p>
      ) : (
        <main id="main" className="grid min-h-0 flex-1 lg:grid-cols-[minmax(340px,420px)_1fr]">
          {/* 왼쪽: 어르신 목록 */}
          <section
            aria-label="어르신 목록"
            className={`${showDetail ? 'hidden' : 'flex'} min-h-0 flex-col border-r border-slate-300 bg-white lg:flex`}
          >
            <div className="space-y-2 border-b border-slate-200 p-3">
              <label className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
                <Search className="size-4 text-slate-500" aria-hidden />
                <span className="sr-only">이름·동네 검색</span>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="이름·동네 검색"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                />
              </label>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="골라 보기">
                {FILTERS.filter((f) => f.id === 'all' || f.n > 0).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    aria-pressed={filter === f.id}
                    onClick={() => setFilter(f.id)}
                    className={`rounded-full px-3 py-1 text-[14px] font-bold whitespace-nowrap ${
                      filter === f.id
                        ? f.id === 'all'
                          ? 'bg-slate-800 text-white'
                          : LEVEL[f.id].chip
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {f.label} {f.n}
                  </button>
                ))}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
              {(error || undoError) && (
                <p
                  role="alert"
                  className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[14px] text-amber-900"
                >
                  {undoError ?? `일부 어르신 정보를 읽지 못했어요: ${error}`}
                </p>
              )}
              {filter !== 'ok' && (
                <p className="px-1 text-[14px] font-bold text-slate-600">
                  지금 확인할 어르신 {cards.length}명{' '}
                  <span className="font-normal text-slate-500">· 급한 순</span>
                </p>
              )}
              {filter !== 'ok' && cards.length === 0 && (
                <p className="rounded-lg bg-emerald-50 p-3 font-bold text-emerald-800">
                  지금 확인할 어르신이 없어요 👏
                </p>
              )}
              {cards.map((c) => (
                <ElderCard
                  key={c.row.code}
                  card={c}
                  now={now}
                  selected={c.row.code === current}
                  onSelect={() => select(c.row.code)}
                />
              ))}

              {normal.length > 0 && (
                <>
                  <p className="px-1 pt-2 text-[14px] font-bold text-slate-600">
                    괜찮은 어르신 {normal.length}명
                  </p>
                  <ul className="divide-y divide-slate-100 rounded-lg ring-1 ring-slate-200">
                    {normal.map(({ row: r, summary: s }) => (
                      <li key={r.code}>
                        <button
                          type="button"
                          onClick={() => select(r.code)}
                          aria-current={r.code === current ? 'true' : undefined}
                          className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left ${
                            r.code === current ? 'bg-blue-50' : 'hover:bg-slate-50'
                          }`}
                        >
                          <span className="font-bold whitespace-nowrap">{r.displayName}</span>
                          <span className="truncate text-[13px] text-slate-500">
                            기상 {s.todayWakeAt ? fmtDateTime(s.todayWakeAt, todayKey) : '전'} · 약{' '}
                            {s.todayMedDone}/{s.todayMedTotal}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {view.waiting.length > 0 && filter === 'all' && (
                <p className="px-1 text-[13px] text-slate-500">
                  정보 준비 중: {view.waiting.map((w) => w.displayName).join(', ')} (10분 안에 나타나요)
                </p>
              )}
            </div>
          </section>

          {/* 오른쪽: 고른 어르신 */}
          <section
            aria-label="어르신 상세"
            className={`${showDetail ? 'flex' : 'hidden'} min-h-0 flex-col overflow-y-auto bg-slate-50 lg:flex`}
          >
            <button
              type="button"
              onClick={() => setShowDetail(false)}
              className="flex items-center gap-1 border-b border-slate-200 bg-white px-3 py-2.5 font-bold text-blue-700 lg:hidden"
            >
              <ArrowLeft className="size-5" aria-hidden /> 목록으로
            </button>
            {row ? (
              <ElderDetail
                key={row.code}
                row={row}
                summary={summary}
                card={card}
                now={now}
                todayKey={todayKey}
                lastSeenAt={chart.family?.lastSeenAt}
                phone={chart.family?.elderPhone || summary?.elderPhone || ''}
              >
                <QuickActions code={row.code} issues={issues} onSaved={onSaved} />
                <button
                  type="button"
                  onClick={() => setShowChart((v) => !v)}
                  aria-expanded={showChart}
                  className="mt-4 flex w-full items-center justify-between gap-2 rounded-xl bg-white px-4 py-3 text-left font-bold ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  자세한 기록 보기 (타임라인·복약·상담·특이사항)
                  <ChevronDown
                    className={`size-5 shrink-0 transition ${showChart ? 'rotate-180' : ''}`}
                    aria-hidden
                  />
                </button>
                {showChart && (
                  <div className="mt-2 overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
                    <ChartPane
                      row={row}
                      summary={summary}
                      issues={issues}
                      chart={chart}
                      now={now}
                      todayKey={todayKey}
                      hideHeader
                    />
                  </div>
                )}
              </ElderDetail>
            ) : (
              <p className="p-6 text-slate-500">왼쪽에서 어르신을 고르세요.</p>
            )}
          </section>
        </main>
      )}

      {undo && (
        <div
          role="status"
          className="fixed inset-x-3 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-xl bg-slate-900 px-4 py-3 text-white shadow-lg"
        >
          <p className="min-w-0 flex-1">
            {undo.name} 님 기록 저장: {undo.label}
          </p>
          <button
            type="button"
            onClick={() => void doUndo()}
            className="flex items-center gap-1 rounded-lg bg-white/15 px-3 py-1.5 font-bold whitespace-nowrap"
          >
            <Undo2 className="size-4" aria-hidden /> 되돌리기
          </button>
        </div>
      )}
    </div>
  )
}

/** 확인할 어르신 카드 한 장 */
function ElderCard({
  card,
  now,
  selected,
  onSelect,
}: {
  card: QueueCard
  now: Date
  selected: boolean
  onSelect: () => void
}) {
  const lv = LEVEL[levelOf(card.grade)]
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected ? 'true' : undefined}
      className={`block w-full rounded-lg border-l-[6px] p-3 text-left ring-1 ring-slate-200 transition ${lv.card} ${
        selected ? 'outline-2 outline-offset-1 outline-blue-600' : 'hover:brightness-[0.98]'
      }`}
    >
      <span className="flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-bold whitespace-nowrap ${lv.chip}`}
        >
          <lv.Icon className="size-3.5" aria-hidden />
          {lv.label}
        </span>
        <b className="text-[17px] whitespace-nowrap">{card.row.displayName}</b>
        <span className="truncate text-[13px] text-slate-500">
          {[card.row.dong, ...card.row.tags].filter(Boolean).join(' · ')}
        </span>
        <span className="ml-auto shrink-0 text-[13px] font-bold whitespace-nowrap text-slate-600">
          {waitLabel(card.since, now)}
        </span>
      </span>
      <span className="mt-1 block text-[14px] text-slate-700">
        {card.issues.map((i) => i.text).join(' · ')}
      </span>
    </button>
  )
}

/** 오른쪽 상세: 누구 · 왜 · 오늘 상태 · 처리 */
function ElderDetail({
  row,
  summary,
  card,
  now,
  todayKey,
  lastSeenAt,
  phone,
  children,
}: {
  row: QueueRow
  summary: Summary | null
  card: QueueCard | undefined
  now: Date
  todayKey: string
  lastSeenAt?: string
  phone: string
  children: ReactNode
}) {
  const lv = LEVEL[levelOf(card?.grade)]
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[13px] font-bold ${lv.chip}`}
          >
            <lv.Icon className="size-3.5" aria-hidden />
            {lv.label}
          </span>
          <h2 className="mt-1 flex items-center gap-2 text-[22px] font-black">
            <UserRound className="size-6 text-slate-400" aria-hidden />
            {row.displayName} 님
          </h2>
          <p className="text-[13px] text-slate-500">
            {[row.dong, ...row.tags].filter(Boolean).join(' · ')}
            {summary?.guardianName ? ` · 보호자 ${summary.guardianName}` : ''}
          </p>
        </div>
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-blue-700 px-4 py-2.5 font-bold whitespace-nowrap text-white"
          >
            <Phone className="size-5" aria-hidden /> 전화
          </a>
        ) : (
          <span className="shrink-0 text-[13px] text-slate-500">번호 없음</span>
        )}
      </div>

      {card && card.issues.length > 0 && (
        <section className="rounded-xl bg-white p-4 ring-1 ring-slate-200" aria-label="확인할 일">
          <p className="mb-2 font-bold">왜 확인해야 하나요</p>
          <ul className="space-y-1.5">
            {card.issues.map((i, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span
                  className={`mt-1.5 size-2.5 shrink-0 rounded-full ${
                    i.grade === 'P1' ? 'bg-rose-600' : i.grade === 'P5' ? 'bg-sky-600' : 'bg-amber-500'
                  }`}
                  aria-hidden
                />
                <span>
                  {i.text}
                  <span className="ml-1 text-[13px] text-slate-500">({waitLabel(i.since, now)})</span>
                  {i.lastAction?.followUpAt && (
                    <span className="block text-[13px] text-blue-700">
                      {fmtDateTime(i.lastAction.followUpAt, todayKey)}에 다시 하기로 함
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          ['오늘 기상', summary?.todayWakeAt ? fmtDateTime(summary.todayWakeAt, todayKey) : '아직'],
          ['오늘 약', summary ? `${summary.todayMedDone} / ${summary.todayMedTotal}` : '-'],
          ['앱 사용', lastSeenAt ? fmtDateTime(lastSeenAt, todayKey) : '-'],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <dt className="text-[13px] text-slate-500">{k}</dt>
            <dd className="text-[17px] font-bold">{v}</dd>
          </div>
        ))}
      </dl>

      <section aria-label="처리하기">
        <p className="mb-2 font-bold">처리하기</p>
        {children}
      </section>
    </div>
  )
}
