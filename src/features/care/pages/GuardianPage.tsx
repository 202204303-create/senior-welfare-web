import {
  AlarmClock,
  BellRing,
  Check,
  KeyRound,
  Phone,
  Pill,
  ServerOff,
  Sun,
  UserRoundSearch,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Logo } from '@/shared/layout/AppLayout'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import { useNow } from '@/shared/hooks/useNow'
import { useSettingsStore } from '@/shared/store/useSettingsStore'
import { BigButton, EmptyState, ErrorState, InfoCard, LoadingList, TextField, Toast } from '@/shared/ui'
import { watchAlerts, watchDay, watchFamily, type FamilyInfo } from '@/features/care/api/family'
import { STATUS_STYLE } from '@/features/care/lib/status'
import { CHANNEL_LABEL, getMedStatus, requestPushPermission } from '@/features/care/hooks/useCareWatcher'
import { todayKey, type AlertLog, type DayRecord } from '@/features/care/store/useCareStore'

const CODE_KEY = 'neulbom-guardian-code'

const readSavedCode = () => {
  try {
    return localStorage.getItem(CODE_KEY) ?? ''
  } catch {
    return ''
  }
}
const saveCode = (code: string) => {
  try {
    if (code) localStorage.setItem(CODE_KEY, code)
    else localStorage.removeItem(CODE_KEY)
  } catch {
    /* 저장이 막힌 브라우저에서는 매번 입력 */
  }
}

/** 새 알림을 토스트와 브라우저 알림(권한이 있을 때)으로 알려 줍니다. */
function notify(reason: string) {
  useSettingsStore.getState().showToast(reason, 'warn')
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      new Notification('늘봄 안부 알림', { body: reason, icon: '/favicon.svg', tag: reason })
    } catch {
      /* 일부 모바일 브라우저는 서비스워커 없이 알림 생성 불가 */
    }
  }
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** 보호자 화면: 가족 코드로 어르신의 오늘 기상·복약 상태와 알림을 실시간으로 봅니다. */
export function GuardianPage() {
  const [params] = useSearchParams()
  const [code, setCode] = useState(() => (params.get('code') ?? readSavedCode()).toUpperCase())

  const connect = (c: string) => {
    saveCode(c)
    setCode(c)
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <span className="rounded-full bg-violet-100 px-3 py-1 text-sm font-bold text-violet-700">
            보호자 화면
          </span>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-6">
        {!isFirebaseEnabled ? (
          <EmptyState
            icon={<ServerOff />}
            title="서버 연결이 설정되지 않았어요"
            desc="보호자 화면은 Firebase 설정(.env 의 VITE_FIREBASE_* 값)이 있어야 동작해요."
          />
        ) : code ? (
          <GuardianDashboard code={code} onChangeCode={() => connect('')} />
        ) : (
          <CodeForm onSubmit={connect} />
        )}
      </main>
      <Toast />
    </div>
  )
}

function CodeForm({ onSubmit }: { onSubmit: (code: string) => void }) {
  const [value, setValue] = useState('')
  const clean = value
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6)
  return (
    <InfoCard
      title="가족 코드를 입력해 주세요"
      icon={<KeyRound />}
      subtitle="어르신 휴대폰의 '안부·복약' 화면에 있는 6자리 코드예요."
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (clean.length === 6) onSubmit(clean)
        }}
      >
        <TextField
          label="가족 코드"
          value={clean}
          onChange={(e) => setValue(e.target.value)}
          placeholder="예: K7MP3Q"
          autoCapitalize="characters"
          autoComplete="off"
          className="[&_input]:font-mono [&_input]:text-2xl [&_input]:tracking-[0.3em]"
        />
        <BigButton type="submit" fullWidth size="lg" disabled={clean.length !== 6}>
          연결하기
        </BigButton>
      </form>
    </InfoCard>
  )
}

