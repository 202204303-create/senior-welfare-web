/**
 * 복지사 화면용 요약(summary)과 에스컬레이션 규칙. (Firebase 없이 시험할 수 있도록 순수 함수 위주)
 *
 * families/{code}/summary 문서를 서버가 만들어 두면, 복지사의 오늘 큐·명단은 이 문서만 읽으면 됩니다.
 * 등급 규칙은 docs/role-interfaces.md 3.1 과 README 2.3 을 따릅니다.
 */
import type { Firestore } from 'firebase-admin/firestore'
import { kstClock, normalizeFamily, toMinutes, type DayDoc, type FamilyDoc } from './care.js'

export type Grade = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
export type IssueType = 'sos' | 'guardian-unacked' | 'wake-missed' | 'med-repeat' | 'no-contact'

/** checked: 전화 없이 '확인했어요' (보호자가 이미 연락했거나 상황을 알고 있을 때). call_ok 처럼 이슈를 닫음 */
export type ActionResult =
  'call_ok' | 'checked' | 'call_no_answer' | 'visit_needed' | 'guardian_notified' | 'other'

/** 복지사가 남긴 처리 기록: families/{code}/actions/{id} (추가만 가능) */
export interface ActionDoc {
  id: string
  at: string
  by?: string
  byName?: string
  type?: '이슈처리' | '상담' | '정정'
  result?: ActionResult
  /** 어떤 이슈를 처리한 기록인지 */
  issueType?: IssueType
  alertId?: string
  note?: string
  followUpAt?: string
  /** 정정 기록: 이 처리 기록(id)을 취소합니다 */
  corrects?: string
}

export interface LastAction {
  result: ActionResult
  at: string
  byName: string
  followUpAt?: string
}

export interface OpenIssue {
  type: IssueType
  grade: Grade
  /** 이슈가 생긴 시각 (ISO). 같은 등급에서 오래 기다린 순으로 정렬하는 기준 */
  since: string
  text: string
  alertId?: string
  /** 이 이슈에 복지사가 남긴 가장 최근 처리 (통화 · 받지 않음 등) */
  lastAction?: LastAction
}

export interface Summary {
  dateKey: string
  /** 큐·명단이 summary 만 읽어도 되도록 어르신 정보를 함께 담습니다 */
  elderName: string
  elderPhone: string | null
  guardianName: string | null
  /** 복지사가 마지막으로 처리한 시각, 오늘 처리한 적이 있는지 */
  lastActionAt: string | null
  handledToday: boolean
  todayWakeAt: string | null
  todayMedDone: number
  todayMedTotal: number
  openIssues: OpenIssue[]
  openCount: number
  highestGrade: Grade | null
  lastContactAt: string | null
  status: '정상' | '관찰' | '위험'
  updatedAt: string
}

export interface AlertDoc {
  id: string
  key?: string
  kind?: 'sos' | 'wake' | 'med'
  reason: string
  at: string
  ackAt?: string
  ackBy?: string
  escalatedAt?: string
}

type FamilyWithSeen = FamilyDoc & { lastSeenAt?: string; elderPhone?: string }
export type Days = Record<string, DayDoc | undefined>

/** 보호자가 이 시간(분) 넘게 확인하지 않으면 복지사에게 올립니다. (팀 결정 전 기본값) */
export const ESCALATE_AFTER_MIN = 30
/** 이 일수 넘게 연락(어르신 활동·복지사 처리)이 없으면 "연락 필요" (팀 결정 전 기본값) */
export const CONTACT_GAP_DAYS = 3
const ALERT_KEEP_MS = 24 * 60 * 60 * 1000
const GRADE_ORDER: Grade[] = ['P1', 'P2', 'P3', 'P4', 'P5']

const dayKeyOf = (iso: string) => kstClock(new Date(iso)).dateKey

/**
 * 알림이 이미 해결됐는지: 기상 알림은 그날 기상 확인이 생겼을 때, 약 알림은 그 약을 드셨을 때.
 * (키 형식: YYYY-MM-DD-wake, YYYY-MM-DD-med-약id)
 */
export function isResolved(alert: AlertDoc, days: Days) {
  const key = alert.key ?? ''
  const date = key.slice(0, 10)
  const day = days[date]
  if (!day) return false
  if (key.endsWith('-wake')) return Boolean(day.wakeUpAt)
  const m = key.match(/^\d{4}-\d{2}-\d{2}-med-(.+)$/)
  if (m) return Boolean(day.takenMeds?.[m[1]])
  return false
}

/** 보호자가 확인하지 않은 알림 중 에스컬레이션(복지사 알림) 대상 */
export function findEscalations(
  alerts: AlertDoc[],
  now: Date,
  days: Days,
  minutes = ESCALATE_AFTER_MIN,
): AlertDoc[] {
  return alerts.filter((a) => {
    if (a.kind === 'sos' || a.ackAt || a.escalatedAt) return false // 긴급은 처음부터 복지사에게 감
    const age = now.getTime() - new Date(a.at).getTime()
    return age >= minutes * 60_000 && age < ALERT_KEEP_MS && !isResolved(a, days)
  })
}

