import { ArrowLeft, Undo2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { todayKey as toKey } from '@/features/care/store/useCareStore'
import { undoActions, type SavedAction } from '@/features/worker/api/actions'
import { ActionPanel } from '@/features/worker/components/ActionPanel'
import { ChartPane } from '@/features/worker/components/ChartPane'
import { QueueTable } from '@/features/worker/components/QueueTable'
import { TopBar } from '@/features/worker/components/TopBar'
import { useAssignments } from '@/features/worker/hooks/useAssignments'
import { useElderChart } from '@/features/worker/hooks/useElderChart'
import { useWorkerQueue } from '@/features/worker/hooks/useWorkerQueue'
import { buildQueue, filterByGrade } from '@/features/worker/lib/queue'
import { isSampleCode } from '@/features/worker/lib/sampleElders'
import type { Grade, Overlay } from '@/features/worker/types'
import { kbd } from '@/features/worker/ui/styles'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import { useNow } from '@/shared/hooks/useNow'

const UNDO_SECONDS = 5
type MobilePane = 'list' | 'chart' | 'action'

const SHORTCUTS: [string, string][] = [
  ['J / K', '다음 / 이전 어르신'],
  ['/', '이름 검색'],
  ['E', '통화 · 이상 없음 고르기'],
  ['N', '통화 · 받지 않음'],
  ['V', '방문 필요'],
  ['G', '보호자에게 전달'],
  ['O', '기타 (메모 필수)'],
  ['Ctrl + Enter', '기록 저장'],
  ['?', '이 도움말'],
]

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')

/**
 * 복지사 업무 화면 (전자차트형 3단): 왼쪽 오늘 큐 표 · 가운데 어르신 차트 · 오른쪽 처리 패널.
 * 어르신·보호자 화면과 달리 촘촘한 업무용 화면이며, PC 우선이고 휴대폰에서는 한 칸씩 넘깁니다.
 */
export function WorkerPage() {
  const { assignments, loading: assignLoading, error: assignError } = useAssignments()
  const { rows, loading, error } = useWorkerQueue(assignments)
  const now = useNow(30_000)
  const todayKey = toKey(now)
  const [overlays, setOverlays] = useState<Record<string, Overlay>>({})
  const [filter, setFilter] = useState<Grade | null>(null)
  const [search, setSearch] = useState('')
  const [selectedCode, setSelectedCode] = useState<string | null>(null)
  const [pane, setPane] = useState<MobilePane>('list')
  const [help, setHelp] = useState(false)
  const [undo, setUndo] = useState<{ saved: SavedAction; name: string; label: string } | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const view = buildQueue(rows, overlays)
  const q = search.trim().toLowerCase()
  const match = (r: { displayName: string; dong: string; tags: string[]; code: string }) =>
    !q || [r.displayName, r.dong, r.code, ...r.tags].some((s) => s.toLowerCase().includes(q))
  const cards = filterByGrade(view.cards, filter).filter((c) => match(c.row))
  const normal = filter ? [] : view.normal.filter((n) => match(n.row))
  const order = [...cards.map((c) => c.row.code), ...normal.map((n) => n.row.code)]
  // 고른 어르신이 목록에서 빠지면 맨 위 어르신을 보여 줍니다.
  const current = selectedCode && order.includes(selectedCode) ? selectedCode : (order[0] ?? null)
  const card = cards.find((c) => c.row.code === current) ?? view.cards.find((c) => c.row.code === current)
  const normalRow = normal.find((n) => n.row.code === current)
  const row = card?.row ?? normalRow?.row ?? null
  const summary = card?.summary ?? normalRow?.summary ?? null
  const issues = card?.issues ?? []
  const chart = useElderChart(current)

  const select = (code: string) => {
    setSelectedCode(code)
    setPane('chart')
  }

  // J/K 이동, / 검색, ? 도움말
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelp(false)
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      if (e.key === '/') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (e.key === '?') {
        setHelp((h) => !h)
      } else if (e.key === 'j' || e.key === 'k') {
        if (!order.length) return
        const idx = current ? order.indexOf(current) : -1
        const nextIdx = e.key === 'j' ? Math.min(order.length - 1, idx + 1) : Math.max(0, idx - 1)
        setSelectedCode(order[nextIdx])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  useEffect(() => {
    if (!undo) return
    const id = setTimeout(() => setUndo(null), UNDO_SECONDS * 1000)
    return () => clearTimeout(id)
  }, [undo])

  const onSaved = (saved: SavedAction, overlay: Overlay, label: string) => {
    setOverlays((prev) => ({ ...prev, [saved.code]: overlay }))
    setUndo({ saved, name: row?.displayName ?? '', label })
    setUndoError(null)
    setPane('chart')
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
      setUndoError(`되돌리지 못했어요. 다시 시도해 주세요. (${(e as Error).message})`)
    }
  }

  const blocking = !isFirebaseEnabled
    ? '서버 연결이 설정되지 않았어요. 복지사 화면은 Firebase 설정이 있어야 동작해요.'
    : assignError
      ? `담당 목록을 읽지 못했어요: ${assignError}`
      : !assignLoading && assignments.length === 0
        ? '담당 어르신이 아직 없어요. 관리자가 배정하면 나타나요.'
        : null

  const paneCls = (p: MobilePane) => `${pane === p ? 'flex' : 'hidden'} lg:flex min-h-0 flex-col bg-white`

  return (
    <div className="flex h-dvh flex-col bg-slate-100 text-[13px] leading-normal text-slate-800">
      <TopBar
        view={view}
        filter={filter}
        onFilter={setFilter}
        search={search}
        onSearch={setSearch}
        searchRef={searchRef}
        codes={assignments.map((a) => a.code).filter((c) => !isSampleCode(c))}
      />

      {blocking ? (
        <p className="m-4 rounded border border-slate-300 bg-white p-4 text-[14px]">{blocking}</p>
      ) : (
        <main
          id="main"
          className="grid min-h-0 flex-1 gap-px bg-slate-300 lg:grid-cols-[minmax(300px,360px)_1fr_minmax(260px,300px)]"
        >
          <section aria-label="오늘 큐" className={paneCls('list')}>
            {(error || undoError) && (
              <p role="alert" className="border-b border-amber-300 bg-amber-50 px-3 py-1.5 text-amber-900">
                {undoError ?? `요약을 읽지 못했어요: ${error}`}
              </p>
            )}
            {(assignLoading || (loading && rows.every((r) => !r.summary))) && (
              <p className="px-3 py-2 text-slate-500">불러오는 중…</p>
            )}
            <QueueTable
              cards={cards}
              normal={normal}
              waiting={filter ? [] : view.waiting.filter(match)}
              selected={current}
              onSelect={select}
              now={now}
              todayKey={todayKey}
            />
          </section>

          <section aria-label="어르신 차트" className={paneCls('chart')}>
            <button
              type="button"
              onClick={() => setPane('list')}
              className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 text-blue-700 lg:hidden"
            >
              <ArrowLeft className="size-4" aria-hidden /> 목록
            </button>
            {row ? (
              <ChartPane
                key={row.code}
                row={row}
                summary={summary}
                issues={issues}
                chart={chart}
                now={now}
                todayKey={todayKey}
              />
            ) : (
              <p className="p-4 text-slate-500">왼쪽에서 어르신을 고르세요.</p>
            )}
            {row && (
              <button
                type="button"
                onClick={() => setPane('action')}
                className="m-3 rounded bg-blue-700 py-2.5 font-bold text-white lg:hidden"
              >
                처리하기
              </button>
            )}
          </section>

          <section aria-label="처리" className={paneCls('action')}>
            <button
              type="button"
              onClick={() => setPane('chart')}
              className="flex items-center gap-1 border-b border-slate-200 px-3 py-2 text-blue-700 lg:hidden"
            >
              <ArrowLeft className="size-4" aria-hidden /> 차트
            </button>
            {row ? (
              <ActionPanel
                key={row.code}
                code={row.code}
                name={row.displayName}
                issues={issues}
                onSaved={onSaved}
              />
            ) : (
              <p className="p-4 text-slate-500">어르신을 고르면 처리할 수 있어요.</p>
            )}
          </section>
        </main>
      )}

      {undo && (
        <div
          role="status"
          className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded bg-slate-900 px-4 py-2.5 text-white shadow-lg"
        >
          <p className="min-w-0 flex-1">
            {undo.name} · {undo.label}으로 기록했어요.
          </p>
          <button
            type="button"
            onClick={() => void doUndo()}
            className="flex items-center gap-1 rounded bg-white/15 px-3 py-1.5 font-bold"
          >
            <Undo2 className="size-4" aria-hidden /> 되돌리기
          </button>
        </div>
      )}

      {help && (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30"
          onClick={() => setHelp(false)}
        >
          <div
            role="dialog"
            aria-label="단축키"
            className="w-80 rounded bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-2 text-[14px] font-bold">단축키</p>
            <table className="w-full">
              <tbody>
                {SHORTCUTS.map(([k, d]) => (
                  <tr key={k}>
                    <td className="py-1 pr-3">
                      <span className={kbd}>{k}</span>
                    </td>
                    <td className="py-1">{d}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[12px] text-slate-500">
              입력 칸에서 글을 쓸 때는 단축키가 동작하지 않아요. (Ctrl+Enter 제외)
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
