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