function addedTooLateToday(med: FamilyDoc['medications'][number], grace: number, now: Date) {
  if (!med.createdAt) return false
  const created = kstClock(new Date(med.createdAt))
  const today = kstClock(now)
  return created.dateKey === today.dateKey && created.minutes > toMinutes(med.time) + grace
}

export interface BuildInput {
  family: FamilyWithSeen
  days: Days
  alerts: AlertDoc[]
  /** 최근 48시간의 복지사 처리 기록 */
  actions?: ActionDoc[]
  now: Date
  escalateMin?: number
  gapDays?: number
}

export function buildSummary({
  family,
  days,
  alerts,
  actions = [],
  now,
  escalateMin = ESCALATE_AFTER_MIN,
  gapDays = CONTACT_GAP_DAYS,
}: BuildInput): Summary {
  const { dateKey, minutes } = kstClock(now)
  const yesterdayKey = kstClock(new Date(now.getTime() - 86_400_000)).dateKey
  const today = days[dateKey]
  const yesterday = days[yesterdayKey]
  const taken = today?.takenMeds ?? {}
  const meds = (family.medications ?? []).filter((m) => !addedTooLateToday(m, family.medGraceMinutes, now))
  const issues: OpenIssue[] = []

  // 정정 기록이 가리키는 처리와 정정 기록 자체는 빼고 봅니다.
  const corrected = new Set(
    actions.filter((a) => a.type === '정정' && a.corrects).map((a) => a.corrects as string),
  )
  const effective = actions
    .filter((a) => a.type !== '정정' && !corrected.has(a.id) && a.result)
    .sort((a, b) => b.at.localeCompare(a.at))
  const lastActionAt = effective[0]?.at
  const toLast = (a: ActionDoc | undefined): LastAction | undefined =>
    a && a.result
      ? { result: a.result, at: a.at, byName: a.byName ?? '복지사', followUpAt: a.followUpAt }
      : undefined
  // 같은 이슈(알림 또는 이슈 종류)에 대한 가장 최근 처리
  const actionFor = (type: IssueType, alertId?: string) =>
    effective.find((a) => (alertId && a.alertId === alertId) || (!alertId && a.issueType === type))
  // 통화로 이상 없음을 확인한 처리는 그 이후의 이슈를 닫습니다. (이슈가 생긴 시각 이후의 처리만)
  const closedByAction = (type: IssueType, since: string, alertId?: string) => {
    const a = actionFor(type, alertId)
    return Boolean(a && (a.result === 'call_ok' || a.result === 'checked') && a.at >= since)
  }

  // P1 긴급: 아직 아무도 확인하지 않은 긴급 요청 (24시간 안)
  // P2 에스컬레이션: 보호자가 N분 넘게 확인하지 않은 기상·복약 알림 (해결되면 제외)
  for (const a of alerts) {
    if (a.ackAt) continue
    const age = now.getTime() - new Date(a.at).getTime()
    if (age >= ALERT_KEEP_MS) continue
    if (a.kind === 'sos') {
      if (closedByAction('sos', a.at, a.id)) continue
      issues.push({
        type: 'sos',
        grade: 'P1',
        since: a.at,
        text: '긴급 도움 요청',
        alertId: a.id,
        lastAction: toLast(actionFor('sos', a.id)),
      })
    } else if (age >= escalateMin * 60_000 && !isResolved(a, days)) {
      if (closedByAction('guardian-unacked', a.at, a.id)) continue
      issues.push({
        type: 'guardian-unacked',
        grade: 'P2',
        since: a.at,
        text: `보호자 미확인 ${Math.floor(age / 60_000)}분 · ${a.reason}`,
        alertId: a.id,
        lastAction: toLast(actionFor('guardian-unacked', a.id)),
      })
    }
  }

  // P3 기상 미확인
  if (!today?.wakeUpAt && minutes > toMinutes(family.wakeUpDeadline)) {
    const since = new Date(`${dateKey}T${family.wakeUpDeadline}:00+09:00`).toISOString()
    if (!closedByAction('wake-missed', since)) {
      issues.push({
        type: 'wake-missed',
        grade: 'P3',
        since,
        text: `${family.wakeUpDeadline}까지 기상 확인 없음`,
        lastAction: toLast(actionFor('wake-missed')),
      })
    }
  }

  // P4 복약 반복 놓침: 어제 기록이 있는데 어제도 안 드셨고 오늘도 시간이 지난 약
  if (yesterday) {
    for (const m of meds) {
      const createdBeforeYesterday = !m.createdAt || dayKeyOf(m.createdAt) < yesterdayKey
      const missedToday = !taken[m.id] && minutes > toMinutes(m.time) + family.medGraceMinutes
      if (createdBeforeYesterday && missedToday && !yesterday.takenMeds?.[m.id]) {
        const since = new Date(`${dateKey}T${m.time}:00+09:00`).toISOString()
        if (!closedByAction('med-repeat', since)) {
          issues.push({
            type: 'med-repeat',
            grade: 'P4',
            since,
            text: `${m.name} 이틀 연속 놓침`,
            lastAction: toLast(actionFor('med-repeat')),
          })
        }
      }
    }
  }

  // 마지막 연락: 어르신 앱 사용·기상·복용·보호자/복지사 확인·복지사 처리 중 가장 늦은 시각
  const times: string[] = []
  if (family.lastSeenAt) times.push(family.lastSeenAt)
  if (lastActionAt) times.push(lastActionAt)
  for (const d of [today, yesterday]) {
    if (d?.wakeUpAt) times.push(d.wakeUpAt)
    for (const t of Object.values(d?.takenMeds ?? {})) times.push(t)
  }
  for (const a of alerts) if (a.ackAt) times.push(a.ackAt)
  const lastContactAt = times.length ? times.reduce((a, b) => (a > b ? a : b)) : null

  // P5 연락 공백
  if (lastContactAt && now.getTime() - new Date(lastContactAt).getTime() >= gapDays * 86_400_000) {
    issues.push({
      type: 'no-contact',
      grade: 'P5',
      since: lastContactAt,
      text: `${Math.floor((now.getTime() - new Date(lastContactAt).getTime()) / 86_400_000)}일째 연락 없음`,
      lastAction: toLast(actionFor('no-contact')),
    })
  }

  issues.sort(
    (a, b) => GRADE_ORDER.indexOf(a.grade) - GRADE_ORDER.indexOf(b.grade) || a.since.localeCompare(b.since),
  )
  const highestGrade = issues[0]?.grade ?? null

  return {
    dateKey,
    elderName: family.elderName,
    elderPhone: family.elderPhone ?? null,
    guardianName: family.guardianName ?? null,
    lastActionAt: lastActionAt ?? null,
    handledToday: Boolean(lastActionAt && dayKeyOf(lastActionAt) === dateKey),
    todayWakeAt: today?.wakeUpAt ?? null,
    todayMedDone: meds.filter((m) => taken[m.id]).length,
    todayMedTotal: meds.length,
    openIssues: issues,
    openCount: issues.length,
    highestGrade,
    lastContactAt,
    status: highestGrade === 'P1' || highestGrade === 'P2' ? '위험' : highestGrade ? '관찰' : '정상',
    updatedAt: now.toISOString(),
  }
}

