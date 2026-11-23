import { CheckCheck, Pill, ServerOff, ShieldAlert, ShieldCheck, Siren, Sun, Phone } from 'lucide-react'
import { useEffect, useState } from 'react'
import { LogoutButton } from '@/features/auth/components/LogoutButton'
import { WORKER_FAMILY_CODES } from '@/features/auth/lib/demoAccounts'
import { ackAlert, watchAlerts, watchDays, watchFamily, type FamilyInfo } from '@/features/care/api/family'
import { getMedStatus } from '@/features/care/hooks/useCareWatcher'
import { findCareIssues, fromNow } from '@/features/care/lib/guardianIssues'
import { todayKey, type AlertLog, type DayRecord } from '@/features/care/store/useCareStore'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import { useNow } from '@/shared/hooks/useNow'
import { Logo } from '@/shared/layout/AppLayout'
import { BigButton, EmptyState, ErrorState, InfoCard, LoadingList, StatusNote } from '@/shared/ui'

const WORKER_NAME = '담당 사회복지사'

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/** 복지사 화면: 담당 어르신의 오늘 상태와 긴급 요청을 한곳에서 봅니다. (시연용: 담당 어르신은 코드에 고정) */
export function WorkerPage() {
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
          <Logo />
          <span className="flex items-center gap-2">
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-700">
              복지사 화면
            </span>
            <LogoutButton />
          </span>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div>
          <h1 className="text-3xl font-black">담당 어르신</h1>
          <p className="mt-1 text-lg text-ink-soft">오늘의 기상·복약 상태와 긴급 요청을 확인해요.</p>
        </div>
        {!isFirebaseEnabled ? (
          <EmptyState
            icon={<ServerOff />}
            title="서버 연결이 설정되지 않았어요"
            desc="복지사 화면은 Firebase 설정이 있어야 동작해요."
          />
        ) : (
          WORKER_FAMILY_CODES.map((code) => <ElderCard key={code} code={code} />)
        )}
      </main>
    </div>
  )
}

