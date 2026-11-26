import { useEffect, useState } from 'react'
import { saveActions, type SavedAction } from '@/features/worker/api/actions'
import { NEXT_ACTION_LABEL, type NextAction } from '@/features/worker/lib/chart'
import { RESULT_LABEL, issuesClosedBy } from '@/features/worker/lib/queue'
import type { ActionResult, OpenIssue, Overlay } from '@/features/worker/types'
import { btn, btnPrimary, kbd, paneHead } from '@/features/worker/ui/styles'

const RESULTS: { r: ActionResult; key: string }[] = [
  { r: 'call_ok', key: 'E' },
  { r: 'call_no_answer', key: 'N' },
  { r: 'visit_needed', key: 'V' },
  { r: 'guardian_notified', key: 'G' },
  { r: 'other', key: 'O' },
]
const TEMPLATES = [
  { id: 'call-ok-meal', text: '통화 완료, 식사 잘 하심' },
  { id: 'no-answer-retry', text: '부재중, 30분 뒤 재시도' },
  { id: 'med-check', text: '복약 확인 요청함' },
  { id: 'guardian-visit', text: '보호자와 통화, 방문 협의' },
  { id: 'ok-recheck', text: '이상 없음, 다음 주 재확인' },
]
const NEXT: NextAction[] = ['none', 'recall', 'visit', 'guardian']
const RETRY_MIN = 30

const isTyping = (t: EventTarget | null) =>
  t instanceof HTMLElement &&
  (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)

/**
 * 오른쪽: 처리 패널. 결과를 고르고(E·N·V·G·O) 메모·다음 행동·다음 일정을 적은 뒤 저장(Ctrl+Enter)합니다.
 * 이 어르신의 열린 이슈마다 기록이 한 건씩 남고, 이슈가 없으면 상담 기록 한 건이 남습니다.
 */
export function ActionPanel({
  code,
  name,
  issues,
  onSaved,
}: {
  code: string
  name: string
  issues: OpenIssue[]
  onSaved: (saved: SavedAction, overlay: Overlay, label: string) => void
}) {
  const [result, setResult] = useState<ActionResult | null>(null)
  const [note, setNote] = useState('')
  const [templateId, setTemplateId] = useState<string | undefined>()
  const [next, setNext] = useState<NextAction>('none')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setResult(null)
    setNote('')
    setTemplateId(undefined)
    setNext('none')
    setDate('')
    setTime('')
    setError(null)
  }

  const save = async () => {
    if (saving) return
    if (!result) return setError('처리 결과를 골라 주세요.')
    if (result === 'other' && !note.trim()) return setError('"기타"는 메모를 적어야 저장돼요.')
    let followUpAt: string | undefined
    if (date) followUpAt = new Date(`${date}T${time || '09:00'}:00+09:00`).toISOString()
    else if (result === 'call_no_answer') followUpAt = new Date(Date.now() + RETRY_MIN * 60_000).toISOString()
    setSaving(true)
    setError(null)
    try {
      const saved = await saveActions({
        code,
        issues,
        result,
        note: note.trim() || undefined,
        templateId,
        nextAction: next,
        followUpAt,
      })
      onSaved(
        saved,
        {
          at: saved.at,
          result,
          byName: '담당 사회복지사',
          followUpAt,
          closed: issuesClosedBy(result, issues),
        },
        RESULT_LABEL[result],
      )
      reset()
    } catch (e) {
      setError(`저장하지 못했어요. 인터넷 연결을 확인하고 다시 저장해 주세요. (${(e as Error).message})`)
    } finally {
      setSaving(false)
    }
  }

  // 단축키: E·N·V·G·O 결과 고르기, Ctrl(⌘)+Enter 저장
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        void save()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return
      const hit = RESULTS.find((x) => x.key.toLowerCase() === e.key.toLowerCase())
      if (hit) {
        e.preventDefault()
        setResult(hit.r)
        setError(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="flex min-h-0 flex-col text-[13px]">
      <div className={paneHead}>
        처리 · {name}{' '}
        <span className="font-normal text-slate-500">
          {issues.length ? `이슈 ${issues.length}건` : '정기 상담'}
        </span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        <div className="grid gap-1.5" role="radiogroup" aria-label="처리 결과">
          {RESULTS.map(({ r, key }) => (
            <button
              key={r}
              type="button"
              role="radio"
              aria-checked={result === r}
              onClick={() => {
                setResult(r)
                setError(null)
              }}
              className={result === r ? `${btnPrimary} justify-between` : btn}
            >
              {RESULT_LABEL[r]}
              {r === 'other' && ' (메모 필수)'}
              <span className={result === r ? `${kbd} border-blue-300 bg-transparent text-white` : kbd}>
                {key}
              </span>
            </button>
          ))}
        </div>

        <p className="pt-1 font-bold">메모 템플릿</p>
        <div className="flex flex-wrap gap-1">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setNote(t.text)
                setTemplateId(t.id)
              }}
              className="rounded-[3px] border border-slate-300 bg-slate-50 px-1.5 py-0.5 text-[12px] hover:bg-slate-100"
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
          }}
          rows={3}
          placeholder="메모 (선택)"
          className="w-full rounded border border-slate-300 p-2 outline-none focus:border-blue-600"
        />

        <p className="font-bold">다음 행동</p>
        <div className="grid grid-cols-4 gap-1" role="radiogroup" aria-label="다음 행동">
          {NEXT.map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={next === n}
              onClick={() => setNext(n)}
              className={`rounded border px-1 py-1 text-[12px] ${
                next === n
                  ? 'border-blue-600 bg-blue-50 font-bold text-blue-800'
                  : 'border-slate-300 bg-white'
              }`}
            >
              {NEXT_ACTION_LABEL[n]}
            </button>
          ))}
        </div>

        <p className="font-bold">다음 일정</p>
        <div className="flex gap-1">
          <label className="sr-only" htmlFor="worker-follow-date">
            다음 일정 날짜
          </label>
          <input
            id="worker-follow-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="min-w-0 flex-1 rounded border border-slate-300 px-1.5 py-1"
          />
          <label className="sr-only" htmlFor="worker-follow-time">
            다음 일정 시각
          </label>
          <input
            id="worker-follow-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-24 rounded border border-slate-300 px-1.5 py-1"
          />
        </div>
        {result === 'call_no_answer' && !date && (
          <p className="text-[12px] text-slate-500">날짜를 비우면 {RETRY_MIN}분 뒤 재시도로 기록해요.</p>
        )}

        {error && (
          <p role="alert" className="rounded border border-amber-300 bg-amber-50 px-2 py-1.5 text-amber-900">
            {error}
          </p>
        )}

        {/* 휴대폰에서 스크롤해도 '기록 저장'이 항상 보이도록 아래에 붙여 둡니다. */}
        <div className="sticky -bottom-3 -mx-3 bg-white px-3 pt-1 pb-3">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded bg-slate-900 px-3 py-2 font-bold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? '저장 중…' : '기록 저장'}
            <span className={`${kbd} border-slate-400 bg-transparent text-slate-100`}>Ctrl+Enter</span>
          </button>
        </div>
      </div>
      <p className="border-t border-slate-200 px-3 py-1.5 text-[11px] text-slate-500">
        기록은 저장 후 고칠 수 없고, 틀리면 정정 기록을 추가해요. 작성자·시각은 자동으로 들어가요.
      </p>
    </div>
  )
}
