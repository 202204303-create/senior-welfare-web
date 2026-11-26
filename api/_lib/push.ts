import type { Firestore } from 'firebase-admin/firestore'
import type { Messaging } from 'firebase-admin/messaging'

export type PushRole = 'guardian' | 'elder' | 'worker'

export interface PushMessage {
  title: string
  body: string
  /** 알림을 눌렀을 때 열 화면 */
  url: string
  /** 같은 tag 의 알림은 하나로 합쳐집니다 */
  tag: string
  /** 급한 정도: urgent(긴급, 강한 진동) · warn(확인 필요, 보통 진동). 휴대폰에서 진동·표시를 다르게 합니다. */
  level?: 'urgent' | 'warn' | 'info'
}

export interface PushOptions {
  /** 아침 안부 알림을 켠 보호자 기기에만 보냄 (pushTokens 문서의 morning: true) */
  onlyMorning?: boolean
}

const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
])

/**
 * 한 가족의 보호자 또는 어르신 기기로 휴대폰 알림을 보냅니다. (화면이 꺼져 있어도 도착)
 * 앱을 지웠거나 알림을 끈 기기의 토큰은 지웁니다.
 */
export async function pushToFamily(
  db: Firestore,
  messaging: Messaging,
  code: string,
  role: PushRole,
  msg: PushMessage,
  options: PushOptions = {},
): Promise<number> {
  const all = await db
    .collection('families')
    .doc(code)
    .collection('pushTokens')
    .where('role', '==', role)
    .get()
  // 아침 안부처럼 '켠 사람만' 받는 알림은 기기 문서의 표시로 거릅니다. (색인이 필요 없도록 코드에서 거름)
  const docs = options.onlyMorning ? all.docs.filter((d) => d.get('morning') === true) : all.docs
  const snap = { docs, empty: docs.length === 0 }
  if (snap.empty) {
    console.log(JSON.stringify({ push: 'no-devices', code, role }))
    return 0
  }
  const tokens = snap.docs.map((d) => d.get('token') as string)
  // 보호자는 어르신을 여러 명(최대 4명), 복지사는 수십 명 돌볼 수 있으므로
  // 보호자·복지사에게 가는 알림은 제목에 어르신 이름을 붙여 어르신별로 구분합니다.
  let title = msg.title
  if (role !== 'elder') {
    const name = (await db.collection('families').doc(code).get()).get('elderName')
    if (typeof name === 'string' && name) title = `${msg.title} · ${name} 님`
  }
  const res = await messaging.sendEachForMulticast({
    tokens,
    // 표시는 서비스 워커(public/push-sw.js)가 직접 하므로 data 로만 보냅니다.
    data: { title, body: msg.body, url: msg.url, tag: msg.tag, level: msg.level ?? 'warn' },
    webpush: { headers: { Urgency: 'high', TTL: String(24 * 60 * 60) } },
  })
  // 진단용 기록: 몇 대에 보냈고 실패 이유가 무엇인지 (기기 토큰은 남기지 않습니다)
  console.log(
    JSON.stringify({
      push: 'sent',
      code,
      role,
      devices: tokens.length,
      success: res.successCount,
      errors: res.responses.flatMap((r) => (r.success ? [] : [r.error?.code ?? 'unknown'])),
    }),
  )
  await Promise.all(
    res.responses.map((r, i) =>
      !r.success && r.error && DEAD_TOKEN.has(r.error.code) ? snap.docs[i].ref.delete() : null,
    ),
  )
  return res.successCount
}
