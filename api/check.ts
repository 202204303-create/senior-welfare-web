import type { Firestore } from 'firebase-admin/firestore'
import type { Messaging } from 'firebase-admin/messaging'
import { firebaseAdmin } from './_lib/admin.js'
import {
  findElderReminders,
  findGuardianAlerts,
  kstClock,
  normalizeFamily,
  type DayDoc,
} from './_lib/care.js'
import { pushToFamily } from './_lib/push.js'
import { findEscalations, readSnapshot, refreshSummary } from './_lib/summary.js'

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

  const summary = {
    families: codes.length,
    guardianAlerts: 0,
    elderReminders: 0,
    summaries: 0,
    escalations: 0,
    /** 오류가 난 가족 수. 한 가족의 오류로 점검 전체가 멈추지 않도록 건너뛰고 기록만 남깁니다. */
    errors: 0,
    errorSamples: [] as string[],
  }
  const noteError = (code: string, step: string, e: unknown) => {
    summary.errors++
    const msg = `${code} ${step}: ${String((e as Error)?.message ?? e).slice(0, 120)}`
    if (summary.errorSamples.length < 3) summary.errorSamples.push(msg)
    console.log(JSON.stringify({ check: 'family-error', code, step, error: msg }))
  }

  for (const code of codes) {
    try {
      const familyRef = db.collection('families').doc(code)
      const [familySnap, daySnap, alertSnap, logSnap] = await Promise.all([
        familyRef.get(),
        familyRef.collection('days').doc(dateKey).get(),
        // 오늘 키(YYYY-MM-DD-…)로 시작하는 알림만
        familyRef.collection('alerts').where('key', '>=', dateKey).where('key', '<', `${dateKey}`).get(),
        familyRef.collection('pushLog').where('key', '>=', dateKey).where('key', '<', `${dateKey}`).get(),
      ])
      const family = normalizeFamily(familySnap.data())
      if (!family) continue
      const day = daySnap.exists ? (daySnap.data() as DayDoc) : undefined

      // 1) 보호자에게: 어르신 앱이 이미 만든 알림(같은 key)은 건너뜁니다.
      const alertKeys = new Set(alertSnap.docs.map((d) => d.get('key') as string))
      for (const a of findGuardianAlerts(family, day, now, alertKeys)) {
        const id = `srv-${a.key}`
        try {
          await familyRef
            .collection('alerts')
            .doc(id)
            .create({
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
        await pushToFamily(db, messaging, code, 'elder', {
          title: '늘봄',
          body: r.body,
          url: '/',
          tag: r.key,
        })
        summary.elderReminders++
      }
    } catch (e) {
      noteError(code, 'alerts', e)
    }
  }

  // 3) 복지사용: 요약을 새로 만들고, 보호자가 오래 확인하지 않은 알림은 복지사에게 올립니다.
  //    무료 사용량을 아끼려고 '최근 7일 안에 쓴 가족 + 알림 기기가 있는 가족 + 복지사 담당 가족'만 돕니다.
  //    (사이트를 한 번 둘러보기만 한 가족까지 10분마다 계산하면 Firestore 무료 한도를 금방 넘습니다)
  const activeSince = new Date(now.getTime() - 7 * 86_400_000).toISOString()
  const [recentSnap, assignedSnap] = await Promise.all([
    db.collection('families').where('lastSeenAt', '>=', activeSince).get(),
    db.collectionGroup('assignments').get(),
  ])
  const activeCodes = new Set<string>([
    ...codes,
    ...recentSnap.docs.map((d) => d.id),
    ...assignedSnap.docs.map((d) => d.id),
  ])
  for (const code of activeCodes) {
    try {
      const snap = await readSnapshot(db, code, now)
      if (!snap) continue
      if (await refreshSummary(db, code, now, snap)) summary.summaries++

      for (const a of findEscalations(snap.alerts, now, snap.days)) {
        const ref = db.collection('families').doc(code).collection('alerts').doc(a.id)
        // 같은 알림을 두 번 올리지 않도록, 보내기 전에 표시를 먼저 남깁니다.
        const first = await db.runTransaction(async (tx) => {
          const cur = await tx.get(ref)
          if (!cur.exists || cur.get('escalatedAt') || cur.get('ackAt')) return false
          tx.update(ref, { escalatedAt: now.toISOString() })
          return true
        })
        if (!first) continue
        const name = snap.family.elderName
        await pushToFamily(db, messaging, code, 'worker', {
          title: '늘봄 보호자 미확인',
          body: `${name} 님: ${a.reason} (보호자가 오래 확인하지 않았어요)`,
          url: '/worker',
          tag: `${a.id}-esc`,
        })
        summary.escalations++
      }
    } catch (e) {
      noteError(code, 'summary', e)
    }
  }

  return summary
}
