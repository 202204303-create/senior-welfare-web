import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'

/**
 * 서버용 Firebase (관리자 권한).
 * Vercel 환경 변수 FIREBASE_SERVICE_ACCOUNT 에 서비스 계정 키(JSON 그대로 또는 base64)를 넣어야 합니다.
 * 이 키는 비밀번호와 같으므로 코드나 채팅에 올리지 않습니다.
 */
export function firebaseAdmin() {
  if (!getApps().length) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT
    if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT 환경 변수가 설정되지 않았습니다.')
    const json = raw.trim().startsWith('{') ? raw : Buffer.from(raw, 'base64').toString('utf8')
    initializeApp({ credential: cert(JSON.parse(json)) })
  }
  return { db: getFirestore(), messaging: getMessaging(), auth: getAuth() }
}

export const isValidCode = (code: unknown): code is string => typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code)
