import { CheckCircle2, ServerOff, UserRoundX, Undo2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LogoutButton } from '@/features/auth/components/LogoutButton'
import { undoActions, type SavedAction } from '@/features/worker/api/actions'
import { ActionSheet } from '@/features/worker/components/ActionSheet'
import { QueueCardView } from '@/features/worker/components/QueueCardView'
import { QueueSummaryBar } from '@/features/worker/components/QueueSummaryBar'
import { WorkerPushSetup } from '@/features/worker/components/WorkerPushSetup'
import { useAssignments } from '@/features/worker/hooks/useAssignments'
import { useWorkerQueue } from '@/features/worker/hooks/useWorkerQueue'
import { buildQueue, filterByGrade } from '@/features/worker/lib/queue'
import type { QueueCard } from '@/features/worker/lib/queue'
import type { Grade, Overlay } from '@/features/worker/types'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import { useNow } from '@/shared/hooks/useNow'
import { Logo } from '@/shared/layout/AppLayout'
import { EmptyState, ErrorState, LoadingList, StatusNote } from '@/shared/ui'

const UNDO_SECONDS = 5

interface UndoInfo {
  saved: SavedAction
  name: string
  resultLabel: string
}

/**
 * 복지사 화면: 오늘 큐. 담당 어르신의 서버 요약(summary)만 읽어,
 * 긴급·미확인부터 처리할 수 있게 등급 순으로 보여 줍니다.
 */
export function WorkerPage() {
  const { assignments, loading: assignLoading, error: assignError } = useAssignments()
  const { rows, loading: summaryLoading, error: summaryError } = useWorkerQueue(assignments)
  const now = useNow(30_000)
  const [overlays, setOverlays] = useState<Record<string, Overlay>>({})
  const [filter, setFilter] = useState<Grade | null>(null)
  const [active, setActive] = useState<QueueCard | null>(null)
  const [undo, setUndo] = useState<UndoInfo | null>(null)
  const [undoError, setUndoError] = useState<string | null>(null)

  const view = buildQueue(rows, overlays)
  const shown = filterByGrade(view.cards, filter)

  // 되돌리기 안내는 몇 초 뒤에 사라집니다.
  useEffect(() => {
    if (!undo) return
    const id = setTimeout(() => setUndo(null), UNDO_SECONDS * 1000)
    return () => clearTimeout(id)
  }, [undo])

  const onSaved = (saved: SavedAction, overlay: Overlay, resultLabel: string) => {
    const name = active?.row.displayName ?? ''
    setOverlays((prev) => ({ ...prev, [saved.code]: overlay }))
    setUndo({ saved, name, resultLabel })
    setUndoError(null)
    setActive(null)
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

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <span className="flex items-center gap-2">
            <span className="whitespace-nowrap rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
              복지사 화면
            </span>
            <LogoutButton />
          </span>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6 pb-28">
        <div>
          <h1 className="text-3xl font-black">오늘 큐</h1>
          <p className="mt-1 text-lg text-ink-soft">긴급·미확인부터 위에서 아래로 처리해요.</p>
        </div>

        {!isFirebaseEnabled ? (
          <EmptyState
            icon={<ServerOff />}
            title="서버 연결이 설정되지 않았어요"
            desc="복지사 화면은 Firebase 설정이 있어야 동작해요."
          />
        ) : assignError ? (
          <ErrorState message={assignError} />
        ) : assignLoading ? (
          <LoadingList count={2} />
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={<UserRoundX />}
            title="담당 어르신이 아직 없어요"
            desc="관리자가 담당 어르신을 배정하면 이곳에 나타나요."
          />
        ) : (
          <>
            <WorkerPushSetup codes={assignments.map((a) => a.code)} />
            {summaryError && <ErrorState message={summaryError} />}
            {summaryLoading && view.cards.length === 0 && view.normal.length === 0 && (
              <LoadingList count={2} />
            )}

            <QueueSummaryBar view={view} filter={filter} onFilter={setFilter} />

            {undoError && <StatusNote tone="warn">{undoError}</StatusNote>}

            {shown.length > 0 ? (
              <ul className="space-y-3" aria-label="처리할 어르신">
                {shown.map((card) => (
                  <QueueCardView key={card.row.code} card={card} now={now} onHandle={setActive} />
                ))}
              </ul>
            ) : (
              !summaryLoading && (
                <div className="glass flex items-center gap-3 rounded-3xl p-5 text-lg font-bold text-emerald-700">
                  <CheckCircle2 className="size-8 shrink-0" aria-hidden />
                  {filter ? '이 등급으로 처리할 어르신이 없어요.' : '지금 처리할 일이 없어요.'}
                </div>
              )
            )}

            {view.waiting.length > 0 && (
              <StatusNote tone="info">
                {view.waiting.map((r) => r.displayName).join(', ')} 님의 요약을 서버가 준비 중이에요. 10분
                안에 나타나요.
              </StatusNote>
            )}

            {view.normal.length > 0 && (
              <details className="glass rounded-3xl p-4">
                <summary className="min-h-12 cursor-pointer text-lg font-extrabold">
                  정상 {view.normal.length}명
                </summary>
                <ul className="mt-3 space-y-2">
                  {view.normal.map(({ row, summary }) => (
                    <li key={row.code} className="rounded-2xl bg-white/70 p-3 ring-1 ring-brand-100">
                      <p className="text-base font-extrabold">{row.displayName} 님 · 정상</p>
                      <p className="text-sm text-ink-soft">
                        기상 {summary.todayWakeAt ? '확인' : '확인 전'} · 약{' '}
                        {summary.todayMedTotal === 0
                          ? '없음'
                          : `${summary.todayMedDone}/${summary.todayMedTotal}`}
                        {summary.elderPhone && (
                          <>
                            {' '}
                            ·{' '}
                            <a
                              className="font-bold text-brand-700 underline"
                              href={`tel:${summary.elderPhone}`}
                            >
                              전화
                            </a>
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </main>

      {undo && (
        <div className="fixed inset-x-0 bottom-4 z-40 mx-auto flex max-w-md items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-glass-lg">
          <p className="min-w-0 flex-1 text-base font-bold">
            {undo.name} 님 · {undo.resultLabel}으로 기록했어요.
          </p>
          <button
            type="button"
            onClick={doUndo}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-xl bg-white/15 px-4 text-base font-extrabold"
          >
            <Undo2 className="size-5" aria-hidden /> 되돌리기
          </button>
        </div>
      )}

      <ActionSheet card={active} onClose={() => setActive(null)} onSaved={onSaved} />
    </div>
  )
}
