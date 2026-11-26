// 실행: npm run test:rules  (Java 가 필요하고, 처음에는 Firestore 에뮬레이터를 내려받습니다)
// firestore.roles.rules 를 실제 에뮬레이터에 올려서, 어르신·보호자·복지사가 할 수 있는 일과 없는 일을 시험합니다.
import { after, before, beforeEach, describe, test } from 'node:test'
import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'

const CODE = 'ABC234'
const OTHER = 'ZZZ999'
let env: RulesTestEnvironment

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-neulbom-rules',
    firestore: { rules: readFileSync('firestore.roles.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  })
})
after(async () => {
  await env.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await setDoc(doc(db, 'users/elder1'), { role: 'elder', familyCode: CODE })
    await setDoc(doc(db, 'users/elder2'), { role: 'elder', familyCode: OTHER })
    await setDoc(doc(db, 'users/guardian1'), { role: 'guardian', familyCode: CODE })
    await setDoc(doc(db, 'users/worker1'), { role: 'worker' })
    await setDoc(doc(db, 'users/worker2'), { role: 'worker' })
    await setDoc(doc(db, `workers/worker1/assignments/${CODE}`), { displayName: '김영수' })
    for (const code of [CODE, OTHER]) {
      await setDoc(doc(db, `families/${code}`), { elderName: '김영수', medications: [] })
      await setDoc(doc(db, `families/${code}/days/2026-11-17`), { wakeUpAt: 'x', takenMeds: {} })
      await setDoc(doc(db, `families/${code}/alerts/a-1`), { id: 'a-1', reason: '알림', at: 'x' })
      await setDoc(doc(db, `families/${code}/pushTokens/t1`), { token: 'tok', role: 'guardian' })
      await setDoc(doc(db, `families/${code}/summary/current`), { status: '정상' })
      await setDoc(doc(db, `families/${code}/checkinPushes/k1`), { at: 'x' })
    }
  })
})

const as = (uid: string | null) =>
  (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore()

describe('로그인하지 않은 사용자와 계정 정보가 없는 로그인 사용자 (익명 로그인 포함)', () => {
  test('아무것도 읽거나 쓸 수 없다', async () => {
    for (const db of [as(null), as('anon-without-profile')]) {
      await assertFails(getDoc(doc(db, `families/${CODE}`)))
      await assertFails(getDoc(doc(db, `families/${CODE}/days/2026-11-17`)))
      await assertFails(setDoc(doc(db, `families/${CODE}/days/2026-11-17`), { takenMeds: {} }))
      await assertFails(getDocs(collection(db, `families/${CODE}/alerts`)))
      await assertFails(setDoc(doc(db, `families/${CODE}/pushTokens/x`), { token: 't', role: 'guardian' }))
    }
  })
})

describe('어르신', () => {
  test('자기 가족 정보·기록·알림을 읽고 쓸 수 있다', async () => {
    const db = as('elder1')
    await assertSucceeds(getDoc(doc(db, `families/${CODE}`)))
    await assertSucceeds(
      setDoc(doc(db, `families/${CODE}`), { elderName: '김영수', lastSeenAt: 'now' }, { merge: true }),
    )
    await assertSucceeds(
      setDoc(doc(db, `families/${CODE}/days/2026-11-18`), { wakeUpAt: 'y', takenMeds: {} }),
    )
    await assertSucceeds(
      setDoc(doc(db, `families/${CODE}/alerts/a-2`), { id: 'a-2', reason: '긴급', at: 'x' }),
    )
    await assertSucceeds(getDocs(collection(db, `families/${CODE}/alerts`)))
  })

  test('다른 가족은 읽거나 쓸 수 없다', async () => {
    const db = as('elder1')
    await assertFails(getDoc(doc(db, `families/${OTHER}`)))
    await assertFails(setDoc(doc(db, `families/${OTHER}/days/2026-11-17`), { takenMeds: {} }))
  })

  test('보호자·복지사의 확인 표시(ackAt, ackBy)는 바꿀 수 없지만 다른 필드는 고칠 수 있다', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(
        doc(ctx.firestore(), `families/${CODE}/alerts/a-1`),
        { ackAt: 't1', ackBy: '민지' },
        { merge: true },
      )
    })
    const db = as('elder1')
    await assertFails(setDoc(doc(db, `families/${CODE}/alerts/a-1`), { ackAt: 't2' }, { merge: true }))
    await assertSucceeds(setDoc(doc(db, `families/${CODE}/alerts/a-1`), { reason: '수정' }, { merge: true }))
  })

  test('요약·처리 기록·특이사항은 읽을 수 없고, 서버 전용 문서에도 접근할 수 없다', async () => {
    const db = as('elder1')
    await assertFails(getDoc(doc(db, `families/${CODE}/summary/current`)))
    await assertFails(setDoc(doc(db, `families/${CODE}/summary/current`), { status: '정상' }))
    await assertFails(getDoc(doc(db, `families/${CODE}/checkinPushes/k1`)))
    await assertFails(setDoc(doc(db, `families/${CODE}/actions/x`), { by: 'elder1' }))
  })

  test('알림 기기는 어르신 역할로만 등록하고 목록은 읽을 수 없다', async () => {
    const db = as('elder1')
    await assertSucceeds(setDoc(doc(db, `families/${CODE}/pushTokens/e1`), { token: 't', role: 'elder' }))
    await assertFails(setDoc(doc(db, `families/${CODE}/pushTokens/e2`), { token: 't', role: 'guardian' }))
    await assertFails(getDocs(collection(db, `families/${CODE}/pushTokens`)))
  })

  test('기록을 지울 수 없다', async () => {
    const db = as('elder1')
    await assertFails(deleteDoc(doc(db, `families/${CODE}/days/2026-11-17`)))
    await assertFails(deleteDoc(doc(db, `families/${CODE}`)))
  })
})

