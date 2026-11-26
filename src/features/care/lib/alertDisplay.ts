import type { AlertLog } from '@/features/care/store/useCareStore'

/** 알림 단계: 긴급(SOS) · 확인 필요(기상·복약 미확인 등). 어르신·보호자 화면이 같은 기준을 씁니다. */
export type AlertLevel = 'urgent' | 'warn'

export const alertLevelOf = (a: Pick<AlertLog, 'kind'>): AlertLevel => (a.kind === 'sos' ? 'urgent' : 'warn')

/** 오늘이면 '오전 8:05', 아니면 '11월 25일 오전 8:05' */
export function alertTime(iso: string, now = new Date()) {
  const d = new Date(iso)
  const sameDay = d.toDateString() === now.toDateString()
  return sameDay
    ? d.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })
    : d.toLocaleString('ko-KR', { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

/** 복지사 화면의 확인 이름 (worker/api/actions.ts 의 WORKER_NAME 과 같음) */
const WORKER_ACK_NAME = '담당 사회복지사'

/**
 * 보호자가 이 알림을 직접 확인했는지.
 * 예전 기록(보호자 확인 칸이 따로 없던 때)은 확인한 사람이 복지사가 아니면 보호자 확인으로 봅니다.
 */
export const guardianSeen = (a: Pick<AlertLog, 'ackAt' | 'ackBy' | 'guardianAckAt'>) =>
  Boolean(a.guardianAckAt) || (Boolean(a.ackAt) && a.ackBy !== WORKER_ACK_NAME)

/** 복지사가 먼저 확인했고 보호자는 아직인 알림 */
export const workerOnlyAck = (a: Pick<AlertLog, 'ackAt' | 'ackBy' | 'guardianAckAt'>) =>
  Boolean(a.ackAt) && !guardianSeen(a)
