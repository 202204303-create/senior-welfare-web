import type { FamilyInfo } from '@/features/care/api/family'
import { getMedStatus } from '@/features/care/hooks/useCareWatcher'
import { guardianSeen } from '@/features/care/lib/alertDisplay'
import { timeToMinutes, type AlertLog, type DayRecord } from '@/features/care/store/useCareStore'

/** 어르신 앱이 이 시간 넘게 열리지 않으면 보호자에게 알립니다. */
export const IDLE_WARN_HOURS = 6
const SOS_KEEP_MS = 24 * 60 * 60 * 1000

export interface CareIssue {
  /** 같은 경고를 여러 번 알리지 않기 위한 키. 어르신 기기 알림의 key 와 같은 형식입니다. */
  key: string
  level: 'danger' | 'warn'
  text: string
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })

/**
 * 보호자 화면에서 서버 기록만 보고 '지금 확인이 필요한 일'을 찾습니다.
 * 어르신 앱이 꺼져 있어 어르신 기기에서 알림을 못 보낸 경우에도 보호자가 알 수 있습니다.
 */
export function findCareIssues(
  family: FamilyInfo,
  today: DayRecord,
  alerts: AlertLog[],
  now: Date,
  dateKey: string,
): CareIssue[] {
  const issues: CareIssue[] = []
  const nowMin = now.getHours() * 60 + now.getMinutes()

  for (const a of alerts) {
    if (a.kind === 'sos' && !a.ackAt && now.getTime() - new Date(a.at).getTime() < SOS_KEEP_MS) {
      issues.push({
        key: a.key ?? a.id,
        level: 'danger',
        text: `${fmtTime(a.at)}에 긴급 도움을 요청하셨어요. 아직 확인하지 않았어요.`,
      })
    }
  }

  if (!today.wakeUpAt && nowMin > timeToMinutes(family.wakeUpDeadline)) {
    issues.push({
      key: `${dateKey}-wake`,
      // 긴급(빨강)은 SOS 만. 기상 미확인은 '확인 필요' 단계 (알림 정책과 같게)
      level: 'warn',
      text: `${family.wakeUpDeadline}까지 기상 확인이 없어요.`,
    })
  }

  for (const m of family.medications) {
    if (getMedStatus(m, today.takenMeds[m.id], now, family.medGraceMinutes) === 'missed') {
      issues.push({
        key: `${dateKey}-med-${m.id}`,
        level: 'warn',
        text: `${m.slot} 약(${m.name})을 아직 안 드셨어요.`,
      })
    }
  }

  if (family.lastSeenAt) {
    const idleMs = now.getTime() - new Date(family.lastSeenAt).getTime()
    if (idleMs > IDLE_WARN_HOURS * 60 * 60 * 1000) {
      issues.push({
        key: `idle-${family.lastSeenAt}`,
        level: 'warn',
        text: `어르신 앱이 ${Math.floor(idleMs / 3_600_000)}시간째 열리지 않았어요.`,
      })
    }
  }

  return issues
}

/** '방금 전', '12분 전', '3시간 전', '11월 16일 오후 8:10' */
export function fromNow(iso: string, now: Date) {
  const diffMin = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000)
  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}시간 전`
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

/** 보호자 '확인할 일' 한 줄: 지금 문제(이슈)와 아직 확인하지 않은 알림을 하나로 합친 것 */
export interface GuardianTodo {
  key: string
  level: 'urgent' | 'warn'
  text: string
  /** 언제 생긴 일인지 (알림이 있으면 그 시각) */
  at?: string
  /** '확인했어요'를 누를 알림 (어르신 기기·서버가 보낸 알림이 있을 때만) */
  alert?: AlertLog
}

/**
 * 보호자가 지금 확인할 일 목록. (보호자 화면 맨 위 한곳에서만 보여 주기 위해 한데 모음)
 * - 지금 문제: 확인 안 한 긴급 요청, 기상 미확인, 놓친 약, 앱 오래 안 열림
 * - 아직 '확인했어요'를 안 누른 알림 (나중에 해결됐더라도 확인은 필요 → 30분 넘으면 복지사에게 감)
 * 같은 일(같은 key)은 한 줄로 합치고, 보호자가 이미 확인한 일은 뺍니다. 긴급이 맨 위, 그다음 최근 순.
 */
export function buildGuardianTodos(
  family: FamilyInfo,
  today: DayRecord,
  alerts: AlertLog[],
  now: Date,
  dateKey: string,
): GuardianTodo[] {
  const byKey = new Map(alerts.map((a) => [a.key ?? a.id, a]))
  const out: GuardianTodo[] = []
  const used = new Set<string>()
  for (const i of findCareIssues(family, today, alerts, now, dateKey)) {
    const a = byKey.get(i.key)
    if (a && guardianSeen(a)) continue // 보호자가 이미 확인한 일 (복지사만 확인했으면 보호자도 확인할 수 있게 남김)
    used.add(i.key)
    out.push({
      key: i.key,
      level: i.level === 'danger' ? 'urgent' : 'warn',
      text: a ? a.reason : i.text,
      at: a?.at,
      alert: a,
    })
  }
  for (const a of alerts) {
    const key = a.key ?? a.id
    if (guardianSeen(a) || used.has(key)) continue
    used.add(key)
    out.push({ key, level: a.kind === 'sos' ? 'urgent' : 'warn', text: a.reason, at: a.at, alert: a })
  }
  const rank = (t: GuardianTodo) => (t.level === 'urgent' ? 0 : 1)
  return out.sort((x, y) => rank(x) - rank(y) || (y.at ?? '').localeCompare(x.at ?? ''))
}
