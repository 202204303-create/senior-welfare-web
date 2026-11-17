import { initializeApp, type FirebaseApp } from 'firebase/app'
import { connectAuthEmulator, getAuth, onAuthStateChanged, signInAnonymously, type User } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore, type Firestore } from 'firebase/firestore'

/**
 * Firebase 설정. .env 에 VITE_FIREBASE_* 값이 있으면 켜지고,
 * 없으면 지금처럼 브라우저(localStorage)에만 저장하며 동작합니다.
 */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const isFirebaseEnabled = Boolean(config.apiKey && config.projectId)

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
