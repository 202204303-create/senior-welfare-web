// 실행: npm run test:api — 서버(알림 보내기)를 메모리 저장소로 시험합니다.
import { beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import type { Firestore } from 'firebase-admin/firestore'
import type { Messaging } from 'firebase-admin/messaging'
import { runCheck } from '../check.ts'
import { POST, sendAlertPush } from '../notify.ts'
import { FakeDb, FakeMessaging } from './fakeFirestore.ts'

const CODE = 'ABC234'
const kst = (hhmm: string) => new Date(`2026-11-17T${hhmm}:00+09:00`)
let db: FakeDb
let fcm: FakeMessaging
const run = (hhmm: string) => runCheck(db as unknown as Firestore, fcm as unknown as Messaging, kst(hhmm))
const sentTo = (token: string) => fcm.sent.filter((s) => s.token === token).map((s) => s.data.body)

beforeEach(() => {
  db = new FakeDb()
  fcm = new FakeMessaging()
  db.store.set(`families/${CODE}`, {
    elderName: '김영수',
    guardianName: '김민지 (딸)',
    wakeUpDeadline: '10:00',
    medGraceMinutes: 60,
    medications: [
      { id: 'm-1', name: '혈압약', slot: '아침', time: '08:00' },
      { id: 'm-2', name: '영양제', slot: '점심', time: '12:30' },
    ],
  })
  db.store.set(`families/${CODE}/pushTokens/g1`, { token: 'guardian-phone', role: 'guardian' })
  db.store.set(`families/${CODE}/pushTokens/e1`, { token: 'elder-phone', role: 'elder' })
})

test('앱이 모두 닫혀 있어도 10:05에 기상 미확인·약 놓침을 보호자에게 보내고 기록을 남긴다', async () => {
  const r = await run('10:05')
  assert.deepEqual(r, { families: 1, guardianAlerts: 2, elderReminders: 0 })
  assert.equal(sentTo('guardian-phone').length, 2)
  assert.match(sentTo('guardian-phone')[0], /10:00까지 기상 확인/)
  assert.equal(sentTo('elder-phone').length, 0, '보호자용 알림은 어르신 기기로 가지 않음')
  const alert = db.store.get(`families/${CODE}/alerts/srv-2026-11-17-wake`)
  assert.equal(alert?.kind, 'wake')
  assert.ok(alert?.pushedAt)
})

test('10분 뒤 다시 확인해도 같은 알림을 또 보내지 않는다', async () => {
  await run('10:05')
  const r = await run('10:15')
  assert.equal(r.guardianAlerts, 0)
  assert.equal(sentTo('guardian-phone').length, 2)
})

test('어르신 앱이 이미 만든 알림(같은 key)은 서버가 다시 만들지 않는다', async () => {
  db.store.set(`families/${CODE}/alerts/a-1`, { id: 'a-1', key: '2026-11-17-wake', reason: '...', at: 'x' })
  const r = await run('10:05')
  assert.equal(r.guardianAlerts, 1) // 약 놓침만
})

test('약 드실 시간에는 어르신 기기로 한 번만 안내한다', async () => {
  const r = await run('08:05')
  assert.equal(r.elderReminders, 1)
  assert.deepEqual(sentTo('elder-phone'), ["혈압약 드실 시간이에요. 드신 뒤 늘봄에서 '먹었어요'를 눌러 주세요."])
  await run('08:15')
  assert.equal(sentTo('elder-phone').length, 1)
})

test('약을 드셨거나 일어나셨으면 보내지 않는다', async () => {
  db.store.set(`families/${CODE}/days/2026-11-17`, { wakeUpAt: 'x', takenMeds: { 'm-1': 'x' } })
  const r = await run('10:05')
  assert.deepEqual(r, { families: 1, guardianAlerts: 0, elderReminders: 0 })
})

test('휴대폰 알림을 켠 기기가 없는 가족은 확인하지 않는다', async () => {
  db.store.delete(`families/${CODE}/pushTokens/g1`)
  db.store.delete(`families/${CODE}/pushTokens/e1`)
  const r = await run('10:05')
  assert.equal(r.families, 0)
})

test('앱을 지운 기기(죽은 토큰)는 지운다', async () => {
  fcm.dead.add('guardian-phone')
  await run('10:05')
  assert.equal(db.store.has(`families/${CODE}/pushTokens/g1`), false)
})

test('어르신 앱의 긴급 요청은 보호자에게 한 번만 "긴급"으로 보낸다', async () => {
  db.store.set(`families/${CODE}/alerts/a-9`, { id: 'a-9', kind: 'sos', reason: '김영수 님이 긴급 도움 요청 버튼을 누르셨어요.' })
  const first = await sendAlertPush(db as unknown as Firestore, fcm as unknown as Messaging, CODE, 'a-9')
  const again = await sendAlertPush(db as unknown as Firestore, fcm as unknown as Messaging, CODE, 'a-9')
  assert.deepEqual(first, { sent: 1, skipped: false })
  assert.deepEqual(again, { sent: 0, skipped: true })
  assert.equal(fcm.sent[0].data.title, '늘봄 긴급 알림')
  assert.equal(fcm.sent[0].data.url, `/guardian?code=${CODE}`)
})

test('/api/notify 는 잘못된 요청을 서버 키 없이도 거절한다', async () => {
  const bad = (body: unknown) =>
    POST(new Request('http://x/api/notify', { method: 'POST', body: JSON.stringify(body) }))
  assert.equal((await bad({ code: 'abc', alertId: 'a' })).status, 400)
  assert.equal((await bad({ code: CODE })).status, 400)
  assert.equal((await POST(new Request('http://x', { method: 'POST', body: 'not json' }))).status, 400)
})
