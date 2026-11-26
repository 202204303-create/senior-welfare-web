import { useState } from 'react'
import { saveActions, type SavedAction } from '@/features/worker/api/actions'
import { RESULT_LABEL, issuesClosedBy } from '@/features/worker/lib/queue'
import type { QueueCard } from '@/features/worker/lib/queue'
import type { ActionResult, Overlay } from '@/features/worker/types'
import { BigButton, Modal, StatusNote } from '@/shared/ui'

const RESULTS: ActionResult[] = ['call_ok', 'call_no_answer', 'visit_needed', 'guardian_notified', 'other']

/** 자주 쓰는 메모. 누르면 메모 칸이 채워집니다. */
const TEMPLATES = [
  { id: 'call-ok-meal', text: '통화 완료, 식사 잘 하심' },
  { id: 'no-answer-retry', text: '부재중, 30분 뒤 재시도' },
  { id: 'med-check', text: '복약 확인 요청함' },
  { id: 'guardian-visit', text: '보호자와 통화, 방문 협의' },
  { id: 'ok-recheck', text: '이상 없음, 다음 주 재확인' },
]
const RETRY_MIN = 30

/**
 * 처리하기: 결과 버튼을 누르면 바로 기록됩니다. 메모는 선택이고, "기타"만 메모가 필요합니다.
 * 이 어르신의 열린 이슈마다 기록이 한 건씩 남고, 통화 · 이상 없음이면 그 이슈들이 닫힙니다.
 */
export function ActionSheet({
  card,
  onClose,
  onSaved,
}: {
  card: QueueCard | null
  onClose: () => void
  onSaved: (saved: SavedAction, overlay: Overlay, resultLabel: string) => void
}) {
  const [note, setNote] = useState('')
  const [templateId, setTemplateId] = useState<string | undefined>()
  const [needNote, setNeedNote] = useState(false)
  const [saving, setSaving] = useState<ActionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setNote('')
    setTemplateId(undefined)
    setNeedNote(false)
    setError(null)
  }
  const close = () => {
    if (saving) return
    reset()
    onClose()
  }

  const save = async (result: ActionResult) => {
    if (!card) return
    if (result === 'other' && !note.trim()) {
      setNeedNote(true)
      return
    }
    setSaving(result)
    setError(null)
    try {
      const followUpAt =
        result === 'call_no_answer' ? new Date(Date.now() + RETRY_MIN * 60_000).toISOString() : undefined
      const saved = await saveActions({
        code: card.row.code,
        issues: card.issues,
        result,
        note: note.trim() || undefined,
        followUpAt,
        templateId,
      })
      onSaved(
        saved,
        {
          at: saved.at,
          result,
          byName: '담당 사회복지사',
          followUpAt,
          closed: issuesClosedBy(result, card.issues),
        },
        RESULT_LABEL[result],
      )
      reset()
    } catch (e) {
      setError(`저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. (${(e as Error).message})`)
    } finally {
      setSaving(null)
    }
  }

  return (
    <Modal
      open={card !== null}
      onClose={close}
      title={card ? `${card.row.displayName} 님 처리하기` : '처리하기'}
    >
      {card && (
        <div className="space-y-4">
          <ul className="space-y-1 text-base" aria-label="처리할 이슈">
            {card.issues.map((i, idx) => (
              <li key={`${i.type}-${idx}`} className="font-bold">
                · {i.text}
              </li>
            ))}
          </ul>

          <div className="grid gap-2" role="group" aria-label="처리 결과">
            {RESULTS.map((r) => (
              <BigButton
                key={r}
                variant={r === 'call_ok' ? 'primary' : 'soft'}
                size="lg"
                fullWidth
                loading={saving === r}
                disabled={saving !== null}
                onClick={() => save(r)}
              >
                {RESULT_LABEL[r]}
              </BigButton>
            ))}
          </div>

          <div>
            <p className="mb-2 text-sm font-bold text-ink-soft">메모 (선택, 결과를 누르기 전에 적으세요)</p>
            <div className="mb-2 flex flex-wrap gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => {
                    setNote(t.text)
                    setTemplateId(t.id)
                    setNeedNote(false)
                  }}
                  className="min-h-12 rounded-full bg-brand-100/80 px-4 text-sm font-bold text-brand-800"
                >
                  {t.text}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor="worker-note">
              메모
            </label>
            <textarea
              id="worker-note"
              value={note}
              onChange={(e) => {
                setNote(e.target.value)
                setTemplateId(undefined)
                setNeedNote(false)
              }}
              rows={3}
              className="w-full rounded-2xl bg-white/85 p-3 text-base ring-2 ring-brand-100 outline-none focus:ring-brand-400"
              placeholder="예: 보호자와 통화, 내일 방문 협의"
            />
          </div>

          {needNote && <StatusNote tone="warn">"기타"는 메모를 적어야 저장돼요.</StatusNote>}
          {error && <StatusNote tone="warn">{error}</StatusNote>}
        </div>
      )}
    </Modal>
  )
}
