import {
  BellRing,
  CalendarDays,
  Check,
  KeyRound,
  Phone,
  Pill,
  Plus,
  ServerOff,
  Settings2,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  UserRoundSearch,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { MAX_ELDERS, initialCodes, saveCodes, saveSelected } from '@/features/care/lib/guardianCodes'
import { registerPushDevice, setMorningNotice } from '@/shared/api/push'
import { LogoutButton } from '@/features/auth/components/LogoutButton'
import { FontScaleButton, Logo } from '@/shared/layout/AppLayout'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import { useNow } from '@/shared/hooks/useNow'
import { showSystemNotification } from '@/shared/lib/notify'
import {
  BigButton,
  EmptyState,
  Fold,
  ErrorState,
  InfoCard,
  LoadingList,
  StatusNote,
  TextField,
} from '@/shared/ui'
import { hasAssignedWorker } from '@/features/auth/lib/demoAccounts'
import { PushPermission } from '@/features/care/components/PushPermission'
import {
  ackAlertAsGuardian,
  watchAlerts,
  watchDays,
  watchFamily,
  type FamilyInfo,
} from '@/features/care/api/family'
import {
  buildGuardianTodos,
  findCareIssues,
  fromNow,
  type CareIssue,
} from '@/features/care/lib/guardianIssues'
import { STATUS_STYLE } from '@/features/care/lib/status'
import { getMedStatus } from '@/features/care/hooks/useCareWatcher'
import { AlertRow } from '@/features/care/components/AlertRow'
import { alertLevelOf, guardianSeen, workerOnlyAck } from '@/features/care/lib/alertDisplay'
import { todayKey, type AlertLog, type DayRecord } from '@/features/care/store/useCareStore'

/**
 * 새 알림을 휴대폰 알림(권한이 있을 때)으로 알려 줍니다. 제목에 어르신 이름을 넣어 누구 일인지 바로 알 수 있게 합니다.
 * 화면에서는 '확인할 일' 한곳에만 보여 주고, '확인했어요'를 누를 때까지 남습니다.
 */
function notify(message: string, tone: 'danger' | 'warn', elderName?: string) {
  const urgent = tone === 'danger'
  const title = `${urgent ? '🚨 늘봄 긴급' : '⚠️ 늘봄 확인 필요'}${elderName ? ` · ${elderName} 님` : ''}`
  showSystemNotification(title, message, urgent ? 'urgent' : 'warn')
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

/** 보호자가 지운 알림 (이 기기의 화면에서만 숨김. 기록 자체는 남겨 복지사 확인·에스컬레이션에 씀) */
const hiddenKey = (code: string) => `neulbom-guardian-hidden-${code}`
const readHidden = (code: string): string[] => {
  try {
    const v = JSON.parse(localStorage.getItem(hiddenKey(code)) ?? '[]')
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}
const saveHidden = (code: string, ids: string[]) => {
  try {
    localStorage.setItem(hiddenKey(code), JSON.stringify(ids.slice(-200)))
  } catch {
    /* 저장이 막힌 브라우저에서는 이번에만 숨김 */
  }
}

/** 어르신 이름 버튼마다 세는 확인할 일 */
interface TabCount {
  name: string
  count: number
  urgent: boolean
}

const HISTORY_DAYS = 7
/** 보호자 화면이 직접 경고하기 전에 어르신 기기의 알림이 도착하기를 기다리는 시간 */
const GUARDIAN_NOTIFY_DELAY_MS = 5000

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** 지난 알림의 확인 기록: 복지사·보호자가 각각 언제 확인했는지 */
const ackText = (a: AlertLog) => {
  const parts: string[] = []
  if (a.ackAt && a.ackBy && a.ackBy !== a.guardianAckBy && workerOnlyAckName(a.ackBy))
    parts.push(`${fmtTime(a.ackAt)} ${a.ackBy} 확인`)
  const gAt = a.guardianAckAt ?? (!workerOnlyAckName(a.ackBy) ? a.ackAt : undefined)
  const gBy = a.guardianAckBy ?? a.ackBy ?? '보호자'
  if (gAt) parts.push(`${fmtTime(gAt)} ${gBy} 확인`)
  return parts.join(' · ')
}
const workerOnlyAckName = (name?: string) => name === '담당 사회복지사'

/**
 * 보호자 화면: 가족 코드로 어르신의 오늘 기상·복약 상태와 알림을 실시간으로 봅니다.
 * 보호자 한 명이 어르신을 최대 4명까지 등록해, 위쪽 이름 버튼으로 바꿔 가며 봅니다.
 * 알림은 어르신마다 따로 쌓이고(이름 버튼의 빨간 숫자), 다른 어르신을 보고 있어도 알려 드립니다.
 */
export function GuardianPage() {
  const [params] = useSearchParams()
  // 어르신이 보낸 링크(/guardian?code=XXXXXX)로 들어오면 그 어르신을 목록에 넣고 바로 보여 줘요.
  const [init] = useState(() => initialCodes(params.get('code') ?? ''))
  const [codes, setCodes] = useState<string[]>(init.codes)
  const [code, setCode] = useState(init.selected)
  const [adding, setAdding] = useState(false)
  const [fullNote, setFullNote] = useState(init.full)
  const [counts, setCounts] = useState<Record<string, TabCount>>({})
  const onCount = useCallback((c: string, info: TabCount) => {
    setCounts((prev) =>
      prev[c]?.count === info.count && prev[c]?.name === info.name && prev[c]?.urgent === info.urgent
        ? prev
        : { ...prev, [c]: info },
    )
  }, [])

  const select = (c: string) => {
    saveSelected(c)
    setCode(c)
    setAdding(false)
  }
  const add = (c: string) => {
    if (!codes.includes(c)) {
      if (codes.length >= MAX_ELDERS) {
        setFullNote(true)
        return
      }
      const next = [...codes, c]
      saveCodes(next)
      setCodes(next)
    }
    select(c)
  }
  const remove = (c: string) => {
    const next = codes.filter((x) => x !== c)
    saveCodes(next)
    setCodes(next)
    select(next[0] ?? '')
  }

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Logo compact />
          <span className="flex shrink-0 items-center gap-1">
            <span className="hidden rounded-full bg-violet-100 px-3 py-1 text-sm font-bold whitespace-nowrap text-violet-700 min-[420px]:inline">
              보호자 화면
            </span>
            <FontScaleButton />
            <LogoutButton />
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
        ) : (
          <div className="space-y-5">
            {fullNote && (
              <StatusNote tone="warn" onClose={() => setFullNote(false)}>
                어르신은 최대 {MAX_ELDERS}명까지 등록할 수 있어요. 다른 어르신을 목록에서 뺀 뒤 다시 추가해
                주세요.
              </StatusNote>
            )}
            {codes.length > 0 && (
              <ElderTabs
                codes={codes}
                active={adding ? '' : code}
                onSelect={select}
                onAdd={codes.length < MAX_ELDERS ? () => setAdding(true) : undefined}
                onCount={onCount}
              />
            )}
            {/* 다른 어르신에게 확인할 일이 있으면 바로 알 수 있게 한 줄로 보여 줍니다 */}
            {codes
              .filter((c) => c !== code && counts[c]?.count)
              .map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => select(c)}
                  className={`flex min-h-12 w-full items-center justify-between gap-2 rounded-2xl px-4 text-left text-base font-bold ring-2 ${
                    counts[c].urgent
                      ? 'bg-rose-50 text-rose-800 ring-rose-200'
                      : 'bg-amber-50 text-amber-900 ring-amber-200'
                  }`}
                >
                  <span>
                    {counts[c].urgent ? '🚨' : '⚠️'} {counts[c].name} 님 확인할 일 {counts[c].count}개
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-brand-700">보기 ›</span>
                </button>
              ))}
            {code && !adding ? (
              <GuardianDashboard key={code} code={code} onRemove={() => remove(code)} />
            ) : (
              <CodeForm onSubmit={add} onCancel={codes.length > 0 ? () => setAdding(false) : undefined} />
            )}
          </div>
        )}
      </main>
    </div>
  )
}

