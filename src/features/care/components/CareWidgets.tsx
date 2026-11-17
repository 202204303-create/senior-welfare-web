import { AlarmClock, Check, Clock, Cloud, CloudOff, Pill, Siren, Sun } from 'lucide-react'
import { useState } from 'react'
import { getMedStatus, useAlertDispatch } from '@/features/care/hooks/useCareWatcher'
import { useSyncStatus, type SyncStatus } from '@/features/care/hooks/useCareSync'
import { STATUS_STYLE } from '@/features/care/lib/status'
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

const SYNC_TEXT: Record<SyncStatus, string> = {
  off: '서버 미연결 · 이 기기에만 저장돼요',
  syncing: '서버에 저장하는 중…',
  ok: '서버에 저장됨 · 보호자 화면에 바로 보여요',
  error: '서버 저장 실패 · 인터넷 연결을 확인해 주세요',
}

/** 보호자가 /guardian 에서 입력할 가족 코드와 서버 저장 상태 */
export function FamilyCodeCard() {
  const code = useCareStore((s) => s.familyCode)
  const status = useSyncStatus((s) => s.status)
  const online = status === 'ok' || status === 'syncing'
  return (
    <div className="mt-3 rounded-2xl bg-brand-50/90 p-4 ring-1 ring-brand-100">
      <p className="text-base font-bold">보호자 연결 코드</p>
      <p
        className="mt-1 font-mono text-3xl font-black tracking-[0.2em] text-brand-800"
        aria-label={`가족 코드 ${code.split('').join(' ')}`}
      >
        {code}
      </p>
      <p className="mt-1 text-sm text-ink-soft">
        보호자는 늘봄 주소 뒤에 <b>/guardian</b> 을 붙여 들어가 이 코드를 입력하면 돼요.
      </p>
      <p
        className={`mt-2 flex items-center gap-1.5 text-sm font-bold ${
          status === 'error' ? 'text-rose-600' : online ? 'text-emerald-700' : 'text-ink-soft'
        }`}
        role="status"
      >
        {online ? <Cloud className="size-4" aria-hidden /> : <CloudOff className="size-4" aria-hidden />}
        {SYNC_TEXT[status]}
      </p>
    </div>
  )
}
