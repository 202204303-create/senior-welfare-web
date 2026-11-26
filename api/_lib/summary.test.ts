// 실행: npm run test:api — 복지사용 요약(summary)과 에스컬레이션을 메모리 저장소로 시험합니다.
import { beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import type { Firestore } from 'firebase-admin/firestore'
import type { Messaging } from 'firebase-admin/messaging'
import { runCheck } from './checkJob.ts'
import { sendAlertPush } from '../notify.ts'
import { sendCheckinPush } from '../notify-checkin.ts'
import { FakeDb, FakeMessaging } from './fakeFirestore.ts'
import {
  buildSummary,
  findEscalations,
  isResolved,
  refreshSummary,
  type ActionDoc,
  type AlertDoc,
} from './summary.ts'
import { refreshForWorker } from '../refresh-summary.ts'

const CODE = 'ABC234'
const kst = (hhmm: string, date = '2026-11-17') => new Date(`${date}T${hhmm}:00+09:00`)
const iso = (hhmm: string, date = '2026-11-17') => kst(hhmm, date).toISOString()

const family = {
  elderName: '김영수',
  guardianName: '김민지 (딸)',
  wakeUpDeadline: '10:00',
  medGraceMinutes: 60,
  medications: [
    { id: 'm-1', name: '혈압약', slot: '아침', time: '08:00' },
    { id: 'm-2', name: '영양제', slot: '점심', time: '12:30' },
  ],
}
const sos = (at: string, extra: Partial<AlertDoc> = {}): AlertDoc => ({
  id: 'a-sos',
  kind: 'sos',
  reason: '긴급 도움 요청',
  at,
  ...extra,
})
const wakeAlert = (at: string, extra: Partial<AlertDoc> = {}): AlertDoc => ({
  id: 'a-wake',
  key: '2026-11-17-wake',
  kind: 'wake',
  reason: '기상 확인 없음',
  at,
  ...extra,
})
const build = (now: string, over: Partial<Parameters<typeof buildSummary>[0]> = {}) =>
  buildSummary({ family, days: {}, alerts: [], now: kst(now), ...over })

test('이슈가 없고 기상·약을 모두 확인하면 "정상"', () => {
  const s = build('13:00', {
    days: {
      '2026-11-17': { wakeUpAt: iso('07:30'), takenMeds: { 'm-1': iso('08:05'), 'm-2': iso('12:35') } },
    },
    family: { ...family, lastSeenAt: iso('12:50') } as never,
  })
  assert.equal(s.status, '정상')
  assert.equal(s.highestGrade, null)
  assert.equal(s.openCount, 0)
  assert.equal(s.todayWakeAt, iso('07:30'))
  assert.deepEqual([s.todayMedDone, s.todayMedTotal], [2, 2])
  assert.equal(s.lastContactAt, iso('12:50'))
})

test('P1: 아직 확인하지 않은 긴급 요청은 "위험", 누군가 확인하면 사라진다', () => {
  const open = build('11:00', { alerts: [sos(iso('10:50'))] })
  assert.equal(open.highestGrade, 'P1')
  assert.equal(open.status, '위험')
  assert.equal(open.openIssues[0].type, 'sos')
  const acked = build('11:00', {
    alerts: [sos(iso('10:50'), { ackAt: iso('10:55'), ackBy: '담당 사회복지사' })],
  })
  assert.equal(
    acked.openIssues.some((i) => i.type === 'sos'),
    false,
  )
})

test('P2: 보호자가 30분 넘게 확인하지 않은 기상 알림, 기상 확인이 생기면 해결로 본다', () => {
  const before = build('10:25', { alerts: [wakeAlert(iso('10:00'))] })
  assert.equal(
    before.openIssues.some((i) => i.type === 'guardian-unacked'),
    false,
    '30분 전에는 올리지 않음',
  )
  const after = build('10:35', { alerts: [wakeAlert(iso('10:00'))] })
  assert.equal(after.openIssues.find((i) => i.grade === 'P2')?.alertId, 'a-wake')
  const resolved = build('10:35', {
    alerts: [wakeAlert(iso('10:00'))],
    days: { '2026-11-17': { wakeUpAt: iso('10:20'), takenMeds: {} } },
  })
  assert.equal(
    resolved.openIssues.some((i) => i.type === 'guardian-unacked'),
    false,
  )
})

test('P3: 기상 마감이 지났는데 기상 확인이 없으면 "관찰"', () => {
  const s = build('10:05')
  assert.equal(s.openIssues[0].type, 'wake-missed')
  assert.equal(s.highestGrade, 'P3')
  assert.equal(s.status, '관찰')
})

test('P4: 어제 기록이 있는데 어제도 오늘도 놓친 약만 "반복 놓침", 어제 기록이 없으면 세지 않는다', () => {
  const today = { wakeUpAt: iso('07:30'), takenMeds: {} }
  const noYesterday = build('09:30', { days: { '2026-11-17': today } })
  assert.equal(
    noYesterday.openIssues.some((i) => i.type === 'med-repeat'),
    false,
  )
  const s = build('09:30', {
    days: {
      '2026-11-17': today,
      '2026-11-16': { wakeUpAt: iso('07:30', '2026-11-16'), takenMeds: { 'm-2': 'x' } },
    },
  })
  const repeats = s.openIssues.filter((i) => i.type === 'med-repeat')
  assert.equal(repeats.length, 1) // m-1 만 어제도 놓침
  assert.match(repeats[0].text, /혈압약/)
})

test('P5: 3일 넘게 연락이 없으면 "연락 필요", 복지사 처리 기록도 연락으로 본다', () => {
  const fam = { ...family, lastSeenAt: iso('09:00', '2026-11-13') } as never
  const s = build('09:30', {
    family: fam,
    days: { '2026-11-17': { wakeUpAt: null as never, takenMeds: {} } },
  })
  assert.equal(
    s.openIssues.some((i) => i.type === 'no-contact'),
    true,
  )
  const withAction = build('09:30', {
    family: fam,
    actions: [{ id: 'x1', at: iso('08:00'), result: 'call_ok', issueType: 'no-contact' }],
  })
  assert.equal(
    withAction.openIssues.some((i) => i.type === 'no-contact'),
    false,
  )
  assert.equal(withAction.lastContactAt, iso('08:00'))
})

test('이슈는 등급 순, 같은 등급이면 오래 기다린 순으로 정렬된다', () => {
  const s = build('11:00', {
    alerts: [sos(iso('10:50')), sos(iso('10:30'), { id: 'a-sos2' })],
  })
  assert.deepEqual(
    s.openIssues.map((i) => [i.grade, i.alertId ?? i.type]),
    [
      ['P1', 'a-sos2'],
      ['P1', 'a-sos'],
      ['P3', 'wake-missed'],
    ],
  )
})

test('에스컬레이션 대상: 긴급·확인됨·이미 올린 알림·해결된 알림은 제외', () => {
  const days = { '2026-11-17': { wakeUpAt: undefined, takenMeds: { 'm-1': 'x' } } }
  const med = (id: string, extra: Partial<AlertDoc> = {}): AlertDoc => ({
    id,
    key: `2026-11-17-med-${id === 'a-1' ? 'm-1' : 'm-2'}`,
    kind: 'med',
    reason: '약',
    at: iso('09:00'),
    ...extra,
  })
  const found = findEscalations(
    [
      med('a-1'), // m-1 은 드셨음 → 해결
      med('a-2'), // 대상
      med('a-3', { ackAt: iso('09:10') }),
      med('a-4', { escalatedAt: iso('09:40') }),
      sos(iso('09:00')),
    ],
    kst('10:00'),
    days,
  )
  assert.deepEqual(
    found.map((a) => a.id),
    ['a-2'],
  )
  assert.equal(isResolved(med('a-1'), days), true)
})

let db: FakeDb
let fcm: FakeMessaging
const asDb = () => db as unknown as Firestore
const asFcm = () => fcm as unknown as Messaging
const summaryDoc = (code = CODE) => db.store.get(`families/${code}/summary/current`)

beforeEach(() => {
  db = new FakeDb()
  fcm = new FakeMessaging()
  db.store.set(`families/${CODE}`, { ...family })
  db.store.set(`families/${CODE}/pushTokens/g1`, { token: 'guardian-phone', role: 'guardian' })
  db.store.set(`families/${CODE}/pushTokens/w1`, { token: 'worker-phone', role: 'worker' })
})

test('refreshSummary 는 families/{코드}/summary/current 에 저장한다', async () => {
  db.store.set(`families/${CODE}/days/2026-11-17`, {
    wakeUpAt: iso('07:30'),
    takenMeds: { 'm-1': iso('08:01') },
  })
  const s = await refreshSummary(asDb(), CODE, kst('09:00'))
  assert.equal(s?.status, '정상')
  assert.deepEqual([summaryDoc()?.todayMedDone, summaryDoc()?.todayMedTotal], [1, 2])
  assert.equal(await refreshSummary(asDb(), 'ZZZ999', kst('09:00')), null, '없는 가족은 건너뜀')
})

test('보호자가 30분 넘게 확인하지 않은 알림은 복지사에게 한 번만 올린다', async () => {
  db.store.set(`families/${CODE}/alerts/a-1`, { ...wakeAlert(iso('10:00'), { id: 'a-1' }) })
  const first = await runCheck(asDb(), asFcm(), kst('10:40'))
  assert.equal(first.escalations, 1)
  const toWorker = fcm.sent.filter((m) => m.token === 'worker-phone')
  assert.equal(toWorker.length, 1)
  assert.match(toWorker[0].data.body, /보호자가 오래 확인하지 않았어요/)
  assert.equal(toWorker[0].data.url, '/worker')
  assert.ok(db.store.get(`families/${CODE}/alerts/a-1`)?.escalatedAt)
  const again = await runCheck(asDb(), asFcm(), kst('10:50'))
  assert.equal(again.escalations, 0)
  assert.equal(fcm.sent.filter((m) => m.token === 'worker-phone').length, 1)
})

test('보호자가 이미 확인한 알림은 올리지 않는다', async () => {
  db.store.set(`families/${CODE}/alerts/a-1`, {
    ...wakeAlert(iso('10:00'), { id: 'a-1', ackAt: iso('10:10') }),
  })
  const r = await runCheck(asDb(), asFcm(), kst('10:40'))
  assert.equal(r.escalations, 0)
})

test('알림 기기가 없어도 최근에 쓴 가족·복지사 담당 가족은 요약을 만든다', async () => {
  db.store.delete(`families/${CODE}/pushTokens/g1`)
  db.store.delete(`families/${CODE}/pushTokens/w1`)
  db.store.set(`families/OTHER2`, { ...family, elderName: '이순자', lastSeenAt: kst('09:00').toISOString() })
  db.store.set(`workers/w-1/assignments/${CODE}`, { assignedAt: kst('08:00').toISOString() })
  const r = await runCheck(asDb(), asFcm(), kst('10:05'))
  assert.equal(r.families, 0)
  assert.equal(r.summaries, 2)
  assert.equal(summaryDoc('OTHER2')?.highestGrade, 'P3')
})

test('일주일 넘게 안 쓰고 담당도 아닌 가족은 요약을 만들지 않는다 (무료 사용량 절약)', async () => {
  db.store.delete(`families/${CODE}/pushTokens/g1`)
  db.store.delete(`families/${CODE}/pushTokens/w1`)
  db.store.set(`families/OLD111`, { ...family, lastSeenAt: '2026-01-01T00:00:00.000Z' })
  db.store.set(`families/NEVER1`, { ...family })
  const r = await runCheck(asDb(), asFcm(), kst('10:05'))
  assert.equal(r.summaries, 0)
  assert.equal(summaryDoc('OLD111'), undefined)
})

test('설정이 덜 되거나 깨진 가족이 있어도 점검은 멈추지 않는다', async () => {
  const now = kst('10:05').toISOString()
  db.store.set(`families/HALF11`, { lastSeenAt: now })
  db.store.set(`families/HALF11/pushTokens/t`, { token: 'half', role: 'guardian' })
  db.store.set(`families/BAD111`, {
    ...family,
    lastSeenAt: now,
    medications: [{ id: 'x', name: 'x', time: '08:00', slot: '아침', createdAt: 'nope' }],
  })
  db.store.set(`families/BAD111/pushTokens/t`, { token: 'bad', role: 'guardian' })
  const r = await runCheck(asDb(), asFcm(), kst('10:05'))
  assert.equal(r.errors, 0)
  assert.ok(r.guardianAlerts >= 2) // 원래 가족(CODE)의 기상 미확인·약 놓침은 그대로 보냄
})

test('긴급 요청은 보호자와 복지사에게 모두 보내고 요약을 바로 갱신한다', async () => {
  db.store.set(`families/${CODE}/alerts/a-9`, { ...sos(new Date().toISOString()), id: 'a-9' })
  const r = await sendAlertPush(asDb(), asFcm(), CODE, 'a-9')
  assert.deepEqual(r, { sent: 1, skipped: false })
  assert.deepEqual(fcm.sent.map((m) => m.token).sort(), ['guardian-phone', 'worker-phone'])
  assert.equal(fcm.sent.find((m) => m.token === 'worker-phone')?.data.url, '/worker')
  assert.equal(summaryDoc()?.highestGrade, 'P1')
})

test('기상·복약 체크가 서버에 기록되면 요약이 바로 갱신된다', async () => {
  db.store.set(`families/${CODE}/days/2026-11-17`, {
    wakeUpAt: iso('07:30'),
    takenMeds: { 'm-1': iso('08:01') },
  })
  await sendCheckinPush(asDb(), asFcm(), CODE, '2026-11-17', 'wake', undefined, kst('08:10'))
  assert.equal(summaryDoc()?.todayWakeAt, iso('07:30'))
  assert.equal(summaryDoc()?.todayMedDone, 1)
})

const act = (extra: Partial<ActionDoc>): ActionDoc => ({
  id: 'act-1',
  at: iso('10:20'),
  byName: '담당 사회복지사',
  type: '이슈처리',
  result: 'call_ok',
  ...extra,
})

test('통화 · 이상 없음으로 처리하면 기상 미확인 이슈가 닫히고 오늘 처리한 것으로 센다', () => {
  const open = build('10:15')
  assert.equal(open.openIssues[0].type, 'wake-missed')
  assert.equal(open.handledToday, false)
  const closed = build('10:30', { actions: [act({ issueType: 'wake-missed' })] })
  assert.equal(
    closed.openIssues.some((i) => i.type === 'wake-missed'),
    false,
  )
  assert.equal(closed.status, '정상')
  assert.equal(closed.handledToday, true)
  assert.equal(closed.lastActionAt, iso('10:20'))
})

test('받지 않음·방문 필요는 이슈를 유지하고 마지막 처리와 재시도 시각을 보여 준다', () => {
  const s = build('10:30', {
    actions: [act({ issueType: 'wake-missed', result: 'call_no_answer', followUpAt: iso('11:00') })],
  })
  const issue = s.openIssues.find((i) => i.type === 'wake-missed')
  assert.ok(issue, '이슈는 그대로')
  assert.deepEqual(issue.lastAction, {
    result: 'call_no_answer',
    at: iso('10:20'),
    byName: '담당 사회복지사',
    followUpAt: iso('11:00'),
  })
  assert.equal(s.handledToday, true, '연락을 시도한 것도 오늘 처리로 셈')
})

test('정정 기록이 가리키는 처리는 없던 일로 본다', () => {
  const s = build('10:30', {
    actions: [
      act({ issueType: 'wake-missed' }),
      { id: 'fix-1', at: iso('10:21'), type: '정정', corrects: 'act-1' },
    ],
  })
  assert.equal(
    s.openIssues.some((i) => i.type === 'wake-missed'),
    true,
  )
  assert.equal(s.handledToday, false)
  assert.equal(s.lastActionAt, null)
})

test('긴급 요청은 해당 알림에 대한 통화 · 이상 없음 처리로 닫힌다', () => {
  const s = build('11:00', {
    alerts: [sos(iso('10:50'))],
    actions: [act({ id: 'act-2', at: iso('10:55'), issueType: 'sos', alertId: 'a-sos' })],
  })
  assert.equal(
    s.openIssues.some((i) => i.type === 'sos'),
    false,
  )
})

test('요약에는 어르신 이름·전화·보호자 이름이 들어가 큐가 요약만 읽으면 된다', () => {
  const s = build('13:00', { family: { ...family, elderPhone: '010-1234-5678' } as never })
  assert.deepEqual([s.elderName, s.elderPhone, s.guardianName], ['김영수', '010-1234-5678', '김민지 (딸)'])
})

test('복지사가 남긴 처리 기록은 서버가 요약을 만들 때 읽는다', async () => {
  db.store.set(`families/${CODE}/actions/act-1`, { ...act({ issueType: 'wake-missed' }) })
  await refreshSummary(asDb(), CODE, kst('10:30'))
  assert.equal(summaryDoc()?.handledToday, true)
  assert.deepEqual((summaryDoc()?.openIssues as unknown[]).length, 0)
})

describe('/api/refresh-summary: 복지사만, 담당 가족만', () => {
  const verify = async (token: string) => {
    if (token === 'bad') throw new Error('invalid')
    return { uid: token }
  }
  const call = (code: string, auth: string | null) =>
    refreshForWorker(asDb(), verify, code, auth, kst('10:30'))

  beforeEach(() => {
    db.store.set('users/w-ok', { role: 'worker' })
    db.store.set('users/g-1', { role: 'guardian', familyCode: CODE })
    db.store.set('users/w-other', { role: 'worker' })
    db.store.set(`workers/w-ok/assignments/${CODE}`, { displayName: '김영수' })
  })

  test('토큰이 없거나 잘못되면 거절한다', async () => {
    assert.equal((await call(CODE, null)).status, 401)
    assert.equal((await call(CODE, 'Bearer bad')).status, 401)
    assert.equal(summaryDoc(), undefined)
  })

  test('복지사가 아니거나 담당이 아니면 거절한다', async () => {
    assert.equal((await call(CODE, 'Bearer g-1')).status, 403)
    assert.equal((await call(CODE, 'Bearer w-other')).status, 403)
    assert.equal((await call(CODE, 'Bearer nobody')).status, 403)
    assert.equal(summaryDoc(), undefined)
  })

  test('담당 복지사면 요약을 새로 만든다', async () => {
    const r = await call(CODE, 'Bearer w-ok')
    assert.deepEqual(r, { status: 200, body: { ok: true } })
    assert.equal(summaryDoc()?.elderName, '김영수')
  })
})

test("'확인했어요'(전화 없이 확인)도 통화 · 이상 없음처럼 이슈를 닫는다", () => {
  const closed = build('10:30', { actions: [act({ issueType: 'wake-missed', result: 'checked' })] })
  assert.equal(
    closed.openIssues.some((i) => i.type === 'wake-missed'),
    false,
  )
})