function ElderCard({ code }: { code: string }) {
  const now = useNow(30_000)
  const dateKey = todayKey(now)
  const [family, setFamily] = useState<FamilyInfo | null | undefined>(undefined)
  const [days, setDays] = useState<Record<string, DayRecord>>({})
  const [alerts, setAlerts] = useState<AlertLog[]>([])
  const [error, setError] = useState<string | null>(null)
  const [retry, setRetry] = useState(0)
  const [acking, setAcking] = useState<string | null>(null)
  const [ackError, setAckError] = useState<string | null>(null)

  useEffect(() => {
    const onError = (e: Error) => setError(e.message)
    const offs = [
      watchFamily(code, setFamily, onError),
      watchDays(code, dateKey, setDays, onError),
      watchAlerts(code, setAlerts, onError),
    ]
    return () => offs.forEach((off) => off())
  }, [code, dateKey, retry])

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          setError(null)
          setRetry((n) => n + 1)
        }}
      />
    )
  }
  if (family === undefined) return <LoadingList count={1} />
  if (family === null) {
    return (
      <EmptyState
        icon={<ShieldAlert />}
        title="아직 연결된 어르신 기록이 없어요"
        desc="어르신 계정(senior)으로 로그인해 기상 확인이나 약 체크를 한 번 하면 이곳에 나타나요."
      />
    )
  }

  const today: DayRecord = days[dateKey] ?? { takenMeds: {} }
  const issues = findCareIssues(family, today, alerts, now, dateKey)
  const meds = family.medications.filter(
    (m) => getMedStatus(m, undefined, now, family.medGraceMinutes) !== 'later',
  )
  const taken = meds.filter((m) => today.takenMeds[m.id]).length
  const recent = alerts.slice(0, 5)

  const ack = async (a: AlertLog) => {
    setAcking(a.id)
    setAckError(null)
    try {
      await ackAlert(code, a.id, WORKER_NAME)
    } catch (e) {
      setAckError((e as Error).message)
    } finally {
      setAcking(null)
    }
  }

  const danger = issues.some((i) => i.level === 'danger')

  return (
    <InfoCard
      title={`${family.elderName} 님`}
      subtitle={`보호자 ${family.guardianName} · 가족 코드 ${code}`}
      icon={danger ? <Siren /> : issues.length ? <ShieldAlert /> : <ShieldCheck />}
    >
      <div className="space-y-4">
        {issues.length === 0 ? (
          <StatusNote tone="success">지금 확인이 필요한 일이 없어요.</StatusNote>
        ) : (
          <ul className="space-y-2" aria-label="확인이 필요해요">
            {issues.map((i) => (
              <li key={i.key}>
                {i.level === 'danger' ? (
                  <p className="flex items-start gap-2.5 rounded-2xl bg-rose-50 px-4 py-3 text-base font-bold text-rose-700 ring-2 ring-rose-200">
                    <Siren className="mt-0.5 size-5 shrink-0" aria-hidden />
                    <span>{i.text}</span>
                  </p>
                ) : (
                  <StatusNote tone="warn">{i.text}</StatusNote>
                )}
              </li>
            ))}
          </ul>
        )}

        <dl className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-brand-100">
            <dt className="flex items-center gap-1.5 text-sm font-bold text-ink-soft">
              <Sun className="size-4" aria-hidden /> 오늘 기상
            </dt>
            <dd className="mt-1 text-xl font-black">
              {today.wakeUpAt ? `${fmtTime(today.wakeUpAt)} 확인` : '아직 확인 전'}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-brand-100">
            <dt className="flex items-center gap-1.5 text-sm font-bold text-ink-soft">
              <Pill className="size-4" aria-hidden /> 오늘 복약
            </dt>
            <dd className="mt-1 text-xl font-black">
              {meds.length === 0 ? '챙길 약 없음' : `${taken} / ${meds.length}개 복용`}
            </dd>
          </div>
          <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-brand-100">
            <dt className="text-sm font-bold text-ink-soft">앱 마지막 사용</dt>
            <dd className="mt-1 text-xl font-black">
              {family.lastSeenAt ? fromNow(family.lastSeenAt, now) : '기록 없음'}
            </dd>
          </div>
        </dl>

        {family.elderPhone && (
          <BigButton
            variant="soft"
            icon={<Phone />}
            onClick={() => {
              window.location.href = `tel:${family.elderPhone}`
            }}
          >
            어르신께 전화하기 ({family.elderPhone})
          </BigButton>
        )}

        <section aria-label="최근 알림">
          <h2 className="mb-2 text-lg font-extrabold">최근 알림</h2>
          {recent.length === 0 ? (
            <p className="text-base text-ink-soft">아직 알림이 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {recent.map((a) => (
                <li key={a.id} className="rounded-2xl bg-white/70 p-3 ring-1 ring-brand-100">
                  <p className="text-base font-bold">{a.reason}</p>
                  <p className="text-sm text-ink-soft">{fromNow(a.at, now)}</p>
                  {a.ackAt ? (
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-700">
                      <CheckCheck className="size-4" aria-hidden /> {a.ackBy ?? '확인'} · {fmtTime(a.ackAt)}에
                      확인했어요
                    </p>
                  ) : (
                    <BigButton
                      size="md"
                      variant="soft"
                      className="mt-2"
                      loading={acking === a.id}
                      disabled={acking !== null}
                      onClick={() => ack(a)}
                    >
                      확인했어요
                    </BigButton>
                  )}
                </li>
              ))}
            </ul>
          )}
          {ackError && (
            <StatusNote tone="warn" className="mt-2">
              확인 표시를 보내지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요. ({ackError})
            </StatusNote>
          )}
        </section>
      </div>
    </InfoCard>
  )
}
