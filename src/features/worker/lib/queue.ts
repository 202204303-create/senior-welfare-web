/**
 * 복지사 "오늘 큐"를 만드는 순수 함수. (화면·Firebase 없이 시험할 수 있도록 상대 경로 import 만 씁니다)
 * 규칙: docs/role-interfaces.md 3.1 — 등급 높은 순 → 같은 등급이면 오래 기다린 순, 같은 어르신의 이슈는 한 카드로.
 */
import type { ActionResult, Grade, IssueType, OpenIssue, Overlay, QueueRow, Summary } from '../types'

export const GRADES: Grade[] = ['P1', 'P2', 'P3', 'P4', 'P5']

export const GRADE_LABEL: Record<Grade, string> = {
  P1: '긴급',
  P2: '보호자 미확인',
  P3: '기상 미확인',
  P4: '복약 누락 반복',
  P5: '연락 필요',
}

export const RESULT_LABEL: Record<ActionResult, string> = {
  call_ok: '통화 · 이상 없음',
  checked: '확인했어요',
  call_no_answer: '통화 · 받지 않음',
  visit_needed: '방문 필요',
  guardian_notified: '보호자에게 전달',
  other: '기타',
}

export interface QueueCard {
  row: QueueRow
  summary: Summary
  issues: OpenIssue[]
  /** 이 어르신의 가장 높은 등급, 그 등급에서 가장 오래 기다린 이슈의 시각 */
  grade: Grade
  since: string
}

export interface QueueView {
  cards: QueueCard[]
  /** 이슈가 없는 어르신 */
  normal: { row: QueueRow; summary: Summary }[]
  /** 아직 요약이 없는 어르신 */
  waiting: QueueRow[]
  /** 등급별로 그 등급 이슈가 있는 어르신 수 */
  counts: Record<Grade, number>
  /** 오늘 관리 대상(이슈가 있거나, 오늘 처리했거나, "오늘 챙기기"로 고정)과 그중 이슈가 없어진 수 */
  managed: number
  done: number
}

const gradeIndex = (g: Grade) => GRADES.indexOf(g)

/** 방금 남긴 처리가 서버 요약보다 새로우면, 요약이 따라잡기 전까지 화면에 먼저 반영합니다. */
export function applyOverlay(summary: Summary, overlay: Overlay | undefined): Summary {
  if (!overlay || summary.updatedAt >= overlay.at) return summary
  const closed = (i: OpenIssue) =>
    overlay.closed.some((c) => c.type === i.type && (c.alertId === undefined || c.alertId === i.alertId))
  const openIssues = summary.openIssues
    .filter((i) => !closed(i))
    .map((i) => ({
      ...i,
      lastAction: {
        result: overlay.result,
        at: overlay.at,
        byName: overlay.byName,
        followUpAt: overlay.followUpAt,
      },
    }))
  const highestGrade = openIssues[0]?.grade ?? null
  return {
    ...summary,
    openIssues,
    openCount: openIssues.length,
    highestGrade,
    status: highestGrade === 'P1' || highestGrade === 'P2' ? '위험' : highestGrade ? '관찰' : '정상',
    lastActionAt: overlay.at,
    handledToday: true,
  }
}

export function buildQueue(rows: QueueRow[], overlays: Record<string, Overlay> = {}): QueueView {
  const cards: QueueCard[] = []
  const normal: QueueView['normal'] = []
  const waiting: QueueRow[] = []
  const counts: Record<Grade, number> = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 }
  let managed = 0
  let done = 0

  for (const row of rows) {
    if (!row.summary) {
      waiting.push(row)
      continue
    }
    const summary = applyOverlay(row.summary, overlays[row.code])
    const issues = [...summary.openIssues].sort(
      (a, b) => gradeIndex(a.grade) - gradeIndex(b.grade) || a.since.localeCompare(b.since),
    )
    for (const g of GRADES) if (issues.some((i) => i.grade === g)) counts[g]++

    if (issues.length) {
      managed++
      const top = issues[0]
      cards.push({ row, summary, issues, grade: top.grade, since: top.since })
    } else {
      normal.push({ row, summary })
      if (summary.handledToday || row.pinnedToday) {
        managed++
        done++
      }
    }
  }

  cards.sort((a, b) => gradeIndex(a.grade) - gradeIndex(b.grade) || a.since.localeCompare(b.since))
  normal.sort((a, b) => a.row.displayName.localeCompare(b.row.displayName, 'ko'))
  return { cards, normal, waiting, counts, managed, done }
}

/** 특정 등급 이슈가 있는 어르신만 (null 이면 전체) */
export function filterByGrade(cards: QueueCard[], grade: Grade | null) {
  return grade ? cards.filter((c) => c.issues.some((i) => i.grade === grade)) : cards
}

/** "8분째", "2시간째", "3일째" */
export function waitLabel(since: string, now: Date) {
  const min = Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / 60_000))
  if (min < 1) return '방금'
  if (min < 60) return `${min}분째`
  if (min < 24 * 60) return `${Math.floor(min / 60)}시간째`
  return `${Math.floor(min / (24 * 60))}일째`
}

/** 처리 결과로 닫히는 이슈 (통화 · 이상 없음만 이슈를 닫습니다) */
export function issuesClosedBy(
  result: ActionResult,
  issues: OpenIssue[],
): { type: IssueType; alertId?: string }[] {
  return result === 'call_ok' || result === 'checked'
    ? issues.map((i) => ({ type: i.type, alertId: i.alertId }))
    : []
}
