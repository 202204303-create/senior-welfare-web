import {
  AlarmClock,
  BellRing,
  CalendarDays,
  Check,
  CheckCheck,
  KeyRound,
  Phone,
  Pill,
  ServerOff,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Smartphone,
  Sun,
  UserRoundSearch,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Logo } from '@/shared/layout/AppLayout'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import { useNow } from '@/shared/hooks/useNow'
import { useGuardianNoticeStore, type NoticeTone } from '@/shared/store/useNoticeStore'
import { showSystemNotification } from '@/shared/lib/notify'
import {
  BigButton,
  EmptyState,
  ErrorState,
  InfoCard,
  LoadingList,
  NoticeStack,
  StatusNote,
  TextField,
} from '@/shared/ui'
import { PushPermission } from '@/features/care/components/PushPermission'
import { ackAlert, watchAlerts, watchDays, watchFamily, type FamilyInfo } from '@/features/care/api/family'
import { findCareIssues, fromNow, type CareIssue } from '@/features/care/lib/guardianIssues'
import { STATUS_STYLE } from '@/features/care/lib/status'
import { CHANNEL_LABEL, READY_CHANNELS, getMedStatus } from '@/features/care/hooks/useCareWatcher'
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

/**
 * 새 알림을 '지워지지 않는 화면 알림'과 휴대폰 알림(권한이 있을 때)으로 알려 줍니다.
 * 화면 알림은 보호자가 '확인했어요'를 누를 때까지 남습니다.
 */
function notify(message: string, tone: NoticeTone, key: string) {
  useGuardianNoticeStore.getState().addNotice({ message, tone, key })
  showSystemNotification('늘봄 안부 알림', message)
}

/** 보호자 화면이 직접 알린 경고 키 (새로고침해도 같은 경고를 반복하지 않도록 저장) */
const notifiedKey = (code: string) => `neulbom-guardian-notified-${code}`
const readNotified = (code: string): string[] => {
  try {
    return JSON.parse(localStorage.getItem(notifiedKey(code)) ?? '[]')
  } catch {
    return []
  }
}
const saveNotified = (code: string, keys: string[]) => {
  try {
    localStorage.setItem(notifiedKey(code), JSON.stringify(keys.slice(-100)))
  } catch {
    /* 저장이 막힌 브라우저 */
  }
}

