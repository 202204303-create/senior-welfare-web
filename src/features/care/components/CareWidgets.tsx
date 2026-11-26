import { AlarmClock, BellRing, Check, Clock, Cloud, CloudOff, Pill, Share2, Siren, Sun } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getMedStatus, useAlertDispatch, type MedStatus } from '@/features/care/hooks/useCareWatcher'
import type { Medication } from '@/features/care/types'
import { useSyncStatus, type SyncStatus } from '@/features/care/hooks/useCareSync'
import { WAKE_REMIND_BEFORE_MIN } from '@/features/care/hooks/useCareReminder'
import { useShareGuardianLink } from '@/features/care/hooks/useShareGuardianLink'
import { STATUS_STYLE } from '@/features/care/lib/status'
import { useNow } from '@/shared/hooks/useNow'
import { timeToMinutes, todayKey, useCareStore } from '@/features/care/store/useCareStore'
import { BigButton, Modal, StatusNote } from '@/shared/ui'
import { useSampleMode } from '@/features/care/hooks/useSampleMode'
import { hasAssignedWorker } from '@/features/auth/lib/demoAccounts'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

export function WakeUpCard() {
  const now = useNow(30_000)
  const { records, checkWakeUp, wakeUpDeadline, alerts } = useCareStore()
  const overdue = now.getHours() * 60 + now.getMinutes() > timeToMinutes(wakeUpDeadline)
  const alerted = alerts.some((a) => a.key === `${todayKey(now)}-wake`)
  const sync = useSyncStatus((s) => s.status)
  const wakeUpAt = records[todayKey()]?.wakeUpAt

  if (wakeUpAt) {
    return (
      <div className="glass-sky flex items-center gap-4 rounded-3xl p-5">
        <div className="grid size-16 shrink-0 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
          <Check className="size-9" strokeWidth={3} aria-hidden />
        </div>
        <div>
          <p className="text-xl font-extrabold">오늘 안부 확인 완료!</p>
          <p className="text-base text-ink-soft">
            {fmtTime(wakeUpAt)}에 확인했어요.{' '}
            {sync === 'ok'
              ? '보호자 화면에 바로 보여요.'
              : sync === 'error'
                ? '인터넷이 연결되면 보호자께 전달돼요.'
                : sync === 'off'
                  ? '이 기기에 기록했어요.'
                  : '보호자께 전달하는 중이에요.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-brand-300 via-brand-400 to-brand-600 p-6 text-white shadow-glass-lg">
      <Sun className="absolute -right-6 -top-6 size-36 text-white/20" aria-hidden />
      <p className="relative text-lg font-semibold text-white/90">
        {overdue ? '오늘 안부 확인이 아직 없어요' : '좋은 아침이에요!'}
      </p>
      <p className="relative mb-5 text-2xl font-black leading-snug">
        일어나셨으면 아래 버튼을
        <br />
        눌러주세요
      </p>
      <button
        onClick={() => {
          checkWakeUp()
        }}
        className="relative flex min-h-20 w-full items-center justify-center gap-3 rounded-3xl bg-white text-2xl font-black text-brand-700 shadow-lg transition active:scale-[0.98]"
      >
        <Sun className="size-8 text-amber-400" aria-hidden />
        일어났어요
      </button>
      <p className="relative mt-3 flex items-center gap-1.5 text-sm text-white/90">
        <AlarmClock className="size-4" aria-hidden />
        {overdue
          ? `${wakeUpDeadline}이 지나 보호자께 ${alerted ? '알렸어요' : '알림이 가요'}. 지금 누르시면 보호자 화면에 바로 보여요.`
          : `${wakeUpDeadline}까지 누르지 않으시면 보호자께 알림이 가요`}
      </p>
    </div>
  )
}

/** 방금 드신 약을 제자리에 두는 시간 */
const JUST_TAKEN_MS = 4000

const MED_ORDER: Record<MedStatus, number> = { due: 0, upcoming: 1, missed: 2, later: 3, taken: 4 }

/** 현재 시각 기준 약 순서: 지금 드실 약 → 다가오는 약 → 놓친 약 → (내일부터) → 드신 약, 같은 묶음은 시간순 */
export function sortMedsForNow(
  meds: Medication[],
  taken: Record<string, string>,
  now: Date,
  graceMin: number,
): Medication[] {
  return [...meds].sort((a, b) => {
    const sa = MED_ORDER[getMedStatus(a, taken[a.id], now, graceMin)]
    const sb = MED_ORDER[getMedStatus(b, taken[b.id], now, graceMin)]
    return sa - sb || a.time.localeCompare(b.time)
  })
}

export function MedChecklist({ compact = false }: { compact?: boolean }) {
  const now = useNow(30_000)
  const { medications, records, toggleMed, medGraceMinutes } = useCareStore()
  const taken = records[todayKey()]?.takenMeds ?? {}
  // 실수로 눌러 복용 기록이 지워지지 않도록, 취소할 때는 한 번 더 묻습니다.
  const [undoId, setUndoId] = useState<string | null>(null)
  const undoMed = medications.find((m) => m.id === undoId)
  // 첫 설정 전(예시 약)에는 '먹었어요'를 누를 수 없게 합니다. (예시 약에 기록이 남지 않게)
  const sample = useSampleMode()

  // 지금 드실 약·다가오는 약을 위에, 시간이 지난 약(놓친 약 → 드신 약)은 아래로 내립니다. (교수님 피드백)
  // 방금 '먹었어요'를 누른 약은 몇 초 동안 제자리에 두고 '잘 드셨어요'를 보여 준 뒤 아래로 옮깁니다.
  // (누르자마자 카드가 사라지면 어르신이 눌렸는지 헷갈리기 때문)
  const [justTaken, setJustTaken] = useState<string[]>([])
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => clearTimeout(t)), [])
  const markJustTaken = (id: string) => {
    setJustTaken((ids) => [...ids, id])
    timers.current.push(
      window.setTimeout(() => setJustTaken((ids) => ids.filter((x) => x !== id)), JUST_TAKEN_MS),
    )
  }
  const takenForOrder = Object.fromEntries(Object.entries(taken).filter(([id]) => !justTaken.includes(id)))
  const ordered = sortMedsForNow(medications, takenForOrder, now, medGraceMinutes)
  const list = compact ? ordered.filter((m) => !taken[m.id]).slice(0, 2) : ordered

  if (medications.length === 0) {
    return (
      <div className="rounded-2xl bg-brand-50 p-4 text-center">
        <p className="text-lg font-bold">아직 등록한 약이 없어요</p>
        <p className="mt-1 text-base text-ink-soft">드시는 약을 넣어 두면 시간마다 알려 드려요.</p>
        <Link
          to="/care"
          className="mt-3 inline-flex min-h-12 items-center justify-center rounded-xl bg-brand-600 px-5 text-lg font-bold text-white"
        >
          약 넣으러 가기
        </Link>
      </div>
    )
  }

  if (compact && list.length === 0) {
    return (
      <p className="rounded-2xl bg-emerald-50 p-4 text-center text-lg font-bold text-emerald-700">
        오늘 드실 약을 모두 드셨어요 👏
      </p>
    )
  }

  return (
    <>
      {sample && (
        <p className="mb-3 rounded-2xl bg-amber-50 p-3 text-base font-bold text-amber-900 ring-1 ring-amber-200">
          아래는 예시 약이에요. 위에서 이름을 넣으면 내 약을 넣을 수 있어요.
        </p>
      )}
      <ul className="space-y-3">
        {list.map((med) => {
          const status = getMedStatus(med, taken[med.id], now, medGraceMinutes)
          const s = STATUS_STYLE[status]
          const isTaken = status === 'taken'
          return (
            <li key={med.id}>
              <button
                disabled={sample}
                onClick={() => {
                  if (isTaken) return setUndoId(med.id)
                  toggleMed(med.id)
                  markJustTaken(med.id)
                }}
                aria-pressed={isTaken}
                className={`block w-full rounded-2xl p-4 text-left ring-2 transition active:scale-[0.99] ${
                  isTaken
                    ? 'bg-emerald-50/80 ring-emerald-200'
                    : status === 'due'
                      ? 'bg-white ring-brand-400 shadow-glass'
                      : status === 'missed'
                        ? 'bg-rose-50/80 ring-rose-200'
                        : 'bg-white/70 ring-brand-100'
                }`}
              >
                {/* 휴대폰에서도 약 이름·시간이 잘게 쪼개지지 않도록 위아래로 배치합니다. */}
                <span className="flex items-center gap-3">
                  <span
                    className={`grid size-12 shrink-0 place-items-center rounded-2xl border-[3px] transition ${
                      isTaken
                        ? 'border-emerald-500 bg-emerald-500 text-white'
                        : 'border-brand-300 bg-white text-brand-300'
                    }`}
                    aria-hidden
                  >
                    {isTaken ? <Check className="size-7" strokeWidth={3} /> : <Pill className="size-6" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="text-lg font-extrabold whitespace-nowrap">
                        {med.slot} {med.time}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-sm font-bold whitespace-nowrap ${s.cls}`}
                      >
                        {s.label}
                      </span>
                    </span>
                    {(med.memo || isTaken) && (
                      <span className="flex items-center gap-1 text-base text-ink-soft">
                        <Clock className="size-4 shrink-0" aria-hidden />
                        {[med.memo, isTaken && `${fmtTime(taken[med.id])} 복용`].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </span>
                </span>
                <span
                  className={`mt-2 block text-xl font-extrabold leading-snug ${isTaken ? 'text-ink-soft line-through' : 'text-ink'}`}
                >
                  {med.name}
                </span>
                {isTaken && justTaken.includes(med.id) && (
                  <span
                    role="status"
                    className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-lg font-bold text-white"
                  >
                    <Check className="size-5" strokeWidth={3} aria-hidden />잘 드셨어요
                  </span>
                )}
                {/* 누를 수 있다는 것을 알 수 있도록 안 먹은 약에는 큰 '먹었어요' 표시 */}
                {!isTaken && !sample && (
                  <span
                    className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-lg font-bold text-white"
                    aria-hidden
                  >
                    <Check className="size-5" strokeWidth={3} />
                    먹었어요
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
      <Modal open={!!undoMed} onClose={() => setUndoId(null)} title="복용 기록을 취소할까요?">
        <p className="mb-6 text-lg text-ink-soft">
          <b className="text-ink">{undoMed?.name}</b>을(를) 드신 기록을 지워요. 아직 안 드셨을 때만 취소해
          주세요.
        </p>
        <div className="space-y-3">
          <BigButton fullWidth size="lg" onClick={() => setUndoId(null)}>
            아니요, 그대로 둘게요
          </BigButton>
          <BigButton
            fullWidth
            size="lg"
            variant="ghost"
            onClick={() => {
              if (undoMed) {
                toggleMed(undoMed.id)
              }
              setUndoId(null)
            }}
          >
            네, 기록 취소
          </BigButton>
        </div>
      </Modal>
    </>
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

/** 긴급 요청을 받는 사람: 담당 복지사가 있을 때만 '복지사'를 함께 말합니다. */
function useSosReceivers() {
  const familyCode = useCareStore((s) => s.familyCode)
  return hasAssignedWorker(familyCode) ? '보호자와 담당 복지사' : '보호자'
}

export function SOSButton({ className = '' }: { className?: string }) {
  const receivers = useSosReceivers()
  const [open, setOpen] = useState(false)
  // 보낸 뒤에는 창을 바로 닫지 않고 '보냈어요'를 크게 보여 줍니다. (놀란 상황에서도 확실히 알 수 있게)
  const [sent, setSent] = useState(false)
  const { sendSOS } = useAlertDispatch()
  const close = () => {
    setOpen(false)
    setSent(false)
  }
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
      <SosStatus />
      <Modal open={open} onClose={close} title={sent ? '긴급 알림을 보냈어요' : '긴급 도움을 요청할까요?'}>
        {sent ? (
          <>
            <div className="mb-5 flex flex-col items-center gap-3 rounded-3xl bg-emerald-50 p-6 text-center ring-2 ring-emerald-200">
              <span className="grid size-16 place-items-center rounded-full bg-emerald-500 text-white">
                <Check className="size-9" strokeWidth={3} aria-hidden />
              </span>
              <p className="text-xl font-extrabold text-emerald-800">{receivers}에게 알렸어요</p>
              <p className="text-base text-ink-soft">
                보호자가 확인하면 긴급 버튼 아래에 표시돼요. (소리 없이)
              </p>
            </div>
            <div className="space-y-3">
              <a
                href="tel:119"
                className="flex min-h-14 w-full items-center justify-center rounded-2xl border-2 border-rose-300 bg-white text-lg font-bold text-rose-600"
              >
                위급하면 119 전화 걸기
              </a>
              <BigButton fullWidth size="lg" onClick={close}>
                확인
              </BigButton>
            </div>
          </>
        ) : (
          <>
            <p className="mb-6 text-lg text-ink-soft">
              {receivers}에게 지금 바로 알림을 보내요. 위급한 상황이면 119에 먼저 전화해 주세요.
            </p>
            <div className="space-y-3">
              <BigButton
                variant="danger"
                size="xl"
                fullWidth
                icon={<Siren />}
                onClick={() => {
                  sendSOS()
                  setSent(true)
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
              <BigButton variant="ghost" fullWidth onClick={close}>
                취소
              </BigButton>
            </div>
          </>
        )}
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

/** 보호자 연결: 링크 보내기 버튼, 가족 코드, 서버 저장 상태 */
export function FamilyCodeCard() {
  const code = useCareStore((s) => s.familyCode)
  const status = useSyncStatus((s) => s.status)
  const online = status === 'ok' || status === 'syncing'
  const { share, result: shareNote, clearResult } = useShareGuardianLink()

  return (
    <div className="mt-3 rounded-2xl bg-brand-50/90 p-4 ring-1 ring-brand-100">
      <p className="text-base font-bold">보호자 연결</p>
      <p className="mb-3 text-sm text-ink-soft">링크를 보내 드리면 보호자는 누르기만 해도 바로 연결돼요.</p>
      <BigButton fullWidth size="lg" icon={<Share2 />} onClick={share} className="px-3 text-balance">
        보호자에게 링크 보내기
      </BigButton>
      {shareNote && (
        <StatusNote tone={shareNote.tone} className="mt-2" onClose={clearResult}>
          {shareNote.text}
        </StatusNote>
      )}
      <p className="mt-4 text-sm text-ink-soft">또는 보호자 화면에 이 코드를 입력해도 돼요</p>
      <p
        className="font-mono text-3xl font-black tracking-[0.2em] text-brand-800"
        aria-label={`가족 코드 ${code.split('').join(' ')}`}
      >
        {code}
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

/** 보호자가 알림을 확인했는지 보여 주는 한 줄 */
const SOS_SHOW_MS = 3 * 60 * 60 * 1000 // 최근 3시간 안의 긴급 요청만 표시

/**
 * 긴급 요청을 보냈다는 것을 버튼 아래에 남겨 둡니다.
 * 일상 알림(기상·복약)의 확인은 어르신께 알리지 않지만, 긴급 요청만은 '전달됐다'는 것이 가장 중요하므로
 * 보호자가 확인하면 이 자리에 조용히(소리·알림 없이) 표시합니다.
 */
function SosStatus() {
  const receivers = useSosReceivers()
  const now = useNow(30_000)
  const alerts = useCareStore((s) => s.alerts)
  const last = alerts.find((a) => a.kind === 'sos')
  if (!last || now.getTime() - new Date(last.at).getTime() > SOS_SHOW_MS) return null
  return (
    <div
      role="status"
      className={`mt-3 rounded-2xl p-4 ring-2 ${last.ackAt ? 'bg-emerald-50 ring-emerald-200' : 'bg-amber-50 ring-amber-200'}`}
    >
      <p className="text-base font-bold">{fmtTime(last.at)}에 긴급 도움을 요청했어요.</p>
      {last.ackAt ? (
        <p className="mt-1 flex items-center gap-1.5 text-base font-bold text-emerald-700">
          <Check className="size-5" strokeWidth={3} aria-hidden />
          {last.ackBy ?? '보호자'}님이 확인했어요 · {fmtTime(last.ackAt)}
        </p>
      ) : (
        <p className="mt-1 text-sm text-ink-soft">{receivers}에게 알렸어요.</p>
      )}
    </div>
  )
}

interface DoneItem {
  key: string
  text: string
}

/**
 * 어르신 안내 배너. 화면 맨 위에 떠 있고, 처리하거나 닫을 때까지 사라지지 않습니다. (토스트 대신)
 * - 기상 확인 마감 30분 전부터 '일어났어요'를 누르지 않으셨으면: 바로 누를 수 있는 버튼
 * - 약 드실 시각이 지났는데 체크하지 않은 약: '먹었어요' 버튼, 놓친 약은 보호자께 알렸다는 안내
 * - 배너에서 방금 기록한 일: 초록색 완료 줄 (닫기 전까지 남음)
 */
export function CareReminderBanner({
  showWake = true,
  compact = false,
}: {
  showWake?: boolean
  compact?: boolean
}) {
  const now = useNow(30_000)
  const { medications, records, toggleMed, checkWakeUp, wakeUpDeadline, medGraceMinutes, alerts } =
    useCareStore()
  const [later, setLater] = useState<string[]>([])
  const [done, setDone] = useState<DoneItem[]>([])
  const k = todayKey(now)
  const rec = records[k] ?? { takenMeds: {} }
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const alerted = new Set(alerts.map((a) => a.key))
  const deadline = timeToMinutes(wakeUpDeadline)

  const wakeDue = showWake && !rec.wakeUpAt && nowMin >= deadline - WAKE_REMIND_BEFORE_MIN
  const pending = medications.filter(
    (m) =>
      !rec.takenMeds[m.id] &&
      nowMin >= timeToMinutes(m.time) &&
      !later.includes(m.id) &&
      getMedStatus(m, undefined, now, medGraceMinutes) !== 'later',
  )
  // 홈이 아닌 화면(약·알림·내 정보)에서는 큰 상자 대신 한 줄 띠만 보여 줍니다.
  // (큰 글씨에서 상자가 화면을 다 덮어 그 화면의 내용이 안 보이던 문제)
  if (compact) {
    const count = (wakeDue ? 1 : 0) + pending.length
    if (!count) return null
    return (
      <Link
        to="/"
        className="mb-4 flex min-h-12 items-center gap-2 rounded-2xl bg-amber-50 px-4 py-2 text-base font-bold text-amber-900 ring-2 ring-amber-200"
      >
        <BellRing className="size-5 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">오늘 확인할 일 {count}개</span>
        <span className="shrink-0 whitespace-nowrap text-brand-700">홈에서 하기 →</span>
      </Link>
    )
  }
  if (!wakeDue && pending.length === 0 && done.length === 0) return null

  const addDone = (key: string, text: string) =>
    setDone((d) => [...d.filter((x) => x.key !== key), { key, text }])
  const anyMissed =
    (wakeDue && nowMin > deadline) ||
    pending.some((m) => getMedStatus(m, undefined, now, medGraceMinutes) === 'missed')
  const title = anyMissed
    ? '아직 확인하지 않은 일이 있어요'
    : wakeDue
      ? '좋은 아침이에요'
      : pending.length
        ? '약 드실 시간이에요'
        : '기록했어요'

  return (
    <section
      className="mb-5 animate-fade-up rounded-3xl bg-white p-5 shadow-glass-lg ring-2 ring-brand-400"
      aria-label="오늘 할 일 안내"
    >
      <p className="mb-3 flex items-center gap-2 text-xl font-black text-brand-800">
        <BellRing className="size-6" aria-hidden />
        {title}
      </p>
      <ul className="space-y-3">
        {wakeDue && (
          <li className="rounded-2xl bg-amber-50/80 p-4">
            <p className="text-lg font-extrabold">일어나셨으면 눌러 주세요</p>
            <p className="mb-3 text-base text-ink-soft">
              {nowMin > deadline && alerted.has(`${k}-wake`)
                ? `${wakeUpDeadline}이 지나 보호자께 알렸어요. 지금 누르시면 보호자 화면에 바로 보여요.`
                : `${wakeUpDeadline}까지 누르지 않으시면 보호자께 알림이 가요.`}
            </p>
            <BigButton
              size="lg"
              fullWidth
              icon={<Sun />}
              className="whitespace-nowrap"
              onClick={() => {
                checkWakeUp()
                addDone('wake', `안부 확인 완료 · ${fmtTime(new Date().toISOString())}`)
              }}
            >
              일어났어요
            </BigButton>
          </li>
        )}
        {pending.map((m) => {
          const missed = getMedStatus(m, undefined, now, medGraceMinutes) === 'missed'
          return (
            <li key={m.id} className={`rounded-2xl p-4 ${missed ? 'bg-rose-50/80' : 'bg-brand-50/80'}`}>
              <p className="text-lg font-extrabold">{m.name}</p>
              <p className="text-base text-ink-soft">
                {m.slot} {m.time}
                {m.memo ? ` · ${m.memo}` : ''}
              </p>
              {missed && (
                <p className="mt-1 text-sm font-bold text-rose-700">
                  {alerted.has(`${k}-med-${m.id}`)
                    ? '시간이 많이 지나 보호자께 알렸어요. 드셨다면 눌러 주세요.'
                    : '시간이 많이 지났어요. 드셨다면 눌러 주세요.'}
                </p>
              )}
              <div className="mt-3 flex gap-2">
                <BigButton
                  size="lg"
                  icon={<Check />}
                  className="flex-1 whitespace-nowrap"
                  onClick={() => {
                    toggleMed(m.id)
                    addDone(m.id, `${m.name} 복용 기록 완료 · ${fmtTime(new Date().toISOString())}`)
                  }}
                >
                  먹었어요
                </BigButton>
                <BigButton
                  size="md"
                  variant="ghost"
                  className="shrink-0 whitespace-nowrap"
                  onClick={() => setLater((l) => [...l, m.id])}
                >
                  나중에
                </BigButton>
              </div>
            </li>
          )
        })}
        {done.map((d) => (
          <li key={d.key}>
            <StatusNote onClose={() => setDone((list) => list.filter((x) => x.key !== d.key))}>
              {d.text}. 보호자 화면에도 보여요.
            </StatusNote>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * 처음 사용 안내. 홈 맨 위에서 세 가지만 알려 드리고, 한 단계씩 하면 체크 표시가 붙습니다.
 * 세 가지를 다 하거나 '다 알았어요'를 누르면 사라집니다.
 */
export function StartGuide() {
  const now = useNow(30_000)
  const { records, medications, guardianLinkSent, guideDismissed, dismissGuide } = useCareStore()
  const { share, result, clearResult } = useShareGuardianLink()
  if (guideDismissed) return null

  const today = records[todayKey(now)]
  const steps = [
    {
      done: !!today?.wakeUpAt,
      title: "아침에 일어나시면 '일어났어요'를 눌러 주세요",
      desc: '보호자께 안부가 전해져요.',
    },
    {
      done: medications.some((m) => today?.takenMeds[m.id]),
      title: "약을 드신 뒤 '먹었어요'를 눌러 주세요",
      desc: '약 드실 시간이 되면 소리와 알림으로 알려 드려요.',
    },
    { done: guardianLinkSent, title: '보호자에게 링크를 보내 연결해 주세요', desc: '한 번만 하시면 돼요.' },
  ]
  const allDone = steps.every((st) => st.done)

  return (
    <section
      className="rounded-3xl bg-white p-5 shadow-glass-lg ring-2 ring-brand-200"
      aria-label="늘봄 사용 안내"
    >
      <p className="mb-3 text-xl font-black text-brand-800">
        {allDone ? '이제 늘봄을 잘 쓰고 계세요 👏' : '늘봄은 이렇게 쓰세요'}
      </p>
      <ol className="space-y-3">
        {steps.map((st, i) => (
          <li key={st.title} className="flex items-start gap-3">
            <span
              className={`grid size-9 shrink-0 place-items-center rounded-full text-lg font-black ${
                st.done ? 'bg-emerald-500 text-white' : 'bg-brand-100 text-brand-700'
              }`}
              aria-label={st.done ? '완료' : `${i + 1}단계`}
            >
              {st.done ? <Check className="size-5" strokeWidth={3} aria-hidden /> : i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block text-lg font-bold ${st.done ? 'text-ink-soft line-through' : ''}`}>
                {st.title}
              </span>
              <span className="block text-base text-ink-soft">{st.desc}</span>
            </span>
          </li>
        ))}
      </ol>
      {!guardianLinkSent && (
        <BigButton fullWidth size="lg" icon={<Share2 />} className="mt-4" onClick={share}>
          보호자에게 링크 보내기
        </BigButton>
      )}
      {result && (
        <StatusNote tone={result.tone} className="mt-2" onClose={clearResult}>
          {result.text}
        </StatusNote>
      )}
      <button
        type="button"
        onClick={dismissGuide}
        className="mt-3 min-h-12 w-full rounded-xl text-base font-bold text-ink-soft hover:bg-brand-50"
      >
        {allDone ? '안내 닫기' : '다 알았어요, 안내 닫기'}
      </button>
    </section>
  )
}