describe('보호자', () => {
  test('연결된 가족의 정보·기록·알림을 읽을 수 있다', async () => {
    const db = as('guardian1')
    await assertSucceeds(getDoc(doc(db, `families/${CODE}`)))
    await assertSucceeds(getDoc(doc(db, `families/${CODE}/days/2026-11-17`)))
    await assertSucceeds(getDocs(collection(db, `families/${CODE}/alerts`)))
  })

  test('다른 가족은 읽을 수 없다', async () => {
    await assertFails(getDoc(doc(as('guardian1'), `families/${OTHER}`)))
  })

  test('알림 확인(ackAt, ackBy)만 할 수 있다', async () => {
    const db = as('guardian1')
    await assertSucceeds(updateDoc(doc(db, `families/${CODE}/alerts/a-1`), { ackAt: 'now', ackBy: '김민지' }))
    await assertFails(updateDoc(doc(db, `families/${CODE}/alerts/a-1`), { reason: '내용 바꾸기' }))
    await assertFails(updateDoc(doc(db, `families/${CODE}/alerts/a-1`), { ackAt: 'now', reason: 'x' }))
  })

  test('복지사가 먼저 확인한 알림도 보호자가 따로 확인(guardianAckAt)할 수 있다', async () => {
    const db = as('guardian1')
    await assertSucceeds(
      updateDoc(doc(db, `families/${CODE}/alerts/a-1`), { guardianAckAt: 'now', guardianAckBy: '김민지' }),
    )
  })

  test('기록·가족 정보를 고치거나 요약·처리 기록을 읽을 수 없다', async () => {
    const db = as('guardian1')
    await assertFails(setDoc(doc(db, `families/${CODE}/days/2026-11-17`), { takenMeds: { 'm-1': 'x' } }))
    await assertFails(updateDoc(doc(db, `families/${CODE}`), { medications: [] }))
    await assertFails(getDoc(doc(db, `families/${CODE}/summary/current`)))
    await assertFails(setDoc(doc(db, `families/${CODE}/notes/n1`), { text: 'x' }))
  })

  test('이미 등록한 기기에 아침 안부 알림 설정을 합쳐 저장할 수 있지만, 역할은 바꿀 수 없다', async () => {
    const db = as('guardian1')
    const ref = doc(db, `families/${CODE}/pushTokens/g9`)
    await assertSucceeds(setDoc(ref, { token: 't', role: 'guardian' }))
    await assertSucceeds(setDoc(ref, { token: 't', role: 'guardian', morning: true }, { merge: true }))
    await assertFails(setDoc(ref, { role: 'elder' }, { merge: true }))
  })

  test('알림 기기는 보호자 역할로만 등록할 수 있고 목록은 읽을 수 없다', async () => {
    const db = as('guardian1')
    await assertSucceeds(setDoc(doc(db, `families/${CODE}/pushTokens/g1`), { token: 't', role: 'guardian' }))
    await assertFails(setDoc(doc(db, `families/${CODE}/pushTokens/g2`), { token: 't', role: 'elder' }))
    await assertFails(getDoc(doc(db, `families/${CODE}/pushTokens/t1`)))
  })
})

