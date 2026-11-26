import type { Firestore } from 'firebase-admin/firestore'
import type { Messaging } from 'firebase-admin/messaging'
import { firebaseAdmin, isValidCode } from './_lib/admin.js'
import { kstClock, type DayDoc, type FamilyDoc } from './_lib/care.js'
import { pushToFamily } from './_lib/push.js'
import { refreshSummary } from './_lib/summary.js'

type Kind = 'wake' | 'med'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/**
 * POST /api/notify-checkin  { code, dateKey, kind: 'wake' | 'med', medId? }
 * 어르신이 '일어났어요' 또는 '먹었어요'를 누른 직후 어르신 앱이 부릅니다.
 * '일어났어요'는 '아침 안부 알림 받기'를 켠 보호자 기기에만 조용히 알립니다. (기본은 꺼짐)
 * '먹었어요'는 알리지 않습니다. (교수님 피드백)
 *
 * 서버에 실제로 기록된 기상·복용만 알리고, 같은 날 같은 항목은 한 번만 보냅니다.
 * (아무나 불러도 없는 일을 알리거나 알림을 반복해서 보낼 수 없도록)
 */
export async function POST(request: Request) {
  let body: { code?: unknown; dateKey?: unknown; kind?: unknown; medId?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }
  const { code, dateKey, kind, medId } = body
  const okKind = kind === 'wake' || kind === 'med'
  const okMed = kind === 'wake' || (typeof medId === 'string' && medId.length > 0 && medId.length <= 50)
  if (!isValidCode(code) || typeof dateKey !== 'string' || !DATE_RE.test(dateKey) || !okKind || !okMed) {
    return Response.json({ error: '잘못된 요청' }, { status: 400 })
  }

  const { db, messaging } = firebaseAdmin()
  return Response.json(
    await sendCheckinPush(
      db,
      messaging,
      code,
      dateKey,
      kind as Kind,
      typeof medId === 'string' ? medId : undefined,
    ),
  )
}

const fmtKst = (iso: string) =>
  new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: 'numeric', minute: '2-digit' }).format(
    new Date(iso),
  )

/** 오늘(또는 자정 직후라면 어제) 기록만 알립니다. */
function isRecentDate(dateKey: string, now: Date) {
  const today = kstClock(now).dateKey
  const yesterday = kstClock(new Date(now.getTime() - 86_400_000)).dateKey
  return dateKey === today || dateKey === yesterday
}

/** 기상·복용 확인을 보호자 기기로 보냅니다. 시험할 수 있도록 분리했습니다. */
export async function sendCheckinPush(
  db: Firestore,
  messaging: Messaging,
  code: string,
  dateKey: string,
  kind: Kind,
  medId: string | undefined,
  now = new Date(),
) {
  if (!isRecentDate(dateKey, now)) return { sent: 0, skipped: true, reason: 'old-date' }
  // '먹었어요'는 보호자에게 알리지 않습니다. (교수님 피드백: 좋은 소식까지 울리면 소음. 놓쳤을 때만 알림)
  if (kind === 'med') return { sent: 0, skipped: true, reason: 'no-med-push' }

  const familyRef = db.collection('families').doc(code)
  const [familySnap, daySnap] = await Promise.all([
    familyRef.get(),
    familyRef.collection('days').doc(dateKey).get(),
  ])
  if (!familySnap.exists) return { sent: 0, skipped: true, reason: 'no-family' }
  const family = familySnap.data() as FamilyDoc
  const day = (daySnap.data() ?? {}) as DayDoc

  // 기록이 바뀌었으니 복지사 화면의 요약도 바로 갱신합니다. (알림 보내기와 별개, 실패해도 계속)
  await refreshSummary(db, code, now)

  let message: string
  let key: string
  if (kind === 'wake') {
    if (!day.wakeUpAt) return { sent: 0, skipped: true, reason: 'not-recorded' }
    message = `${family.elderName} 님이 일어나셨어요. (${fmtKst(day.wakeUpAt)})`
    key = `${dateKey}-wake`
  } else {
    const takenAt = medId ? day.takenMeds?.[medId] : undefined
    const med = (family.medications ?? []).find((m) => m.id === medId)
    if (!takenAt || !med) return { sent: 0, skipped: true, reason: 'not-recorded' }
    message = `${family.elderName} 님이 ${med.name}을(를) 드셨어요. (${fmtKst(takenAt)})`
    key = `${dateKey}-med-${med.id}`
  }

  // 같은 날 같은 항목은 한 번만: 표시 문서를 먼저 만들고, 이미 있으면 보내지 않습니다.
  try {
    await familyRef.collection('checkinPushes').doc(key).create({ at: now.toISOString() })
  } catch (e) {
    if (/ALREADY_EXISTS|already exists/i.test(String((e as Error).message))) {
      return { sent: 0, skipped: true, reason: 'already-sent' }
    }
    throw e
  }

  // '일어나셨어요'는 보호자가 '아침 안부 알림 받기'를 켠 기기에만, 소리·진동 없이 조용히 보냅니다. (기본은 꺼짐)
  const sent = await pushToFamily(
    db,
    messaging,
    code,
    'guardian',
    { title: '☀️ 늘봄 안부', body: message, url: `/guardian?code=${code}`, tag: `ok-${key}`, level: 'info' },
    { onlyMorning: true },
  )
  return { sent, skipped: false }
}