const HISTORY_DAYS = 7
/** 보호자 화면이 직접 경고하기 전에 어르신 기기의 알림이 도착하기를 기다리는 시간 */
const GUARDIAN_NOTIFY_DELAY_MS = 5000

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** 보호자 화면: 가족 코드로 어르신의 오늘 기상·복약 상태와 알림을 실시간으로 봅니다. */
export function GuardianPage() {
  const [params] = useSearchParams()
  // 어르신이 보낸 링크(/guardian?code=XXXXXX)로 들어오면 코드를 바로 저장해, 다음부터는 링크 없이 열려요.
  const [code, setCode] = useState(() => {
    const fromLink = (params.get('code') ?? '').toUpperCase()
    if (fromLink) saveCode(fromLink)
    return fromLink || readSavedCode().toUpperCase()
  })

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
      <p className="mb-4 rounded-2xl bg-brand-50 p-4 text-base">
        <b>어르신께 받은 링크</b>를 누르셨다면 코드 없이 바로 연결돼요. 링크가 없으면 어르신 휴대폰의 늘봄 →
        안부·복약 → <b>보호자에게 링크 보내기</b>를 눌러 달라고 해 주세요.
      </p>
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
  const sinceKey = todayKey(new Date(now.getTime() - (HISTORY_DAYS - 1) * 86_400_000))
  const [ackError, setAckError] = useState<{ id: string; message: string } | null>(null)
  const noticeCount = useGuardianNoticeStore((s) => s.notices.length)
  const [family, setFamily] = useState<FamilyInfo | null | undefined>(undefined)
  const [days, setDays] = useState<Record<string, DayRecord>>({})
  const [alerts, setAlerts] = useState<AlertLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [acking, setAcking] = useState<string | null>(null)
  const seen = useRef<Set<string> | null>(null)

  useEffect(() => {
    const onError = (e: Error) => setError(e.message)
    const offs = [
      watchFamily(code, setFamily, onError),
      watchDays(code, sinceKey, setDays, onError),
      watchAlerts(
        code,
        (list) => {
          // 화면을 연 뒤 어르신 기기에서 새로 보낸 알림은 바로 알려 줍니다.
          if (seen.current) {
            for (const a of list) {
              if (!seen.current.has(a.id))
                notify(a.reason, a.kind === 'sos' ? 'danger' : 'warn', `alert-${a.id}`)
            }
          }
          seen.current = new Set(list.map((a) => a.id))
          setAlerts(list)
        },
        onError,
      ),
    ]
    return () => offs.forEach((off) => off())
  }, [code, sinceKey, retry])

  const today = useMemo<DayRecord>(() => days[dateKey] ?? { takenMeds: {} }, [days, dateKey])
  const issues: CareIssue[] = useMemo(
    () => (family ? findCareIssues(family, today, alerts, now, dateKey) : []),
    [family, today, alerts, now, dateKey],
  )

  // 어르신 앱이 꺼져 있어 어르신 기기에서 알림이 오지 않은 경우, 보호자 화면이 직접 알립니다.
  // 화면을 연 직후에는 알림 목록이 잠깐 비어 있다가 도착하므로(Firestore 캐시 → 서버),
  // 몇 초 기다린 뒤 최신 알림 목록으로 다시 확인하고 알립니다.
  const alertsRef = useRef(alerts)
  useEffect(() => {
    alertsRef.current = alerts
  }, [alerts])
  useEffect(() => {
    if (!family || !seen.current || issues.length === 0) return
    const timer = setTimeout(() => {
      const done = readNotified(code)
      const reported = new Set(alertsRef.current.map((a) => a.key))
      const fresh = issues.filter((i) => !done.includes(i.key) && !reported.has(i.key))
      if (!fresh.length) return
      fresh.forEach((i) => notify(i.text, i.level === 'danger' ? 'danger' : 'warn', `issue-${i.key}`))
      saveNotified(code, [...done, ...fresh.map((i) => i.key)])
    }, GUARDIAN_NOTIFY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [issues, family, code])

  const ack = async (a: AlertLog) => {
    if (!family) return
    setAcking(a.id)
    setAckError(null)
    try {
      await ackAlert(code, a.id, family.guardianName)
      // 이 알림에 대한 화면 알림도 함께 확인 처리합니다.
      const { notices, dismissNotice } = useGuardianNoticeStore.getState()
      notices.filter((n) => n.key === `alert-${a.id}`).forEach((n) => dismissNotice(n.id))
    } catch (e) {
      setAckError({ id: a.id, message: (e as Error).message })
    } finally {
      setAcking(null)
    }
  }

  // 확인하지 않은 알림 개수를 브라우저 탭 제목에 보여 줍니다. 예: (2) 늘봄 보호자
  useEffect(() => {
    const base = '늘봄 보호자 화면'
    document.title = noticeCount ? `(${noticeCount}) ${base}` : base
  }, [noticeCount])

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
  const wakeOverdue = !today.wakeUpAt && nowMin > dh * 60 + dm
  const takenCount = family.medications.filter((m) => today.takenMeds[m.id]).length
  const total = family.medications.length
  const historyKeys = Array.from({ length: HISTORY_DAYS }, (_, i) =>
    todayKey(new Date(now.getTime() - i * 86_400_000)),
  )

  return (
    <div className="animate-fade-up space-y-5">
      <NoticeStack useStore={useGuardianNoticeStore} dismissLabel="알림 닫기" dismissAllLabel="모두 닫기" />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-base font-bold text-brand-600">
            {now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })}
          </p>
          <h1 className="text-3xl font-black">{family.elderName} 님의 오늘</h1>
          <p className="mt-1 flex items-center gap-1.5 text-base text-ink-soft">
            <Smartphone className="size-4" aria-hidden />
            어르신 앱 마지막 사용:{' '}
            <b className="text-ink">{family.lastSeenAt ? fromNow(family.lastSeenAt, now) : '기록 없음'}</b>
          </p>
        </div>
        <a
          href={`tel:${family.elderPhone}`}
          className="flex min-h-12 items-center gap-2 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 px-5 text-base font-bold text-white shadow-glass"
        >
          <Phone className="size-5" aria-hidden /> 어르신께 전화
        </a>
      </div>

      {/* 지금 상태 요약 */}
      {issues.length === 0 ? (
        <section
          className="flex items-center gap-3 rounded-3xl bg-emerald-50 p-5 ring-2 ring-emerald-200"
          aria-label="지금 상태"
        >
          <ShieldCheck className="size-8 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-lg font-extrabold text-emerald-800">지금은 확인이 필요한 일이 없어요.</p>
        </section>
      ) : (
        <section className="rounded-3xl bg-rose-50 p-5 ring-2 ring-rose-200" aria-label="확인이 필요해요">
          <p className="mb-2 flex items-center gap-2 text-xl font-black text-rose-700">
            <ShieldAlert className="size-7" aria-hidden /> 확인이 필요해요
          </p>
          <ul className="space-y-1.5">
            {issues.map((i) => (
              <li key={i.key} className="flex gap-2 text-base font-semibold">
                <span
                  className={`mt-0.5 shrink-0 self-start whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold ${
                    i.level === 'danger' ? 'bg-rose-600 text-white' : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {i.level === 'danger' ? '긴급' : '주의'}
                </span>
                {i.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-ink-soft">어르신께 전화로 안부를 확인해 보세요.</p>
        </section>
      )}

      {/* 기상 확인 */}
      <section
        className={`flex items-center gap-4 rounded-3xl p-5 ring-2 ${
          today.wakeUpAt
            ? 'bg-emerald-50 ring-emerald-200'
            : wakeOverdue
              ? 'bg-rose-50 ring-rose-200'
              : 'bg-white/80 ring-brand-100'
        }`}
        aria-label="기상 확인"
      >
        <div
          className={`grid size-14 shrink-0 place-items-center rounded-full text-white ${
            today.wakeUpAt ? 'bg-emerald-500' : wakeOverdue ? 'bg-rose-500' : 'bg-amber-400'
          }`}
        >
          {today.wakeUpAt ? (
            <Check className="size-8" strokeWidth={3} aria-hidden />
          ) : (
            <Sun className="size-8" aria-hidden />
          )}
        </div>
        <div>
          <p className="text-xl font-extrabold">
            {today.wakeUpAt
              ? '오늘 기상 확인 완료'
              : wakeOverdue
                ? '기상 확인이 아직 없어요'
                : '기상 확인 기다리는 중'}
          </p>
          <p className="flex items-center gap-1.5 text-base text-ink-soft">
            <AlarmClock className="size-4" aria-hidden />
            {today.wakeUpAt
              ? `${fmtTime(today.wakeUpAt)}에 '일어났어요'를 누르셨어요`
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
            const takenAt = today.takenMeds[m.id]
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
      <InfoCard title="받은 알림" icon={<BellRing />}>
        <div className="mb-4">
          <PushPermission />
        </div>
        {alerts.length === 0 ? (
          <p className="rounded-2xl bg-white/70 p-4 text-center text-base text-ink-soft">
            아직 받은 알림이 없어요.
          </p>
        ) : (
          <ul className="max-h-[32rem] space-y-2 overflow-y-auto">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={`rounded-2xl p-4 ring-1 ${
                  a.kind === 'sos' ? 'bg-rose-50/90 ring-rose-200' : 'bg-amber-50/90 ring-amber-100'
                }`}
              >
                <p className="flex items-start gap-2 text-base font-semibold">
                  {a.kind === 'sos' && <Siren className="mt-0.5 size-5 shrink-0 text-rose-600" aria-hidden />}
                  {a.reason}
                </p>
                <p className="mt-1 text-sm text-ink-soft">
                  {new Date(a.at).toLocaleString('ko-KR', {
                    month: 'numeric',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                  {' · '}
                  {a.channels
                    .filter((c) => READY_CHANNELS.includes(c))
                    .map((c) => CHANNEL_LABEL[c])
                    .join(', ') || '보호자 화면'}
                </p>
                {a.ackAt ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                    <CheckCheck className="size-4" aria-hidden /> {fmtTime(a.ackAt)}에 확인했어요
                  </p>
                ) : (
                  <BigButton
                    size="md"
                    variant={a.kind === 'sos' ? 'danger' : 'primary'}
                    icon={<Check />}
                    className="mt-3"
                    fullWidth
                    loading={acking === a.id}
                    disabled={acking !== null}
                    onClick={() => ack(a)}
                  >
                    확인했다고 어르신께 알리기
                  </BigButton>
                )}
                {ackError?.id === a.id && (
                  <StatusNote tone="warn" className="mt-2" onClose={() => setAckError(null)}>
                    확인 표시를 보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. ({ackError.message})
                  </StatusNote>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-sm text-ink-soft">
          이 화면을 켜 두시면 새 알림이 오는 즉시 화면 위쪽과 휴대폰 알림으로 알려 드려요. 화면 알림은
          '확인했어요'를 누를 때까지 남아요. 어르신 앱이 꺼져 있어도 기상·복약 미확인은 이 화면이 직접 알려
          드려요.
        </p>
      </InfoCard>

      {/* 최근 7일 */}
      <InfoCard title="최근 7일" icon={<CalendarDays />} subtitle="기상 확인 시각과 복약 기록">
        <table className="w-full text-left text-base">
          <thead>
            <tr className="text-sm text-ink-soft">
              <th className="py-2 font-bold">날짜</th>
              <th className="py-2 font-bold">기상</th>
              <th className="py-2 text-right font-bold">복약</th>
            </tr>
          </thead>
          <tbody>
            {historyKeys.map((k) => {
              const d = days[k]
              const taken = d ? family.medications.filter((m) => d.takenMeds[m.id]).length : 0
              const label = new Date(`${k}T12:00:00`).toLocaleDateString('ko-KR', {
                month: 'numeric',
                day: 'numeric',
                weekday: 'short',
              })
              return (
                <tr key={k} className="border-t border-brand-100">
                  <td className="py-2.5 font-bold">{k === dateKey ? `${label} (오늘)` : label}</td>
                  <td className="py-2.5">
                    {d?.wakeUpAt ? (
                      fmtTime(d.wakeUpAt)
                    ) : k === dateKey && !wakeOverdue ? (
                      <span className="text-ink-soft">기다리는 중</span>
                    ) : !d && k !== dateKey ? (
                      <span className="text-ink-soft">기록 없음</span>
                    ) : (
                      <span className="font-bold text-rose-600">확인 없음</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={taken === total ? 'font-bold text-emerald-700' : ''}>
                      {taken} / {total}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-ink-soft">복약 개수는 지금 등록된 약 목록 기준이에요.</p>
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
