import { AlarmClock, Check, Clock, Pill, Siren, Sun } from 'lucide-react'
import { useState } from 'react'
import { getMedStatus, useAlertDispatch, type MedStatus } from '@/features/care/hooks/useCareWatcher'
import { useNow } from '@/shared/hooks/useNow'
import { todayKey, useCareStore } from '@/features/care/store/useCareStore'
import { useSettingsStore } from '@/shared/store/useSettingsStore'
import { BigButton, Modal } from '@/shared/ui'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

export function WakeUpCard() {
  const { records, checkWakeUp, wakeUpDeadline } = useCareStore()
  const showToast = useSettingsStore((s) => s.showToast)
  const wakeUpAt = records[todayKey()]?.wakeUpAt

  if (wakeUpAt) {
    return (
      <div className="glass-sky flex items-center gap-4 rounded-3xl p-5">
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
          <Check className="size-9" strokeWidth={3} aria-hidden />
        </div>
        <div>
          <p className="text-xl font-extrabold">오늘 안부 확인 완료!</p>
          <p className="text-base text-ink-soft">{fmtTime(wakeUpAt)}에 확인했어요. 보호자께 전달됐어요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-300 via-brand-400 to-brand-600 p-6 text-white shadow-glass-lg">
      <Sun className="absolute -right-6 -top-6 size-36 text-white/20" aria-hidden />
      <p className="relative text-lg font-semibold text-white/90">좋은 아침이에요!</p>
      <p className="relative mb-5 text-2xl font-black leading-snug">
        일어나셨으면 아래 버튼을
        <br />
        눌러주세요
      </p>
      <button
        onClick={() => {
          checkWakeUp()
          showToast('안부 확인 완료! 오늘도 건강한 하루 보내세요.', 'success')
        }}
        className="relative flex min-h-20 w-full items-center justify-center gap-3 rounded-3xl bg-white text-2xl font-black text-brand-700 shadow-lg transition active:scale-[0.98]"
      >
        <Sun className="size-8 text-amber-400" aria-hidden />
        일어났어요
      </button>
      <p className="relative mt-3 flex items-center gap-1.5 text-sm text-white/90">
        <AlarmClock className="size-4" aria-hidden />
        {wakeUpDeadline}까지 누르지 않으시면 보호자께 알림이 가요
      </p>
    </div>
  )
}

const STATUS_STYLE: Record<MedStatus, { label: string; cls: string }> = {
  taken: { label: '복용 완료', cls: 'bg-emerald-100 text-emerald-700' },
  due: { label: '드실 시간', cls: 'bg-brand-600 text-white' },
  upcoming: { label: '예정', cls: 'bg-slate-100 text-slate-600' },
  missed: { label: '놓침', cls: 'bg-rose-100 text-rose-700' },
}

export function MedChecklist({ compact = false }: { compact?: boolean }) {
  const now = useNow(30_000)
  const { medications, records, toggleMed, medGraceMinutes } = useCareStore()
  const showToast = useSettingsStore((s) => s.showToast)
  const taken = records[todayKey()]?.takenMeds ?? {}

  const list = compact ? medications.filter((m) => !taken[m.id]).slice(0, 2) : medications

  if (compact && list.length === 0) {
    return (
      <p className="rounded-2xl bg-emerald-50 p-4 text-center text-lg font-bold text-emerald-700">
        오늘 드실 약을 모두 드셨어요 👏
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {list.map((med) => {
        const status = getMedStatus(med, taken[med.id], now, medGraceMinutes)
        const s = STATUS_STYLE[status]
        const isTaken = status === 'taken'
        return (
          <li key={med.id}>
            <button
              onClick={() => {
                toggleMed(med.id)
                if (!isTaken) showToast(`${med.name} 복용을 기록했어요.`, 'success')
              }}
              aria-pressed={isTaken}
              className={`flex w-full items-center gap-4 rounded-2xl p-4 text-left ring-2 transition active:scale-[0.99] ${
                isTaken
                  ? 'bg-emerald-50/80 ring-emerald-200'
                  : status === 'due'
                    ? 'bg-white ring-brand-400 shadow-glass'
                    : status === 'missed'
                      ? 'bg-rose-50/80 ring-rose-200'
                      : 'bg-white/70 ring-brand-100'
              }`}
            >
              <span
                className={`grid size-14 shrink-0 place-items-center rounded-2xl border-[3px] transition ${
                  isTaken
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-brand-300 bg-white text-brand-300'
                }`}
                aria-hidden
              >
                {isTaken ? <Check className="size-8" strokeWidth={3} /> : <Pill className="size-7" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-extrabold">{med.slot}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${s.cls}`}>{s.label}</span>
                </span>
                <span className={`block text-lg ${isTaken ? 'text-ink-soft line-through' : 'text-ink'}`}>
                  {med.name}
                </span>
                <span className="flex items-center gap-1 text-sm text-ink-soft">
                  <Clock className="size-4" aria-hidden />
                  {med.time}
                  {med.memo && ` · ${med.memo}`}
                  {isTaken && ` · ${fmtTime(taken[med.id])} 복용`}
                </span>
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function MedProgress() {
  const { medications, records } = useCareStore()
  const taken = records[todayKey()]?.takenMeds ?? {}
  const done = medications.filter((m) => taken[m.id]).length
  const total = medications.length
  const pct = total ? Math.round((done / total) * 100) : 0
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-base font-bold text-ink-soft">오늘 복약</span>
        <span className="text-lg font-black text-brand-700">
          {done} / {total}
        </span>
      </div>
      <div
        className="h-4 overflow-hidden rounded-full bg-brand-100"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="오늘 복약 진행률"
      >
        <div
          className="h-full rounded-full bg-linear-to-r from-brand-300 to-brand-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function SOSButton({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const { sendSOS } = useAlertDispatch()
  return (
    <>
      <BigButton
        variant="danger"
        size="xl"
        fullWidth
        icon={<Siren />}
        onClick={() => setOpen(true)}
        className={className}
      >
        긴급 도움 요청
      </BigButton>
      <Modal open={open} onClose={() => setOpen(false)} title="긴급 도움을 요청할까요?">
        <p className="mb-6 text-lg text-ink-soft">
          보호자와 담당 사회복지사에게 지금 바로 알림을 보내요. 위급한 상황이면 119에 먼저 전화해 주세요.
        </p>
        <div className="space-y-3">
          <BigButton
            variant="danger"
            size="xl"
            fullWidth
            icon={<Siren />}
            onClick={() => {
              sendSOS()
              setOpen(false)
            }}
          >
            네, 알림 보내기
          </BigButton>
          <a
            href="tel:119"
            className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-rose-300 bg-white text-lg font-bold text-rose-600"
          >
            119 전화 걸기
          </a>
          <BigButton variant="ghost" fullWidth onClick={() => setOpen(false)}>
            취소
          </BigButton>
        </div>
      </Modal>
    </>
  )
}