describe('복지사', () => {
  test('배정된 가족의 정보·기록·알림·요약을 읽을 수 있다', async () => {
    const db = as('worker1')
    await assertSucceeds(getDoc(doc(db, `families/${CODE}`)))
    await assertSucceeds(getDoc(doc(db, `families/${CODE}/days/2026-11-17`)))
    await assertSucceeds(getDocs(collection(db, `families/${CODE}/alerts`)))
    await assertSucceeds(getDoc(doc(db, `families/${CODE}/summary/current`)))
  })

  test('배정되지 않은 가족은 읽을 수 없고, 배정이 없는 복지사는 아무것도 볼 수 없다', async () => {
    await assertFails(getDoc(doc(as('worker1'), `families/${OTHER}`)))
    await assertFails(getDoc(doc(as('worker1'), `families/${OTHER}/summary/current`)))
    await assertFails(getDoc(doc(as('worker2'), `families/${CODE}`)))
  })

  test('자기 담당 배정 목록만 읽을 수 있다', async () => {
    await assertSucceeds(getDocs(collection(as('worker1'), 'workers/worker1/assignments')))
    await assertFails(getDocs(collection(as('worker2'), 'workers/worker1/assignments')))
    await assertFails(
      setDoc(doc(as('worker1'), `workers/worker1/assignments/${OTHER}`), { displayName: 'x' }),
    )
  })

  test('알림 확인만 할 수 있고 기록·가족 정보는 고칠 수 없다', async () => {
    const db = as('worker1')
    await assertSucceeds(
      updateDoc(doc(db, `families/${CODE}/alerts/a-1`), { ackAt: 'now', ackBy: '담당 사회복지사' }),
    )
    await assertFails(updateDoc(doc(db, `families/${CODE}/alerts/a-1`), { reason: 'x' }))
    await assertFails(setDoc(doc(db, `families/${CODE}/days/2026-11-17`), { takenMeds: { 'm-1': 'x' } }))
    await assertFails(updateDoc(doc(db, `families/${CODE}`), { elderName: 'x' }))
  })

  test('처리 기록은 추가만 할 수 있고(작성자는 본인) 수정·삭제할 수 없다', async () => {
    const db = as('worker1')
    const ref = doc(db, `families/${CODE}/actions/act1`)
    await assertSucceeds(setDoc(ref, { by: 'worker1', result: 'call_ok', at: 'now' }))
    await assertSucceeds(getDoc(ref))
    await assertFails(setDoc(doc(db, `families/${CODE}/actions/act2`), { by: 'worker2', result: 'call_ok' }))
    await assertFails(updateDoc(ref, { result: 'other' }))
    await assertFails(deleteDoc(ref))
    await assertFails(setDoc(doc(as('worker2'), `families/${CODE}/actions/act3`), { by: 'worker2' }))
  })

  test('특이사항은 추가·수정할 수 있고 삭제할 수 없다', async () => {
    const db = as('worker1')
    const ref = doc(db, `families/${CODE}/notes/n1`)
    await assertSucceeds(setDoc(ref, { text: '청력 약함', pinned: true }))
    await assertSucceeds(updateDoc(ref, { pinned: false }))
    await assertFails(deleteDoc(ref))
  })

  test('요약은 고칠 수 없고, 알림 기기는 복지사 역할로만 등록한다', async () => {
    const db = as('worker1')
    await assertFails(setDoc(doc(db, `families/${CODE}/summary/current`), { status: '정상' }))
    await assertSucceeds(setDoc(doc(db, `families/${CODE}/pushTokens/w1`), { token: 't', role: 'worker' }))
    await assertFails(setDoc(doc(db, `families/${CODE}/pushTokens/w2`), { token: 't', role: 'guardian' }))
    await assertFails(getDoc(doc(db, `families/${CODE}/pushTokens/t1`)))
  })
})

describe('계정 정보(users)', () => {
  test('자기 것만 읽을 수 있고 아무도 고칠 수 없다', async () => {
    await assertSucceeds(getDoc(doc(as('elder1'), 'users/elder1')))
    await assertFails(getDoc(doc(as('elder1'), 'users/guardian1')))
    await assertFails(setDoc(doc(as('elder1'), 'users/elder1'), { role: 'worker', familyCode: CODE }))
    await assertFails(updateDoc(doc(as('guardian1'), 'users/guardian1'), { familyCode: OTHER }))
  })
})
