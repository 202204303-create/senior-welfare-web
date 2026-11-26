// 실행: npm run test:web — 복지사 오늘 큐 규칙 시험 (화면·Firebase 없이)
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyOverlay, buildQueue, filterByGrade, issuesClosedBy, waitLabel } from './queue.ts'
import type { Grade, OpenIssue, QueueRow, Summary } from '../types.ts'

const T = (hhmm: string) => `2026-11-26T${hhmm}:00+09:00`
const issue = (grade: Grade, since: string, extra: Partial<OpenIssue> = {}): OpenIssue => ({
  type: grade === 'P1' ? 'sos' : grade === 'P3' ? 'wake-missed' : 'guardian-unacked',
  grade,
  since: T(since),
  text: `${grade} 이슈`,
  ...extra,
})
const summary = (issues: OpenIssue[], extra: Partial<Summary> = {}): Summary => ({
  dateKey: '2026-11-26',
  elderName: '어르신',
  elderPhone: null,
  guardianName: null,
  lastActionAt: null,
  handledToday: false,
  todayWakeAt: null,
  todayMedDone: 0,
  todayMedTotal: 0,
  openIssues: issues,
  openCount: issues.length,
  highestGrade: issues[0]?.grade ?? null,
  lastContactAt: null,
  status: '정상',
  updatedAt: T('09:00'),
  ...extra,
})
const row = (code: string, name: string, s: Summary | null, extra: Partial<QueueRow> = {}): QueueRow => ({
  code,
  displayName: name,
  dong: '',
  tags: [],
  pinnedToday: false,
  summary: s,
  ...extra,
})

test('등급 높은 순, 같은 등급이면 오래 기다린 순으로 정렬한다', () => {
  const q = buildQueue([
    row('A', '가', summary([issue('P3', '10:00')])),
    row('B', '나', summary([issue('P1', '10:40')])),
    row('C', '다', summary([issue('P1', '10:20')])),
    row('D', '라', summary([issue('P2', '09:00')])),
  ])
  assert.deepEqual(
    q.cards.map((c) => c.row.code),
    ['C', 'B', 'D', 'A'],
  )
})

test('같은 어르신의 이슈는 한 카드로 묶고, 가장 높은 등급과 그 등급에서 가장 오래된 시각을 쓴다', () => {
  const q = buildQueue([
    row(
      'A',
      '가',
      summary([issue('P3', '10:00'), issue('P1', '10:30'), issue('P1', '10:10', { alertId: 'x' })]),
    ),
  ])
  assert.equal(q.cards.length, 1)
  assert.equal(q.cards[0].grade, 'P1')
  assert.equal(q.cards[0].since, T('10:10'))
  assert.deepEqual(
    q.cards[0].issues.map((i) => i.grade),
    ['P1', 'P1', 'P3'],
  )
})

test('이슈가 없는 어르신은 정상 목록으로, 요약이 아직 없으면 준비 중으로 나눈다', () => {
  const q = buildQueue([
    row('A', '다', summary([])),
    row('B', '가', summary([])),
    row('C', '나', null),
    row('D', '라', summary([issue('P3', '10:00')])),
  ])
  assert.deepEqual(
    q.normal.map((n) => n.row.displayName),
    ['가', '다'],
  )
  assert.deepEqual(
    q.waiting.map((r) => r.code),
    ['C'],
  )
  assert.equal(q.cards.length, 1)
})

test('등급별 개수는 그 등급 이슈가 있는 어르신 수이고, 등급으로 거를 수 있다', () => {
  const q = buildQueue([
    row('A', '가', summary([issue('P1', '10:00'), issue('P3', '10:00')])),
    row('B', '나', summary([issue('P3', '10:00')])),
    row('C', '다', summary([issue('P2', '10:00')])),
  ])
  assert.deepEqual(q.counts, { P1: 1, P2: 1, P3: 2, P4: 0, P5: 0 })
  assert.deepEqual(
    filterByGrade(q.cards, 'P3')
      .map((c) => c.row.code)
      .sort(),
    ['A', 'B'],
  )
  assert.equal(filterByGrade(q.cards, null).length, 3)
})

test('오늘 관리 대상: 이슈가 있거나 오늘 처리했거나 "오늘 챙기기"로 고정한 어르신. 이슈가 없어지면 처리 완료', () => {
  const q = buildQueue([
    row('A', '가', summary([issue('P1', '10:00')])), // 관리 대상, 미완료
    row('B', '나', summary([], { handledToday: true })), // 관리 대상, 완료
    row('C', '다', summary([]), { pinnedToday: true }), // 관리 대상, 완료
    row('D', '라', summary([])), // 관리 대상 아님
  ])
  assert.equal(q.managed, 3)
  assert.equal(q.done, 2)
})

test('방금 남긴 처리는 요약이 따라잡기 전까지 화면에 먼저 반영하고, 따라잡으면 요약을 따른다', () => {
  const s = summary([issue('P1', '10:00'), issue('P3', '10:00')])
  const overlay = {
    at: T('10:30'),
    result: 'call_ok' as const,
    byName: '담당 사회복지사',
    closed: [{ type: 'sos' as const }],
  }
  const shown = applyOverlay(s, overlay)
  assert.deepEqual(
    shown.openIssues.map((i) => i.grade),
    ['P3'],
  )
  assert.equal(shown.openIssues[0].lastAction?.result, 'call_ok')
  assert.equal(shown.handledToday, true)
  assert.equal(shown.status, '관찰')
  // 서버 요약이 처리 시각 이후에 갱신되면 요약을 그대로 씀
  const fresh = summary([issue('P3', '10:00')], { updatedAt: T('10:31') })
  assert.equal(applyOverlay(fresh, overlay), fresh)
  // 큐에도 반영
  const q = buildQueue([row('A', '가', s)], { A: overlay })
  assert.equal(q.cards[0].grade, 'P3')
})

test('통화 · 이상 없음만 이슈를 닫는다', () => {
  const issues = [issue('P1', '10:00', { alertId: 'a1' }), issue('P3', '10:00')]
  assert.deepEqual(issuesClosedBy('call_ok', issues), [
    { type: 'sos', alertId: 'a1' },
    { type: 'wake-missed', alertId: undefined },
  ])
  for (const r of ['call_no_answer', 'visit_needed', 'guardian_notified', 'other'] as const) {
    assert.deepEqual(issuesClosedBy(r, issues), [])
  }
})

test('기다린 시간 표시', () => {
  const now = new Date(T('12:00'))
  assert.equal(waitLabel(T('11:59:30'.slice(0, 5)), now), '1분째')
  assert.equal(waitLabel(T('11:52'), now), '8분째')
  assert.equal(waitLabel(T('09:00'), now), '3시간째')
  assert.equal(waitLabel('2026-11-23T12:00:00+09:00', now), '3일째')
  assert.equal(waitLabel(T('12:00'), now), '방금')
})
