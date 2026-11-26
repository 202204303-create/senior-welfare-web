/**
 * 시연용 예시 어르신 (복지사 화면 전용).
 *
 * 복지사는 어르신을 몇십 명 맡으므로, 시연 복지사(worker)가 시연 어르신 1명만 보면 큐·등급 정렬을 보여 줄 수 없습니다.
 * 그래서 시연 계정 모드에서만 예시 어르신 7명을 함께 보여 줍니다.
 * - 이름 옆에 '예시' 태그가 붙고, 서버(Firestore)에는 아무것도 읽거나 쓰지 않습니다.
 * - 처리 기록을 저장해도 이 화면에서만 처리된 것처럼 보이고 실제로 저장되지 않습니다.
 * - 계정 로그인 모드(VITE_AUTH_MODE=firebase)에서는 쓰지 않습니다.
 */
import type { AlertLog, DayRecord } from '@/features/care/store/useCareStore'
import type { FamilyInfo } from '@/features/care/api/family'
import type { Assignment } from '@/features/worker/api/assignments'
import type { Grade, OpenIssue, Summary } from '@/features/worker/types'

const PREFIX = 'EXAM'
/** 예시 시각의 기준: 화면을 연 시각 (이후 대기 시간은 실제 시계에 따라 늘어남) */
const OPENED_AT = new Date()

export const isSampleCode = (code: string) => code.startsWith(PREFIX)

interface Sample {
  code: string
  name: string
  dong: string
  tags: string[]
  /** 오늘 몇 시 몇 분에 일어나셨는지 (없으면 아직) */
  wake?: [number, number]
  medDone: number
  medTotal: number
  /** [종류, 등급, 몇 분 전부터, 설명] */
  issues: [OpenIssue['type'], Grade, number, string][]
  /** 마지막 연락이 며칠 전인지 */
  contactDaysAgo?: number
}

const SAMPLES: Sample[] = [
  {
    code: 'EXAM01',
    name: '이순자',
    dong: '황학동',
    tags: ['독거'],
    medDone: 0,
    medTotal: 2,
    issues: [['wake-missed', 'P3', 40, '10:00까지 기상 확인 없음']],
  },
  {
    code: 'EXAM02',
    name: '박말순',
    dong: '중림동',
    tags: ['독거', '당뇨'],
    wake: [7, 10],
    medDone: 1,
    medTotal: 3,
    issues: [
      ['guardian-unacked', 'P2', 95, '보호자 미확인 95분 · 아침 약을 아직 안 드셨어요'],
      ['med-repeat', 'P4', 180, '혈압약 이틀 연속 놓침'],
    ],
  },
  {
    code: 'EXAM03',
    name: '최복동',
    dong: '신당동',
    tags: [],
    medDone: 0,
    medTotal: 1,
    issues: [['no-contact', 'P5', 3 * 1440, '3일째 연락 없음']],
    contactDaysAgo: 3,
  },
  {
    code: 'EXAM04',
    name: '정옥희',
    dong: '신당동',
    tags: [],
    wake: [6, 50],
    medDone: 2,
    medTotal: 2,
    issues: [],
  },
  {
    code: 'EXAM05',
    name: '한만석',
    dong: '황학동',
    tags: ['독거'],
    wake: [7, 30],
    medDone: 1,
    medTotal: 2,
    issues: [],
  },
  {
    code: 'EXAM06',
    name: '윤정자',
    dong: '중림동',
    tags: [],
    wake: [8, 5],
    medDone: 1,
    medTotal: 1,
    issues: [],
  },
  {
    code: 'EXAM07',
    name: '강대식',
    dong: '신당동',
    tags: [],
    wake: [7, 45],
    medDone: 0,
    medTotal: 2,
    issues: [],
  },
]

export const SAMPLE_ASSIGNMENTS: Assignment[] = SAMPLES.map((s) => ({
  code: s.code,
  displayName: s.name,
  dong: s.dong,
  tags: ['예시', ...s.tags],
  pinnedToday: false,
}))

