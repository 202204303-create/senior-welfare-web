import { CheckCheck, ChevronDown, Home, PhoneMissed, PhoneOutgoing, Send } from 'lucide-react'
import { useState } from 'react'
import { saveActions, type SavedAction } from '@/features/worker/api/actions'
import { NEXT_ACTION_LABEL, type NextAction } from '@/features/worker/lib/chart'
import { RESULT_LABEL, issuesClosedBy } from '@/features/worker/lib/queue'
import type { ActionResult, OpenIssue, Overlay } from '@/features/worker/types'

const RETRY_MIN = 30
const MAIN: { r: ActionResult; label: string; sub: string; Icon: typeof Home; cls: string }[] = [
  {
    r: 'call_ok',
    label: '통화했어요 · 괜찮아요',
    sub: '확인할 일이 모두 끝나요',
    Icon: PhoneOutgoing,
    cls: 'bg-emerald-600 text-white hover:bg-emerald-700',
  },
  {
    r: 'checked',
    label: '확인했어요',
    sub: '전화 없이 확인만 (보호자가 이미 연락했을 때 등)',
    Icon: CheckCheck,
    cls: 'bg-blue-700 text-white hover:bg-blue-800',
  },
  {
    r: 'call_no_answer',
    label: '전화를 안 받으세요',
    sub: `${RETRY_MIN}분 뒤 다시 하도록 남겨요`,
    Icon: PhoneMissed,
    cls: 'bg-white text-slate-900 ring-2 ring-slate-300 hover:bg-slate-50',
  },
  {
    r: 'visit_needed',
    label: '방문이 필요해요',
    sub: '방문할 일로 남겨요',
    Icon: Home,
    cls: 'bg-white text-slate-900 ring-2 ring-slate-300 hover:bg-slate-50',
  },
]
const NEXT: NextAction[] = ['none', 'recall', 'visit', 'guardian']

/**
 * 쉬운 처리 버튼: 큰 버튼 하나만 누르면 바로 기록됩니다.
 * 메모·보호자 전달·다음 일정은 '메모·다른 처리' 안에 접어 둡니다. (저장하면 되돌리기 5초)
 */
export function QuickActions({
  code,
  issues,
  onSaved,
}: {
  code: string
  issues: OpenIssue[]
  onSaved: (saved: SavedAction, overlay: Overlay, label: string) => void
}) {
  const [note, setNote] = useState('')
  const [more, setMore] = useState(false)
  const [next, setNext] = useState<NextAction>('none')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [saving, setSaving] = useState<ActionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const save = async (result: ActionResult) => {
    if (saving) return
    if (result === 'other' && !note.trim()) return setError('메모를 적어 주세요.')
    let followUpAt: string | undefined
    if (date) followUpAt = new Date(`${date}T${time || '09:00'}:00+09:00`).toISOString()
    else if (result === 'call_no_answer') followUpAt = new Date(Date.now() + RETRY_MIN * 60_000).toISOString()
    setSaving(result)
    setError(null)
    try {
      const saved = await saveActions({
        code,
        issues,
        result,
        note: note.trim() || undefined,
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
      setNote('')
      setNext('none')
      setDate('')
      setTime('')
      setMore(false)
    } catch (e) {
      setError(`저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. (${(e as Error).message})`)
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="space-y-2">
      {MAIN.filter((m) => m.r !== 'checked' || issues.length > 0).map(({ r, label, sub, Icon, cls }) => (
        <button
          key={r}
          type="button"
          onClick={() => void save(r)}
          disabled={saving !== null}
          className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition disabled:opacity-60 ${cls}`}
        >
          <Icon className="size-6 shrink-0" aria-hidden />
          <span className="min-w-0">
            <span className="block text-[16px] font-bold">{saving === r ? '저장 중…' : label}</span>
            <span className="block text-[13px] opacity-80">{sub}</span>
          </span>
        </button>
      ))}

      <button
        type="button"
        onClick={() => setMore((v) => !v)}
        aria-expanded={more}
        className="flex w-full items-center justify-between rounded-xl px-2 py-2 text-[14px] font-bold text-slate-600 hover:bg-slate-100"
      >
        메모 · 다른 처리
        <ChevronDown className={`size-5 transition ${more ? 'rotate-180' : ''}`} aria-hidden />
      </button>

      {more && (
        <div className="space-y-3 rounded-xl bg-slate-50 p-3 text-[14px] ring-1 ring-slate-200">
          <label className="block">
            <span className="mb-1 block font-bold">메모 (선택)</span>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="예: 식사 잘 하심, 다음 주 재확인"
              className="w-full rounded-lg border border-slate-300 bg-white p-2 outline-none focus:border-blue-600"
            />
          </label>
          <p className="text-[13px] text-slate-500">메모를 적고 위의 큰 버튼을 누르면 메모도 함께 남아요.</p>

          <div>
            <span className="mb-1 block font-bold">다음에 할 일</span>
            <div className="grid grid-cols-2 gap-1.5">
              {NEXT.map((n) => (
                <button
                  key={n}
                  type="button"
                  aria-pressed={next === n}
                  onClick={() => setNext(n)}
                  className={`rounded-lg px-2 py-2 ${next === n ? 'bg-blue-700 font-bold text-white' : 'bg-white ring-1 ring-slate-300'}`}
                >
                  {NEXT_ACTION_LABEL[n]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className="mb-1 block font-bold">다음 일정 (선택)</span>
            <div className="flex gap-1.5">
              <input
                type="date"
                aria-label="다음 일정 날짜"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
              />
              <input
                type="time"
                aria-label="다음 일정 시각"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-28 rounded-lg border border-slate-300 bg-white px-2 py-1.5"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => void save('guardian_notified')}
              disabled={saving !== null}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-white px-2 py-2 font-bold ring-1 ring-slate-300 disabled:opacity-60"
            >
              <Send className="size-4" aria-hidden /> 보호자에게 전달
            </button>
            <button
              type="button"
              onClick={() => void save('other')}
              disabled={saving !== null}
              className="rounded-lg bg-white px-2 py-2 font-bold ring-1 ring-slate-300 disabled:opacity-60"
            >
              메모만 남기기
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[14px] text-amber-900"
        >
          {error}
        </p>
      )}
      <p className="text-[12px] text-slate-500">
        기록은 고칠 수 없어요. 잘못 눌렀으면 바로 '되돌리기'를 눌러 주세요.
      </p>
    </div>
  )
}
