import { doc, setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { ensureSignedIn, getDb, getFirebaseApp } from '@/shared/api/firebase'

/**
 * 웹 푸시 인증서 공개 키 (Firebase 콘솔 → 프로젝트 설정 → 클라우드 메시징 → 웹 구성 → 키 쌍).
 * 공개 키라 코드에 넣어도 됩니다. 비어 있으면 '앱이 열려 있을 때만' 알림이 갑니다.
 */
const TEAM_VAPID_KEY =
  'BFne05rnLA8nuAhAK6JH-ROA7fyxMAQyELQ3UHKYkQllv9yIHHrEBQivbawVp2jFaR0V3W6O7lXAdyUCL-2M-QY'
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || TEAM_VAPID_KEY

export type PushRole = 'guardian' | 'elder'

/**
 * registered: 화면이 꺼져 있어도 알림을 받음
 * no-key: 공개 키가 아직 설정되지 않음 (앱이 열려 있을 때만 알림)
 * unsupported: 이 브라우저는 백그라운드 알림을 지원하지 않음 (예: 아이폰 사파리 탭)
 * error: 등록 실패
 */
export type PushRegisterResult = 'registered' | 'no-key' | 'unsupported' | 'error'

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 이 기기를 '알림 받을 기기'로 서버에 등록합니다.
 * 알림 권한이 허용된 뒤에 부르세요. 앱을 열 때마다 불러도 됩니다(토큰이 바뀌면 새로 저장).
 */
export async function registerPushDevice(code: string, role: PushRole): Promise<PushRegisterResult> {
  if (!VAPID_KEY) return 'no-key'
  const app = getFirebaseApp()
  const db = getDb()
  if (!app || !db || !('serviceWorker' in navigator)) return 'unsupported'
  try {
    if (!(await isSupported())) return 'unsupported'
    const registration = await navigator.serviceWorker.ready
    const token = await getToken(getMessaging(app), {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return 'error'
    await ensureSignedIn()
    await setDoc(doc(db, 'families', code, 'pushTokens', (await sha256(token)).slice(0, 40)), {
      token,
      role,
      userAgent: navigator.userAgent.slice(0, 200),
      updatedAt: new Date().toISOString(),
    })
    return 'registered'
  } catch (e) {
    console.warn('[늘봄] 휴대폰 알림 등록 실패', e)
    return 'error'
  }
}

const REQUESTED_KEY = 'neulbom-push-requested'

/**
 * 어르신 앱이 만든 알림을 보호자 기기로 보내 달라고 서버(/api/notify)에 요청합니다.
 * 같은 알림은 이 기기에서 한 번만 요청합니다. (서버도 한 번만 보냄)
 * 서버가 없거나(개발 중) 실패해도 화면 동작에는 영향이 없습니다.
 */
export function requestGuardianPush(code: string, alertId: string) {
  let requested: string[] = []
  try {
    requested = JSON.parse(localStorage.getItem(REQUESTED_KEY) ?? '[]')
  } catch {
    /* 저장이 막힌 브라우저 */
  }
  if (requested.includes(alertId)) return
  try {
    localStorage.setItem(REQUESTED_KEY, JSON.stringify([...requested, alertId].slice(-100)))
  } catch {
    /* 저장이 막혀도 서버가 중복을 막아 줌 */
  }
  fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, alertId }),
  }).catch(() => {})
}

/**
 * 어르신이 '일어났어요'·'먹었어요'를 누른 직후, 보호자 기기로 알려 달라고 서버(/api/notify-checkin)에 요청합니다.
 * 서버가 저장된 기록을 확인하고 같은 날 같은 항목은 한 번만 보냅니다. 실패해도 화면 동작에는 영향이 없습니다.
 */
export function requestCheckinPush(code: string, dateKey: string, kind: 'wake' | 'med', medId?: string) {
  fetch('/api/notify-checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, dateKey, kind, medId }),
  }).catch(() => {})
}