export interface Snapshot {
  family: FamilyWithSeen
  days: Days
  alerts: AlertDoc[]
  actions: ActionDoc[]
}

/** 가족 한 곳의 요약에 필요한 문서(오늘·어제 기록, 최근 48시간 알림)를 읽습니다. */
export async function readSnapshot(
  db: Firestore,
  code: string,
  now: Date,
  family?: FamilyWithSeen,
): Promise<Snapshot | null> {
  const ref = db.collection('families').doc(code)
  const { dateKey } = kstClock(now)
  const yesterdayKey = kstClock(new Date(now.getTime() - 86_400_000)).dateKey
  const since = new Date(now.getTime() - 2 * 86_400_000).toISOString()
  const [famSnap, todaySnap, ySnap, alertSnap, actionSnap] = await Promise.all([
    family ? Promise.resolve(null) : ref.get(),
    ref.collection('days').doc(dateKey).get(),
    ref.collection('days').doc(yesterdayKey).get(),
    ref.collection('alerts').where('at', '>=', since).get(),
    ref.collection('actions').where('at', '>=', since).get(),
  ])
  const fam = normalizeFamily(family ?? (famSnap?.exists ? (famSnap.data() as FamilyWithSeen) : undefined))
  if (!fam) return null
  return {
    family: fam,
    days: {
      [dateKey]: todaySnap.exists ? (todaySnap.data() as DayDoc) : undefined,
      [yesterdayKey]: ySnap.exists ? (ySnap.data() as DayDoc) : undefined,
    },
    alerts: alertSnap.docs.map((d) => ({ ...(d.data() as AlertDoc), id: d.id })),
    actions: actionSnap.docs.map((d) => ({ ...(d.data() as ActionDoc), id: d.id })),
  }
}

/** undefined 값을 뺀 복사본 (Firestore 는 undefined 를 저장하지 못함) */
export function withoutUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 요약을 새로 계산해 families/{code}/summary 에 저장합니다. 알림 쪽 실패와 상관없이 부르도록 오류는 삼킵니다. */
export async function refreshSummary(
  db: Firestore,
  code: string,
  now = new Date(),
  snapshot?: Snapshot | null,
): Promise<Summary | null> {
  try {
    const snap = snapshot ?? (await readSnapshot(db, code, now))
    if (!snap) return null
    const summary = buildSummary({ ...snap, now })
    // 비어 있는 값(undefined, 예: 아직 처리 기록이 없는 이슈의 lastAction)은 Firestore 가 저장을 거절하므로 빼고 저장합니다.
    // (이것 때문에 요약이 하나도 저장되지 않던 문제: 점검 결과 summaries: 0)
    await db
      .collection('families')
      .doc(code)
      .collection('summary')
      .doc('current')
      .set(withoutUndefined(summary))
    return summary
  } catch (e) {
    console.log(
      JSON.stringify({ summary: 'failed', code, error: String((e as Error).message).slice(0, 200) }),
    )
    return null
  }
}
