import type { Firestore } from 'firebase-admin/firestore'
import type { Messaging } from 'firebase-admin/messaging'
import { firebaseAdmin, isValidCode } from './_lib/admin.js'
import { pushToFamily } from './_lib/push.js'
import { refreshSummary } from './_lib/summary.js'

/**
 * POST /api/notify  { code, alertId }
 * 어르신 앱이 알림(미확인·긴급 요청)을 서버에 저장한 직후 부릅니다.
 * 보호자 기기로 휴대폰 알림을 보냅니다. 같은 알림은 한 번만 보냅니다.
 */
export async function POST(request: Request) {
  let body: { code?: unknown; alertId?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }
  const { code, alertId } = body
  if (!isValidCode(code) || typeof alertId !== 'string' || alertId.length > 100) {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { db, messaging } = firebaseAdmin()
  return Response.json(await sendAlertPush(db, messaging, code, alertId))
}

/** 알림 하나를 보호자 기기로 보냅니다. 이미 보낸 알림은 건너뜁니다. (시험할 수 있도록 분리) */
export async function sendAlertPush(db: Firestore, messaging: Messaging, code: string, alertId: string) {
  const ref = db.collection('families').doc(code).collection('alerts').doc(alertId)

  // 두 번 눌리거나 동시에 불려도 한 번만 보내도록, 보내기 전에 '보냄' 표시를 먼저 남깁니다.
  const alert = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    if (!snap.exists || snap.get('pushedAt')) return null
    tx.update(ref, { pushedAt: new Date().toISOString() })
    return snap.data() as { reason: string; kind?: string }
  })
  if (!alert) return { sent: 0, skipped: true }

  const sos = alert.kind === 'sos'
  const sent = await pushToFamily(db, messaging, code, 'guardian', {
    title: sos ? '늘봄 긴급 알림' : '늘봄 안부 알림',
    body: alert.reason,
    url: `/guardian?code=${code}`,
    tag: alertId,
  })
  // 긴급 요청은 담당 복지사에게도 바로 보냅니다. (알림 정책: 복지사는 긴급·에스컬레이션만 받음)
  if (sos) {
    await pushToFamily(db, messaging, code, 'worker', {
      title: '늘봄 긴급 알림',
      body: alert.reason,
      url: '/worker',
      tag: `${alertId}-worker`,
    })
  }
  // 복지사 화면의 요약을 바로 갱신합니다. (실패해도 알림에는 영향 없음)
  await refreshSummary(db, code)
  return { sent, skipped: false }
}
