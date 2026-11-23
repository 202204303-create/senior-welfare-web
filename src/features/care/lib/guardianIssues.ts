import type { FamilyInfo } from '@/features/care/api/family'
import { getMedStatus } from '@/features/care/hooks/useCareWatcher'
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
      level: 'danger',
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
