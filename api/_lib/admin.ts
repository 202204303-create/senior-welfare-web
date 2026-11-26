import { cert, getApps, initializeApp } from 'firebase-admin/app'
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
    // 한 번 더 막기: 비어 있는 값(undefined)이 섞여도 저장이 실패하지 않게 합니다. (처음 한 번만 설정 가능)
    getFirestore().settings({ ignoreUndefinedProperties: true })
  }
  return { db: getFirestore(), messaging: getMessaging() }
}

/**
 * 로그인 토큰 확인용 Auth. 복지사 화면의 요약 새로고침에서만 쓰므로 필요할 때만 불러옵니다.
 * (모든 서버 함수가 처음부터 불러오면, 이 모듈을 불러오다 실패할 때 알림·점검까지 함께 멈춥니다)
 */
export async function adminAuth() {
  firebaseAdmin()
  const { getAuth } = await import('firebase-admin/auth')
  return getAuth()
}

export const isValidCode = (code: unknown): code is string =>
  typeof code === 'string' && /^[A-Z0-9]{6}$/.test(code)