/**
 * 어르신 이름 버튼 줄. 버튼마다 그 어르신의 기록을 따로 지켜보며
 * 확인이 필요한 일의 개수를 빨간 숫자로 보여 주고, 다른 어르신을 보고 있을 때 새 알림이 오면 알려 줍니다.
 */
function ElderTabs({
  codes,
  active,
  onSelect,
  onAdd,
  onCount,
}: {
  codes: string[]
  active: string
  onSelect: (code: string) => void
  onAdd?: () => void
  onCount: (code: string, info: TabCount) => void
}) {
  return (
    <nav aria-label="어르신 목록" className="flex flex-wrap gap-2">
      {codes.map((c) => (
        <ElderTab key={c} code={c} active={c === active} onSelect={() => onSelect(c)} onCount={onCount} />
      ))}
      {onAdd && (
        <button
          type="button"
          onClick={onAdd}
          className="flex min-h-12 items-center gap-1.5 rounded-2xl border-2 border-dashed border-brand-300 px-4 text-base font-bold whitespace-nowrap text-brand-700 hover:bg-brand-50"
        >
          <Plus className="size-5" aria-hidden /> 어르신 추가
        </button>
      )}
    </nav>
  )
}

function ElderTab({
  code,
  active,
  onSelect,
  onCount,
}: {
  code: string
  active: boolean
  onSelect: () => void
  onCount: (code: string, info: TabCount) => void
}) {
  const now = useNow(60_000)
  const dateKey = todayKey(now)
  const [family, setFamily] = useState<FamilyInfo | null | undefined>(undefined)
  const [days, setDays] = useState<Record<string, DayRecord>>({})
  const [alerts, setAlerts] = useState<AlertLog[]>([])
  const seen = useRef<Set<string> | null>(null)
  const nameRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    nameRef.current = family?.elderName
  }, [family])
  const activeRef = useRef(active)
  useEffect(() => {
    activeRef.current = active
  }, [active])

  useEffect(() => {
    const quiet = () => {}
    const offs = [
      watchFamily(code, setFamily, quiet),
      watchDays(code, dateKey, setDays, quiet),
      watchAlerts(
        code,
        (list) => {
          // 지금 보고 있지 않은 어르신에게 새 알림이 오면 알려 줍니다. (보고 있는 어르신은 아래 화면이 알림)
          if (seen.current && !activeRef.current) {
            for (const a of list) {
              if (!seen.current.has(a.id))
                notify(a.reason, a.kind === 'sos' ? 'danger' : 'warn', nameRef.current)
            }
          }
          seen.current = new Set(list.map((a) => a.id))
          setAlerts(list)
        },
        quiet,
      ),
    ]
    return () => offs.forEach((off) => off())
  }, [code, dateKey])

  // 휴대폰 알림을 허락한 기기라면 이 어르신의 알림도 받을 수 있게 등록합니다. (어르신마다 따로 등록)
  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted')
      void registerPushDevice(code, 'guardian')
  }, [code])

  const todos = family
    ? buildGuardianTodos(family, days[dateKey] ?? { takenMeds: {} }, alerts, now, dateKey)
    : []
  const count = todos.length
  const urgent = todos.some((t) => t.level === 'urgent')
  const name = family?.elderName ?? (family === null ? code : '불러오는 중')
  // 위쪽 '다른 어르신 확인할 일' 띠에 쓰도록 알려 줍니다.
  useEffect(() => {
    onCount(code, { name, count, urgent })
  }, [code, name, count, urgent, onCount])
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? 'page' : undefined}
      aria-label={`${name}${count ? `, 확인할 일 ${count}개` : ''}`}
      className={`relative flex min-h-12 items-center gap-2 rounded-2xl px-4 text-base font-bold whitespace-nowrap ring-2 transition ${
        active
          ? 'bg-brand-600 text-white ring-brand-600'
          : 'bg-white/80 text-ink ring-brand-100 hover:ring-brand-300'
      }`}
    >
      {name} 님
      {count > 0 && (
        <span className="grid min-w-6 place-items-center rounded-full bg-rose-500 px-1.5 text-sm font-black text-white">
          {count}
        </span>
      )}
    </button>
  )
}

