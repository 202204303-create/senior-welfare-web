import type { DayRecord } from '@/features/care/store/useCareStore'

export interface Checkin {
  kind: 'wake' | 'med'
  medId?: string
}

/** 이전 기록과 비교해 새로 생긴 기상 확인·복용 체크를 찾습니다. (복용 취소는 제외) */
export function newCheckins(prev: DayRecord | undefined, next: DayRecord): Checkin[] {
  const out: Checkin[] = []
  if (next.wakeUpAt && !prev?.wakeUpAt) out.push({ kind: 'wake' })
  for (const id of Object.keys(next.takenMeds)) {
    if (!prev?.takenMeds?.[id]) out.push({ kind: 'med', medId: id })
  }
  return out
}
