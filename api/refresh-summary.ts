import type { Firestore } from 'firebase-admin/firestore'
import { firebaseAdmin, isValidCode } from './_lib/admin.js'
import { refreshSummary } from './_lib/summary.js'

/**
 * POST /api/refresh-summary  { code }   Authorization: Bearer <Firebase ID 토큰>
 * 복지사가 처리 결과를 남긴 직후 부릅니다. 해당 가족의 요약(summary)을 바로 새로 만듭니다.
 *
 * 누구나 서버 읽기를 일으킬 수 없도록, 로그인 토큰을 확인하고
 * 그 계정이 복지사이며 이 가족이 담당으로 배정된 경우에만 처리합니다.
 */
export async function POST(request: Request) {
  let body: { code?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }
  if (!isValidCode(body.code)) return Response.json({ error: '잘못된 요청' }, { status: 400 })

  const { db, auth } = firebaseAdmin()
  const result = await refreshForWorker(
    db,
    async (token) => ({ uid: (await auth.verifyIdToken(token)).uid }),
    body.code,
    request.headers.get('authorization'),
  )
  return Response.json(result.body, { status: result.status })
}

/** 토큰 확인 방법을 바꿔 끼울 수 있게 분리했습니다. (시험용) */
export async function refreshForWorker(
  db: Firestore,
  verify: (token: string) => Promise<{ uid: string }>,
  code: string,
  authorization: string | null,
  now = new Date(),
): Promise<{ status: number; body: { ok: boolean; reason?: string } }> {
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!token) return { status: 401, body: { ok: false, reason: 'no-token' } }

  let uid: string
  try {
    uid = (await verify(token)).uid
  } catch {
    return { status: 401, body: { ok: false, reason: 'bad-token' } }
  }

  const [profile, assignment] = await Promise.all([
    db.collection('users').doc(uid).get(),
    db.collection('workers').doc(uid).collection('assignments').doc(code).get(),
  ])
  if (!profile.exists || profile.get('role') !== 'worker' || !assignment.exists) {
    return { status: 403, body: { ok: false, reason: 'not-assigned' } }
  }
  const summary = await refreshSummary(db, code, now)
  return { status: 200, body: { ok: summary !== null } }
}
