import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from 'firebase/firestore'

/**
 * 늘봄 팀 Firebase 프로젝트(neulbom-c7096)의 웹 앱 설정.
 * 웹 앱 설정값은 브라우저에 그대로 전달되는 공개값이라 코드에 넣어도 됩니다.
 * 데이터 보호는 Firestore 보안 규칙(firestore.rules)이 맡습니다.
 */
const TEAM_CONFIG = {
  apiKey: 'AIzaSyBWca1NE5w0TM_DV4wF1pXNKZQwZ1wB1sY',
  authDomain: 'neulbom-c7096.firebaseapp.com',
  projectId: 'neulbom-c7096',
  appId: '1:640806551684:web:d3243773fc5f858bad82d1',
}

/**
 * .env 에 VITE_FIREBASE_* 값을 넣으면 다른 프로젝트로 바꿀 수 있습니다.
 * VITE_FIREBASE_DISABLED=true 이면 서버 없이 브라우저(localStorage)에만 저장합니다.
 */
const env = import.meta.env
const config = {
  apiKey: env.VITE_FIREBASE_API_KEY || TEAM_CONFIG.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || TEAM_CONFIG.authDomain,
  projectId: env.VITE_FIREBASE_PROJECT_ID || TEAM_CONFIG.projectId,
  appId: env.VITE_FIREBASE_APP_ID || TEAM_CONFIG.appId,
}

export const isFirebaseEnabled =
  env.VITE_FIREBASE_DISABLED !== 'true' && Boolean(config.apiKey && config.projectId)

let app: FirebaseApp | null = null
let db: Firestore | null = null

/** Firestore 인스턴스. Firebase 가 꺼져 있으면 null */
export function getDb(): Firestore | null {
  if (!isFirebaseEnabled) return null
  if (!db) {
    app = initializeApp(config)
    // 메모처럼 비어 있을 수 있는 값(undefined)은 저장하지 않고 건너뜁니다.
    db = initializeFirestore(app, { ignoreUndefinedProperties: true })
    const emulator = import.meta.env.VITE_FIREBASE_EMULATOR_HOST // 예: 127.0.0.1 (로컬 테스트용)
    if (emulator) {
      connectFirestoreEmulator(db, emulator, 8080)
      connectAuthEmulator(getAuth(app), `http://${emulator}:9099`, { disableWarnings: true })
    }
  }
  return db
}

let signingIn: Promise<User> | null = null

/** 익명 로그인. Firestore 보안 규칙이 로그인한 사용자만 읽고 쓰게 하므로 먼저 호출합니다. */
export function ensureSignedIn(): Promise<User> {
  if (!getDb() || !app) return Promise.reject(new Error('Firebase 설정이 없습니다.'))
  const auth = getAuth(app)
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  if (!signingIn) {
    signingIn = new Promise<User>((resolve, reject) => {
      const off = onAuthStateChanged(auth, (u) => {
        if (u) {
          off()
          resolve(u)
        }
      })
      signInAnonymously(auth).catch((e) => {
        off()
        signingIn = null
        reject(e)
      })
    })
  }
  return signingIn
}
