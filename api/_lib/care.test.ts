// 실행: npm run test:api
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findElderReminders, findGuardianAlerts, kstClock, type FamilyDoc } from './care.ts'

const family: FamilyDoc = {
  elderName: '김영수',
  guardianName: '김민지 (딸)',
  wakeUpDeadline: '10:00',
  medGraceMinutes: 60,
  medications: [
    { id: 'm-1', name: '혈압약', slot: '아침', time: '08:00' },
    { id: 'm-2', name: '영양제', slot: '점심', time: '12:30' },
  ],
}
// 한국 시간 HH:mm 의 Date (서버는 UTC 로 돌아도 한국 시간으로 판단해야 함)
const kst = (hhmm: string, date = '2026-11-17') => new Date(`${date}T${hhmm}:00+09:00`)
const none = new Set<string>()

test('한국 시간으로 날짜와 분을 계산한다 (UTC 자정 근처 포함)', () => {
  assert.deepEqual(kstClock(kst('08:30')), { dateKey: '2026-11-17', minutes: 510 })
  assert.deepEqual(kstClock(new Date('2026-11-17T15:30:00Z')), { dateKey: '2026-11-18', minutes: 30 })
})

test('마감 전에는 기상 알림이 없고, 마감 뒤 미확인이면 보호자 알림', () => {
  // 09:59: 기상 마감 전이라 기상 알림은 없음 (08:00 약은 이미 놓쳐서 약 알림만 있음)
  assert.deepEqual(findGuardianAlerts(family, undefined, kst('09:59'), none).map((x) => x.kind), ['med'])
  const a = findGuardianAlerts(family, undefined, kst('10:01'), none)
  assert.deepEqual(a.map((x) => x.key), ['2026-11-17-wake', '2026-11-17-med-m-1'])
  assert.match(a[0].reason, /10:00까지 기상 확인/)
})

test('기상 확인·복용 기록이 있으면 알리지 않는다', () => {
  const day = { wakeUpAt: '2026-11-16T23:10:00Z', takenMeds: { 'm-1': '2026-11-16T23:20:00Z' } }
  assert.equal(findGuardianAlerts(family, day, kst('11:00'), none).length, 0)
})

test('이미 만들어진 알림(어르신 앱이 먼저 보낸 것)은 다시 만들지 않는다', () => {
  const already = new Set(['2026-11-17-wake', '2026-11-17-med-m-1'])
  assert.equal(findGuardianAlerts(family, undefined, kst('10:30'), already).length, 0)
})

test('복약 놓침은 복용 시각 + 여유 시간이 지나야 알린다', () => {
  const day = { wakeUpAt: 'x', takenMeds: {} }
  assert.equal(findGuardianAlerts(family, day, kst('09:00'), none).length, 0)
  assert.deepEqual(findGuardianAlerts(family, day, kst('09:01'), none).map((x) => x.kind), ['med'])
})

test("오늘 시간이 지난 뒤 추가한 약은 놓침으로 알리지 않는다 ('내일부터')", () => {
  const f = {
    ...family,
    medications: [{ id: 'm-9', name: '감기약', slot: '아침', time: '08:00', createdAt: kst('15:00').toISOString() }],
  }
  assert.equal(findGuardianAlerts(f, { wakeUpAt: 'x' }, kst('15:10'), none).length, 0)
  // 다음 날에는 정상적으로 챙긴다
  assert.equal(findGuardianAlerts(f, { wakeUpAt: 'x' }, kst('09:30', '2026-11-18'), none).length, 1)
})

test('어르신 약 안내는 복용 시각부터 여유 시간 안에서만, 한 번만', () => {
  assert.equal(findElderReminders(family, undefined, kst('07:59'), none).length, 0)
  const r = findElderReminders(family, undefined, kst('08:05'), none)
  assert.deepEqual(r.map((x) => x.key), ['2026-11-17-remind-m-1'])
  assert.equal(findElderReminders(family, undefined, kst('08:05'), new Set([r[0].key])).length, 0)
  assert.equal(findElderReminders(family, { takenMeds: { 'm-1': 'x' } }, kst('08:05'), none).length, 0)
  assert.equal(findElderReminders(family, undefined, kst('09:01'), none).length, 0)
})
