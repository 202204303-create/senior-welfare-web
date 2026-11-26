/**
 * 서버에서 쓰는 안부·복약 판단 규칙. (Firebase 없이 시험할 수 있도록 순수 함수로만 작성)
 * 화면 쪽 규칙(src/features/care/hooks/useCareWatcher.ts, useCareReminder.ts)과 같게 맞춥니다.
 */

export interface Medication {
  id: string
  name: string
  slot: string
  time: string // HH:mm
  createdAt?: string
}

export interface FamilyDoc {
  elderName: string
  guardianName: string
  medications: Medication[]
  wakeUpDeadline: string // HH:mm
  medGraceMinutes: number
}

export interface DayDoc {
  wakeUpAt?: string | null
  takenMeds?: Record<string, string>
}

export interface GuardianAlert {
  key: string
  kind: 'wake' | 'med'
  reason: string
}

export interface ElderReminder {
  key: string
  body: string
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/
const validIso = (v: unknown): v is string => typeof v === 'string' && !Number.isNaN(Date.parse(v))

/**
 * Firestore 에서 읽은 가족 문서를 안전한 모양으로 고칩니다.
 * 설정이 덜 된 가족(예: 마지막 사용 시각만 있는 문서)이나 예전 형식의 문서 때문에
 * 서버 점검 전체가 멈추지 않도록, 확인에 필요한 값이 없으면 null 을 돌려줍니다.
 */
export function normalizeFamily<T extends object>(raw: T | undefined | null): (T & FamilyDoc) | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const meds = Array.isArray(r.medications) ? r.medications : []
  const medications: Medication[] = meds
    .filter(
      (m): m is Medication =>
        !!m &&
        typeof m === 'object' &&
        typeof (m as Medication).id === 'string' &&
        HHMM.test(String((m as Medication).time)),
    )
    .map((m) => ({ ...m, createdAt: validIso(m.createdAt) ? m.createdAt : undefined }))
  const wakeUpDeadline =
    typeof r.wakeUpDeadline === 'string' && HHMM.test(r.wakeUpDeadline) ? r.wakeUpDeadline : null
  // 기상 시간도 약도 없으면 아직 설정 전인 가족으로 보고 건너뜁니다.
  if (!wakeUpDeadline && medications.length === 0) return null
  const grace = Number(r.medGraceMinutes)
  return {
    ...raw,
    elderName: typeof r.elderName === 'string' && r.elderName ? r.elderName : '어르신',
    guardianName: typeof r.guardianName === 'string' ? r.guardianName : '보호자',
    medications,
    wakeUpDeadline: wakeUpDeadline ?? '10:00',
    medGraceMinutes: Number.isFinite(grace) && grace > 0 ? grace : 60,
    lastSeenAt: validIso(r.lastSeenAt) ? r.lastSeenAt : undefined,
  } as T & FamilyDoc
}

/** 한국 시간 기준 날짜(YYYY-MM-DD)와 0시부터 지난 분 */
export function kstClock(now: Date): { dateKey: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00'
  return {
    dateKey: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  }
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

/** 오늘 복용 시각이 지난 뒤 등록·변경한 약은 오늘은 챙기지 않습니다. (화면의 '내일부터') */
function addedTooLateToday(med: Medication, grace: number, now: Date) {
  if (!med.createdAt) return false
  const created = kstClock(new Date(med.createdAt))
  const today = kstClock(now)
  return created.dateKey === today.dateKey && created.minutes > toMinutes(med.time) + grace
}

/**
 * 보호자에게 알릴 일: 기상 마감이 지났는데 기상 확인이 없음 / 복용 시각 + 여유 시간이 지났는데 체크 안 함.
 * alreadyKeys: 이미 만들어진 알림 키(어르신 앱이 먼저 만들었을 수도 있음)
 */
export function findGuardianAlerts(
  family: FamilyDoc,
  day: DayDoc | undefined,
  now: Date,
  alreadyKeys: Set<string>,
): GuardianAlert[] {
  const { dateKey, minutes } = kstClock(now)
  const taken = day?.takenMeds ?? {}
  const out: GuardianAlert[] = []

  const wakeKey = `${dateKey}-wake`
  if (!day?.wakeUpAt && minutes > toMinutes(family.wakeUpDeadline) && !alreadyKeys.has(wakeKey)) {
    out.push({
      key: wakeKey,
      kind: 'wake',
      reason: `${family.elderName} 님이 ${family.wakeUpDeadline}까지 기상 확인을 하지 않으셨어요.`,
    })
  }

  for (const med of family.medications ?? []) {
    const key = `${dateKey}-med-${med.id}`
    if (taken[med.id] || alreadyKeys.has(key) || addedTooLateToday(med, family.medGraceMinutes, now)) continue
    if (minutes > toMinutes(med.time) + family.medGraceMinutes) {
      out.push({
        key,
        kind: 'med',
        reason: `${family.elderName} 님이 ${med.slot} 약(${med.name})을 아직 드시지 않았어요.`,
      })
    }
  }
  return out
}

/** 어르신께 드릴 약 안내: 복용 시각 ~ 여유 시간 안이고 아직 체크하지 않은 약 */
export function findElderReminders(
  family: FamilyDoc,
  day: DayDoc | undefined,
  now: Date,
  alreadyKeys: Set<string>,
): ElderReminder[] {
  const { dateKey, minutes } = kstClock(now)
  const taken = day?.takenMeds ?? {}
  const out: ElderReminder[] = []
  for (const med of family.medications ?? []) {
    const key = `${dateKey}-remind-${med.id}`
    const t = toMinutes(med.time)
    if (taken[med.id] || alreadyKeys.has(key)) continue
    if (minutes >= t && minutes <= t + family.medGraceMinutes) {
      out.push({ key, body: `${med.name} 드실 시간이에요. 드신 뒤 늘봄에서 '먹었어요'를 눌러 주세요.` })
    }
  }
  return out
}
