import type { Firestore } from 'firebase-admin/firestore'
import type { Messaging } from 'firebase-admin/messaging'
import { firebaseAdmin } from './_lib/admin.js'
import { findElderReminders, findGuardianAlerts, kstClock, type DayDoc, type FamilyDoc } from './_lib/care.js'
import { pushToFamily } from './_lib/push.js'

/**
 * GET /api/check  (GitHub Actions 가 10분마다 부름, Authorization: Bearer CRON_SECRET)
 *
 * 어르신·보호자 앱이 모두 닫혀 있어도:
 * - 기상 마감이 지났는데 확인이 없거나 약을 놓쳤으면 → 알림 기록을 만들고 보호자 기기로 알림
 * - 약 드실 시간이면 → 어르신 기기로 알림
 * 휴대폰 알림을 켠 기기가 있는 가족만 확인합니다.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret || request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: '권한 없음' }, { status: 401 })
  }
  const { db, messaging } = firebaseAdmin()
  return Response.json(await runCheck(db, messaging, new Date()))
}

/** 실제 확인 작업 (시험에서 가짜 저장소로 부를 수 있도록 분리) */
export async function runCheck(db: Firestore, messaging: Messaging, now: Date) {
  const { dateKey } = kstClock(now)

  // 알림을 받을 기기가 등록된 가족 코드
  const tokenSnap = await db.collectionGroup('pushTokens').get()
  const codes = [...new Set(tokenSnap.docs.map((d) => d.ref.parent.parent?.id).filter(Boolean))] as string[]

  const summary = { families: codes.length, guardianAlerts: 0, elderReminders: 0 }

  for (const code of codes) {
    const familyRef = db.collection('families').doc(code)
    const [familySnap, daySnap, alertSnap, logSnap] = await Promise.all([
      familyRef.get(),
      familyRef.collection('days').doc(dateKey).get(),
      // 오늘 키(YYYY-MM-DD-…)로 시작하는 알림만
      familyRef.collection('alerts').where('key', '>=', dateKey).where('key', '<', `${dateKey}`).get(),
      familyRef.collection('pushLog').where('key', '>=', dateKey).where('key', '<', `${dateKey}`).get(),
    ])
    if (!familySnap.exists) continue
    const family = familySnap.data() as FamilyDoc
    const day = daySnap.exists ? (daySnap.data() as DayDoc) : undefined

    // 1) 보호자에게: 어르신 앱이 이미 만든 알림(같은 key)은 건너뜁니다.
    const alertKeys = new Set(alertSnap.docs.map((d) => d.get('key') as string))
    for (const a of findGuardianAlerts(family, day, now, alertKeys)) {
      const id = `srv-${a.key}`
      try {
        await familyRef.collection('alerts').doc(id).create({
          id,
          key: a.key,
          kind: a.kind,
          reason: a.reason,
          at: now.toISOString(),
          channels: ['webpush'],
          recipients: [family.guardianName, '담당 사회복지사'],
          by: 'server',
          pushedAt: now.toISOString(),
        })
      } catch {
        continue // 이미 있음 (동시에 실행된 경우)
      }
      await pushToFamily(db, messaging, code, 'guardian', {
        title: '늘봄 안부 알림',
        body: a.reason,
        url: `/guardian?code=${code}`,
        tag: id,
      })
      summary.guardianAlerts++
    }

    // 2) 어르신께: 약 드실 시간 안내 (하루에 약마다 한 번)
    const sentKeys = new Set(logSnap.docs.map((d) => d.get('key') as string))
    for (const r of findElderReminders(family, day, now, sentKeys)) {
      try {
        await familyRef.collection('pushLog').doc(r.key).create({ key: r.key, at: now.toISOString() })
      } catch {
        continue
      }
      await pushToFamily(db, messaging, code, 'elder', { title: '늘봄', body: r.body, url: '/', tag: r.key })
      summary.elderReminders++
    }
  }

  return summary
}