function CodeForm({ onSubmit, onCancel }: { onSubmit: (code: string) => void; onCancel?: () => void }) {
  const [value, setValue] = useState('')
  const clean = value
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase()
    .slice(0, 6)
  return (
    <InfoCard
      title="어르신 가족 코드를 입력해 주세요"
      icon={<KeyRound />}
      subtitle="어르신 휴대폰의 '알림' 화면에 있는 6자리 코드예요."
    >
      <p className="mb-4 rounded-2xl bg-brand-50 p-4 text-base">
        <b>어르신께 받은 링크</b>를 누르셨다면 코드 없이 바로 연결돼요. 링크가 없으면 어르신 휴대폰의 늘봄 →
        알림 → <b>보호자에게 링크 보내기</b>를 눌러 달라고 해 주세요.
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
        {onCancel && (
          <BigButton variant="ghost" fullWidth onClick={onCancel}>
            취소
          </BigButton>
        )}
      </form>
    </InfoCard>
  )
}

function GuardianDashboard({ code, onRemove }: { code: string; onRemove: () => void }) {
  const now = useNow(30_000)
  const dateKey = todayKey(now)
  const sinceKey = todayKey(new Date(now.getTime() - (HISTORY_DAYS - 1) * 86_400_000))
  const [ackError, setAckError] = useState<{ id: string; message: string } | null>(null)
  const [family, setFamily] = useState<FamilyInfo | null | undefined>(undefined)
  const nameRef = useRef<string | undefined>(undefined)
  useEffect(() => {
    nameRef.current = family?.elderName
  }, [family])
  const [days, setDays] = useState<Record<string, DayRecord>>({})
  const [alerts, setAlerts] = useState<AlertLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [acking, setAcking] = useState<string | null>(null)
  const [hidden, setHidden] = useState<string[]>(() => readHidden(code))
  const [pushOn, setPushOn] = useState(false)
  const [showHidden, setShowHidden] = useState(false)
  const hide = (ids: string[]) => {
    const next = [...new Set([...hidden, ...ids])]
    saveHidden(code, next)
    setHidden(next)
  }
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
                notify(a.reason, a.kind === 'sos' ? 'danger' : 'warn', nameRef.current)
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
      fresh.forEach((i) => notify(i.text, i.level === 'danger' ? 'danger' : 'warn', family.elderName))
      saveNotified(code, [...done, ...fresh.map((i) => i.key)])
    }, GUARDIAN_NOTIFY_DELAY_MS)
    return () => clearTimeout(timer)
  }, [issues, family, code])

  const ack = async (a: AlertLog) => {
    if (!family) return
    setAcking(a.id)
    setAckError(null)
    try {
      await ackAlertAsGuardian(code, a, family.guardianName.trim() || '보호자')
    } catch (e) {
      setAckError({ id: a.id, message: (e as Error).message })
    } finally {
      setAcking(null)
    }
  }

  // 확인할 일 개수를 브라우저 탭 제목에 보여 줍니다. 예: (2) 늘봄 보호자 화면
  const todoCount = family ? buildGuardianTodos(family, today, alerts, now, dateKey).length : 0
  useEffect(() => {
    const base = '늘봄 보호자 화면'
    document.title = todoCount ? `(${todoCount}) ${base}` : base
  }, [todoCount])

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
          <BigButton variant="soft" onClick={onRemove}>
            목록에서 빼기
          </BigButton>
        }
      />
    )

  // 지운 알림은 숨기고(다시 보기 가능), 확인하지 않은 알림은 지울 수 없게 항상 보여 줍니다.
  const visibleAlerts = showHidden ? alerts : alerts.filter((a) => !guardianSeen(a) || !hidden.includes(a.id))
  const ackedVisible = visibleAlerts.filter((a) => guardianSeen(a) && !hidden.includes(a.id))
  const hiddenCount = alerts.filter((a) => guardianSeen(a) && hidden.includes(a.id)).length
  /** 알림이 나중에 해결됐는지: 기상 알림은 그날 일어나셨으면, 약 알림은 그 약을 드셨으면 */
  const resolvedText = (a: AlertLog): string | null => {
    const key = a.key ?? ''
    const day = days[key.slice(0, 10)]
    if (!day) return null
    if (key.endsWith('-wake') && day.wakeUpAt) return `${fmtTime(day.wakeUpAt)}에 일어나셨어요`
    const m = key.match(/^\d{4}-\d{2}-\d{2}-med-(.+)$/)
    const takenAt = m ? day.takenMeds?.[m[1]] : undefined
    return takenAt ? `${fmtTime(takenAt)}에 드셨어요` : null
  }
  const nowMin = now.getHours() * 60 + now.getMinutes()
  // 휴대폰 알림을 아직 켜지 않았으면 맨 위에서 먼저 켜도록 안내합니다. (가장 먼저 해야 할 일)
  const needPush = !pushOn && (typeof Notification === 'undefined' || Notification.permission !== 'granted')
  const [dh, dm] = family.wakeUpDeadline.split(':').map(Number)
  const wakeOverdue = !today.wakeUpAt && nowMin > dh * 60 + dm
  const takenCount = family.medications.filter((m) => today.takenMeds[m.id]).length
  const total = family.medications.length
  const historyKeys = Array.from({ length: HISTORY_DAYS }, (_, i) =>
    todayKey(new Date(now.getTime() - i * 86_400_000)),
  )

  const todos = buildGuardianTodos(family, today, alerts, now, dateKey)
  const pastAlerts = alerts.filter((a) => guardianSeen(a) && (showHidden || !hidden.includes(a.id)))
  const nextMed = family.medications
    .filter(
      (m) => !today.takenMeds[m.id] && getMedStatus(m, undefined, now, family.medGraceMinutes) !== 'missed',
    )
    .sort((a, b) => a.time.localeCompare(b.time))[0]
  const missedMeds = family.medications.filter(
    (m) => getMedStatus(m, today.takenMeds[m.id], now, family.medGraceMinutes) === 'missed',
  ).length

  return (
    <div className="animate-fade-up space-y-4">
      {needPush && (
        <section
          className="rounded-3xl bg-white p-5 shadow-glass ring-2 ring-brand-300"
          aria-label="휴대폰 알림 켜기"
        >
          <p className="mb-1 flex items-center gap-2 text-lg font-black text-brand-800">
            <BellRing className="size-6 shrink-0" aria-hidden /> 먼저 휴대폰 알림을 켜 주세요
          </p>
          <p className="mb-3 text-base text-ink-soft">
            켜 두면 늘봄을 닫아 두거나 화면이 꺼져 있어도 긴급·확인 필요 알림이 와요.
          </p>
          <PushPermission role="guardian" familyCode={code} onGranted={() => setPushOn(true)} />
        </section>
      )}

      {/* 누구의 오늘인지 + 전화 */}
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl leading-tight font-black">{family.elderName} 님의 오늘</h1>
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-soft">
            <Smartphone className="size-4 shrink-0" aria-hidden />앱 마지막 사용{' '}
            <b className="text-ink">{family.lastSeenAt ? fromNow(family.lastSeenAt, now) : '기록 없음'}</b>
          </p>
        </div>
        {family.elderPhone.trim() ? (
          <a
            href={`tel:${family.elderPhone.trim()}`}
            className="flex min-h-12 shrink-0 items-center gap-2 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 px-4 text-base font-bold whitespace-nowrap text-white shadow-glass"
          >
            <Phone className="size-5" aria-hidden /> 전화
          </a>
        ) : (
          <p className="shrink-0 text-right text-sm text-ink-soft">
            어르신 번호 없음
            <br />
            (어르신 앱 → 내 정보)
          </p>
        )}
      </div>

      {/* 확인할 일: 알림·문제는 모두 이 한곳에서만 보여 줍니다 */}
      {todos.length === 0 ? (
        <section
          className="flex items-center gap-3 rounded-3xl bg-emerald-50 p-4 ring-2 ring-emerald-200"
          aria-label="확인할 일"
        >
          <ShieldCheck className="size-8 shrink-0 text-emerald-600" aria-hidden />
          <p className="text-lg font-extrabold text-emerald-800">지금은 확인할 일이 없어요</p>
        </section>
      ) : (
        <section className="glass rounded-3xl p-4" aria-label="확인할 일">
          <p className="mb-3 text-lg font-black">
            확인할 일 <span className="text-rose-600">{todos.length}개</span>
          </p>
          <ul className="space-y-2">
            {todos.map((t) => (
              <AlertRow
                key={t.key}
                level={t.level}
                text={t.text}
                at={t.at}
                status={
                  t.alert && workerOnlyAck(t.alert)
                    ? { kind: 'acked', text: `${fmtTime(t.alert.ackAt!)} ${t.alert.ackBy}가 먼저 확인했어요` }
                    : t.alert && resolvedText(t.alert)
                      ? { kind: 'resolved', text: `해결됨 · ${resolvedText(t.alert)}` }
                      : {
                          kind: 'pending',
                          text: t.alert ? '아직 확인 전' : '어르신께 전화로 안부를 확인해 보세요',
                        }
                }
                action={
                  t.alert && (
                    <>
                      <BigButton
                        size="md"
                        variant={t.level === 'urgent' ? 'danger' : 'primary'}
                        icon={<Check />}
                        fullWidth
                        loading={acking === t.alert.id}
                        disabled={acking !== null}
                        onClick={() => t.alert && ack(t.alert)}
                      >
                        확인했어요
                      </BigButton>
                      {ackError?.id === t.alert.id && (
                        <StatusNote tone="warn" className="mt-2" onClose={() => setAckError(null)}>
                          확인 표시를 저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요.
                        </StatusNote>
                      )}
                    </>
                  )
                }
              />
            ))}
          </ul>
          {hasAssignedWorker(code) && (
            <p className="mt-2 text-sm text-ink-soft">30분 넘게 확인하지 않으면 담당 복지사에게도 알려요.</p>
          )}
        </section>
      )}

      {/* 오늘 한눈에: 기상 · 약 */}
      <div className="grid grid-cols-2 gap-3">
        <section
          aria-label="기상"
          className={`rounded-3xl p-4 ring-2 ${
            today.wakeUpAt
              ? 'bg-emerald-50 ring-emerald-200'
              : wakeOverdue
                ? 'bg-amber-50 ring-amber-200'
                : 'bg-white/80 ring-brand-100'
          }`}
        >
          <p className="flex items-center gap-1.5 text-base font-bold text-ink-soft">
            <Sun className="size-5 text-amber-500" aria-hidden /> 기상
          </p>
          <p className="mt-1 text-xl font-black">
            {today.wakeUpAt ? (
              <span className="flex items-center gap-1 text-emerald-700">
                <Check className="size-6" strokeWidth={3} aria-hidden />
                {fmtTime(today.wakeUpAt)}
              </span>
            ) : wakeOverdue ? (
              <span className="text-amber-800">아직 없음</span>
            ) : (
              '기다리는 중'
            )}
          </p>
          <p className="text-sm text-ink-soft">
            {today.wakeUpAt ? '일어나셨어요' : `${family.wakeUpDeadline}까지`}
          </p>
        </section>
        <section
          aria-label="오늘 약"
          className={`rounded-3xl p-4 ring-2 ${
            total > 0 && takenCount === total
              ? 'bg-emerald-50 ring-emerald-200'
              : missedMeds > 0
                ? 'bg-amber-50 ring-amber-200'
                : 'bg-white/80 ring-brand-100'
          }`}
        >
          <p className="flex items-center gap-1.5 text-base font-bold text-ink-soft">
            <Pill className="size-5 text-brand-500" aria-hidden /> 약
          </p>
          <p className="mt-1 text-xl font-black">
            {takenCount} / {total}
          </p>
          <p className="text-sm text-ink-soft">
            {total === 0
              ? '등록된 약 없음'
              : takenCount === total
                ? '모두 드셨어요'
                : missedMeds > 0
                  ? `놓친 약 ${missedMeds}개`
                  : nextMed
                    ? `다음 ${nextMed.slot} ${nextMed.time}`
                    : ''}
          </p>
        </section>
      </div>

      {/* 자주 안 보는 것은 접어 둡니다 */}
      <Fold title="오늘 약 목록" icon={<Pill />} hint={`${takenCount}/${total}`}>
        <ul className="space-y-2">
          {family.medications.map((m) => {
            const takenAt = today.takenMeds[m.id]
            const s = STATUS_STYLE[getMedStatus(m, takenAt, now, family.medGraceMinutes)]
            return (
              <li
                key={m.id}
                className="flex items-center justify-between gap-3 rounded-2xl bg-white/80 p-3 ring-1 ring-brand-100"
              >
                <span className="min-w-0">
                  <span className="block text-base font-bold">
                    {m.slot} {m.time}
                  </span>
                  <span className="block text-sm text-ink-soft">
                    {m.name}
                    {takenAt ? ` · ${fmtTime(takenAt)} 복용` : ''}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-sm font-bold whitespace-nowrap ${s.cls}`}
                >
                  {s.label}
                </span>
              </li>
            )
          })}
        </ul>
      </Fold>

      <Fold
        title="지난 알림"
        icon={<BellRing />}
        hint={pastAlerts.length ? `${pastAlerts.length}개` : '없음'}
      >
        {pastAlerts.length === 0 ? (
          <p className="rounded-2xl bg-white/70 p-4 text-center text-base text-ink-soft">
            {hiddenCount > 0 ? '지난 알림을 모두 지웠어요.' : '확인한 알림이 여기에 모여요.'}
          </p>
        ) : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
            {pastAlerts.map((a) => (
              <AlertRow
                key={a.id}
                done
                level={alertLevelOf(a)}
                text={a.reason}
                at={a.at}
                status={{
                  kind: 'acked',
                  text: [ackText(a), resolvedText(a)].filter(Boolean).join(' · '),
                }}
                action={
                  !hidden.includes(a.id) && (
                    <button
                      type="button"
                      onClick={() => hide([a.id])}
                      aria-label={`이 알림 지우기: ${a.reason}`}
                      className="flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-ink-soft hover:bg-white"
                    >
                      <Trash2 className="size-4" aria-hidden /> 지우기
                    </button>
                  )
                }
              />
            ))}
          </ul>
        )}
        <div className="mt-2 flex flex-wrap justify-end gap-2">
          {ackedVisible.length > 1 && (
            <BigButton
              size="md"
              variant="ghost"
              icon={<Trash2 />}
              onClick={() => hide(ackedVisible.map((a) => a.id))}
            >
              모두 지우기
            </BigButton>
          )}
          {hiddenCount > 0 && (
            <BigButton size="md" variant="ghost" onClick={() => setShowHidden((v) => !v)}>
              {showHidden ? '지운 알림 숨기기' : `지운 알림 ${hiddenCount}개 보기`}
            </BigButton>
          )}
        </div>
      </Fold>

      <Fold title="최근 7일 기록" icon={<CalendarDays />}>
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
              // 그날 이미 등록돼 있던 약만 셉니다. (오늘 넣은 약을 지난 날짜에 '안 드심'으로 세지 않게)
              const meds = family.medications.filter(
                (m) => !m.createdAt || todayKey(new Date(m.createdAt)) <= k,
              )
              const dayTotal = meds.length
              const taken = d ? meds.filter((m) => d.takenMeds[m.id]).length : 0
              // 어르신이 늘봄을 쓰기 전 날짜: 기록도, 등록된 약도 없음
              const beforeUse = !d && k !== dateKey && dayTotal === 0
              const label = new Date(`${k}T12:00:00`).toLocaleDateString('ko-KR', {
                month: 'numeric',
                day: 'numeric',
                weekday: 'short',
              })
              return (
                <tr key={k} className="border-t border-brand-100">
                  <td className="py-2.5 font-bold">{k === dateKey ? `${label} (오늘)` : label}</td>
                  <td className="py-2.5">
                    {beforeUse ? (
                      <span className="text-ink-soft">사용 전</span>
                    ) : d?.wakeUpAt ? (
                      fmtTime(d.wakeUpAt)
                    ) : k === dateKey && !wakeOverdue ? (
                      <span className="text-ink-soft">기다리는 중</span>
                    ) : !d && k !== dateKey ? (
                      <span className="text-ink-soft">기록 없음</span>
                    ) : (
                      <span className="font-bold text-amber-700">확인 없음</span>
                    )}
                  </td>
                  <td className="py-2.5 text-right">
                    {beforeUse ? (
                      <span className="text-ink-soft">—</span>
                    ) : (
                      <span className={taken === dayTotal ? 'font-bold text-emerald-700' : ''}>
                        {taken} / {dayTotal}
                      </span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-2 text-sm text-ink-soft">복약 개수는 그날 등록돼 있던 약 기준이에요.</p>
      </Fold>

      <Fold title="알림 설정" icon={<Settings2 />} hint={needPush ? '꺼짐' : '켜짐'}>
        {!needPush && <PushPermission role="guardian" familyCode={code} />}
        <MorningToggle code={code} elderName={family.elderName} />
      </Fold>

      <p className="text-center text-sm text-ink-soft">
        가족 코드 <b className="font-mono">{code}</b> ·{' '}
        <button
          className="min-h-11 font-bold text-brand-700 underline"
          onClick={() => {
            if (
              window.confirm(`${family.elderName} 님을 목록에서 뺄까요? 다시 넣으려면 가족 코드가 필요해요.`)
            )
              onRemove()
          }}
        >
          이 어르신 목록에서 빼기
        </button>
      </p>
    </div>
  )
}

/**
 * '아침 안부 알림 받기' 스위치. 기본은 꺼짐.
 * 켜면 어르신이 '일어났어요'를 누를 때 이 기기로 소리·진동 없이 조용히 알려 드립니다.
 * 어르신마다·기기마다 따로 정합니다.
 */
function MorningToggle({ code, elderName }: { code: string; elderName: string }) {
  const key = `neulbom-morning-${code}`
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(key) === '1'
    } catch {
      return false
    }
  })
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const allowed = typeof Notification !== 'undefined' && Notification.permission === 'granted'

  const toggle = async () => {
    const next = !on
    setBusy(true)
    setNote(null)
    const result = await setMorningNotice(code, next)
    setBusy(false)
    if (result !== 'registered') {
      setNote('설정을 저장하지 못했어요. 홈 화면의 늘봄 아이콘으로 열었는지, 인터넷이 되는지 확인해 주세요.')
      return
    }
    setOn(next)
    try {
      localStorage.setItem(key, next ? '1' : '0')
    } catch {
      /* 저장이 막혀도 서버에는 저장됨 */
    }
  }

  return (
    <div className="mt-3 rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-base font-bold">
          <Sun className="size-5 shrink-0 text-amber-500" aria-hidden />
          아침 안부 알림 받기
        </p>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${elderName} 님 아침 안부 알림 받기`}
          disabled={!allowed || busy}
          onClick={toggle}
          className={`relative h-9 w-16 shrink-0 rounded-full transition disabled:opacity-50 ${on ? 'bg-brand-600' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-1 size-7 rounded-full bg-white shadow transition-all ${on ? 'left-8' : 'left-1'}`}
            aria-hidden
          />
        </button>
      </div>
      <p className="mt-1 text-sm text-ink-soft">
        {allowed
          ? on
            ? `${elderName} 님이 '일어났어요'를 누르면 이 휴대폰으로 조용히(소리·진동 없이) 알려 드려요.`
            : `켜면 ${elderName} 님이 '일어났어요'를 누를 때 조용히 알려 드려요. 꺼 두어도 일어나지 않으셨을 때는 알림이 가요.`
          : '먼저 위의 휴대폰 알림을 켜 주세요.'}
      </p>
      {note && (
        <StatusNote tone="warn" className="mt-2" onClose={() => setNote(null)}>
          {note}
        </StatusNote>
      )}
    </div>
  )
}