const at = (now: Date, h: number, m: number) => {
  const d = new Date(now)
  d.setHours(h, m, 0, 0)
  return d.toISOString()
}
const minutesAgo = (now: Date, min: number) => new Date(now.getTime() - min * 60_000).toISOString()
const dateKeyOf = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const ORDER: Grade[] = ['P1', 'P2', 'P3', 'P4', 'P5']

/** 서버 요약(summary/current)과 같은 모양의 예시 요약 */
export function sampleSummary(code: string, now: Date = OPENED_AT): Summary | null {
  const s = SAMPLES.find((x) => x.code === code)
  if (!s) return null
  const issues: OpenIssue[] = s.issues
    .map(([type, grade, ago, text]) => ({ type, grade, since: minutesAgo(now, ago), text }))
    .sort((a, b) => ORDER.indexOf(a.grade) - ORDER.indexOf(b.grade))
  const wakeAt = s.wake ? at(now, ...s.wake) : null
  const highest = issues[0]?.grade ?? null
  return {
    dateKey: dateKeyOf(now),
    elderName: s.name,
    elderPhone: null,
    guardianName: '딸',
    lastActionAt: null,
    handledToday: false,
    todayWakeAt: wakeAt,
    todayMedDone: s.medDone,
    todayMedTotal: s.medTotal,
    openIssues: issues,
    openCount: issues.length,
    highestGrade: highest,
    lastContactAt: s.contactDaysAgo ? minutesAgo(now, s.contactDaysAgo * 1440) : wakeAt,
    status: highest === 'P1' || highest === 'P2' ? '위험' : highest ? '관찰' : '정상',
    updatedAt: now.toISOString(),
  }
}

/** 차트(가운데 칸)에 보여 줄 예시 기록 */
export function sampleChart(code: string, now: Date = OPENED_AT) {
  const s = SAMPLES.find((x) => x.code === code)
  if (!s) return null
  const meds = Array.from({ length: s.medTotal }, (_, i) => ({
    id: `${code}-m${i}`,
    name: ['혈압약', '당뇨약', '관절약'][i] ?? `약 ${i + 1}`,
    slot: (['아침', '저녁', '취침 전'] as const)[i] ?? '아침',
    time: ['08:00', '18:30', '21:30'][i] ?? '08:00',
  }))
  const family: FamilyInfo = {
    elderName: s.name,
    elderPhone: '',
    guardianName: '딸',
    medications: meds,
    wakeUpDeadline: '10:00',
    medGraceMinutes: 60,
    lastSeenAt: s.contactDaysAgo ? minutesAgo(now, s.contactDaysAgo * 1440) : minutesAgo(now, 20),
  }
  const today = dateKeyOf(now)
  const days: Record<string, DayRecord> = {}
  // 지난 6일: 평소에는 잘 챙기신 기록. (연락 없는 어르신은 그동안 기록 없음, 약 반복 누락 어르신은 첫 약을 이틀 놓침)
  for (let i = 1; i <= 6; i++) {
    if (s.contactDaysAgo && i < s.contactDaysAgo) continue
    const d = new Date(now.getTime() - i * 86_400_000)
    const skipFirst = s.issues.some(([type]) => type === 'med-repeat') && i <= 2
    days[dateKeyOf(d)] = {
      wakeUpAt: at(d, 7, 10 + i * 3),
      takenMeds: Object.fromEntries(
        meds.filter((_, idx) => !(skipFirst && idx === 0)).map((m) => [m.id, at(d, 8, 20)]),
      ),
    }
  }
  Object.assign(days, {
    [today]: {
      wakeUpAt: s.wake ? at(now, ...s.wake) : undefined,
      takenMeds: Object.fromEntries(meds.slice(0, s.medDone).map((m) => [m.id, at(now, 8, 10)])),
    },
  })
  const alerts: AlertLog[] = s.issues
    .filter(([type]) => type !== 'no-contact' && type !== 'med-repeat')
    .map(([type, , ago, text], i) => ({
      id: `${code}-a${i}`,
      kind: type === 'wake-missed' ? 'wake' : 'med',
      at: minutesAgo(now, ago),
      reason: text,
      channels: ['webpush'],
      recipients: ['보호자'],
    }))
  return { family, days, alerts }
}