function GuardianDashboard({ code, onChangeCode }: { code: string; onChangeCode: () => void }) {
  const now = useNow(30_000)
  const dateKey = todayKey(now)
  const showToast = useSettingsStore((s) => s.showToast)
  const [family, setFamily] = useState<FamilyInfo | null | undefined>(undefined)
  const [day, setDay] = useState<DayRecord>({ takenMeds: {} })
  const [alerts, setAlerts] = useState<AlertLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    const onError = (e: Error) => setError(e.message)
    const offs = [
      watchFamily(code, setFamily, onError),
      watchDay(code, dateKey, setDay, onError),
      watchAlerts(
        code,
        (list) => {
          // 화면을 연 뒤 새로 생긴 알림은 소리 알림(웹 푸시)과 토스트로 알려 줍니다.
          if (seen.current) {
            for (const a of list) {
              if (!seen.current.has(a.id)) notify(a.reason)
            }
          }
          seen.current = new Set(list.map((a) => a.id))
          setAlerts(list)
        },
        onError,
      ),
    ]
    return () => offs.forEach((off) => off())
  }, [code, dateKey, retry])

  const enablePush = async () => {
    const res = await requestPushPermission()
    if (res === 'granted')
      showToast('이 기기에서 알림을 받아요. 화면을 켜 두시면 바로 알려 드려요.', 'success')
    else if (res === 'unsupported') showToast('이 브라우저는 알림을 지원하지 않아요.', 'warn')
    else showToast('알림 권한이 거부되었어요. 브라우저 설정에서 허용해 주세요.', 'warn')
  }

  if (error)
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setError(null)
          setRetry((n) => n + 1)
        }}
      />
    )
  if (family === undefined) return <LoadingList count={3} />
  if (family === null)
    return (
      <EmptyState
        icon={<UserRoundSearch />}
        title={`'${code}' 코드를 찾을 수 없어요`}
        desc="코드를 다시 확인하거나, 어르신 휴대폰에서 늘봄을 한 번 열어 주세요."
        action={
          <BigButton variant="soft" onClick={onChangeCode}>
            코드 다시 입력
          </BigButton>
        }
      />
    )

  const nowMin = now.getHours() * 60 + now.getMinutes()
  const [dh, dm] = family.wakeUpDeadline.split(':').map(Number)
  const wakeOverdue = !day.wakeUpAt && nowMin > dh * 60 + dm
  const takenCount = family.medications.filter((m) => day.takenMeds[m.id]).length
  const total = family.medications.length

  return (
    <div className="animate-fade-up space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-base font-bold text-brand-600">
            {now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
          <h1 className="text-3xl font-black">{family.elderName} 님의 오늘</h1>
        </div>
        <a
          href={`tel:${family.elderPhone}`}
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 px-5 text-base font-bold text-white shadow-glass"
        >
          <Phone className="size-5" aria-hidden /> 어르신께 전화
        </a>
      </div>

      {/* 기상 확인 */}
      <section
        className={`flex items-center gap-4 rounded-3xl p-5 ring-2 ${
          day.wakeUpAt
            ? 'bg-emerald-50 ring-emerald-200'
            : wakeOverdue
              ? 'bg-rose-50 ring-rose-200'
              : 'bg-white/80 ring-brand-100'
        }`}
        aria-label="기상 확인"
      >
        <div
          className={`grid size-14 shrink-0 place-items-center rounded-full text-white ${
            day.wakeUpAt ? 'bg-emerald-500' : wakeOverdue ? 'bg-rose-500' : 'bg-amber-400'
          }`}
        >
          {day.wakeUpAt ? (
            <Check className="size-8" strokeWidth={3} aria-hidden />
          ) : (
            <Sun className="size-8" aria-hidden />
          )}
        </div>
        <div>
          <p className="text-xl font-extrabold">
            {day.wakeUpAt
              ? '오늘 기상 확인 완료'
              : wakeOverdue
                ? '기상 확인이 아직 없어요'
                : '기상 확인 기다리는 중'}
          </p>
          <p className="flex items-center gap-1.5 text-base text-ink-soft">
            <AlarmClock className="size-4" aria-hidden />
            {day.wakeUpAt
              ? `${fmtTime(day.wakeUpAt)}에 '일어났어요'를 누르셨어요`
              : `확인 마감 ${family.wakeUpDeadline}`}
          </p>
        </div>
      </section>

      {/* 복약 */}
      <InfoCard title="오늘 복약" icon={<Pill />} subtitle={`${takenCount} / ${total} 복용`}>
        <div
          className="mb-4 h-3 overflow-hidden rounded-full bg-brand-100"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={takenCount}
          aria-label="오늘 복약 진행률"
        >
          <div
            className="h-full rounded-full bg-linear-to-r from-brand-400 to-brand-600 transition-all"
            style={{ width: `${total ? (takenCount / total) * 100 : 0}%` }}
          />
        </div>
        <ul className="space-y-2">
          {family.medications.map((m) => {
            const takenAt = day.takenMeds[m.id]
            const status = getMedStatus(m, takenAt, now, family.medGraceMinutes)
            const s = STATUS_STYLE[status]
            return (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-extrabold">{m.slot}</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${s.cls}`}>{s.label}</span>
                  </span>
                  <span className="block text-base">{m.name}</span>
                  <span className="text-sm text-ink-soft">
                    {m.time}
                    {takenAt ? ` · ${fmtTime(takenAt)} 복용` : ''}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </InfoCard>

      {/* 알림 */}
      <InfoCard
        title="받은 알림"
        icon={<BellRing />}
        action={
          <BigButton size="md" variant="soft" onClick={enablePush}>
            알림 켜기
          </BigButton>
        }
      >
        {alerts.length === 0 ? (
          <p className="rounded-2xl bg-white/70 p-4 text-center text-base text-ink-soft">
            아직 받은 알림이 없어요.
          </p>
        ) : (
          <ul className="max-h-96 space-y-2 overflow-y-auto">
            {alerts.map((a) => (
              <li key={a.id} className="rounded-2xl bg-amber-50/90 p-4 ring-1 ring-amber-100">
                <p className="text-base font-semibold">{a.reason}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  {new Date(a.at).toLocaleString('ko-KR', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {a.channels.map((c) => CHANNEL_LABEL[c]).join(', ') || '채널 없음'}
                </p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-ink-soft">이 화면을 켜 두시면 새 알림이 오는 즉시 알려 드려요.</p>
      </InfoCard>

      <p className="text-center text-sm text-ink-soft">
        가족 코드 <b className="font-mono">{code}</b> ·{' '}
        <button className="min-h-11 font-bold text-brand-700 underline" onClick={onChangeCode}>
          다른 코드 입력
        </button>
      </p>
    </div>
  )
}
