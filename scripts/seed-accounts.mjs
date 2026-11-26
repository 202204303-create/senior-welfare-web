/**
 * 시연용 계정(어르신·보호자·복지사)을 Firebase 이메일 로그인 계정으로 만듭니다.
 *
 * 하는 일 (여러 번 실행해도 안전합니다)
 *   1) Firebase Authentication 에 senior / guardian / worker 계정을 만들고, 이미 있으면 비밀번호를 바꿉니다.
 *      이메일은 `아이디@neulbom.app` 입니다. (실제 메일 주소가 아니라 로그인용 이름입니다)
 *   2) users/{uid} 에 역할(role)과 연결된 가족 코드를 저장합니다.
 *   3) 복지사 계정에 담당 어르신(가족 코드)을 배정합니다. workers/{uid}/assignments/{코드}
 *
 * 사용법 (내 컴퓨터에서, PowerShell 예시)
 *   $env:GOOGLE_APPLICATION_CREDENTIALS = "C:\경로\서비스계정키.json"
 *   $env:NEULBOM_PASSWORD_SENIOR   = "6자 이상 비밀번호"
 *   $env:NEULBOM_PASSWORD_GUARDIAN = "6자 이상 비밀번호"
 *   $env:NEULBOM_PASSWORD_WORKER   = "6자 이상 비밀번호"
 *   node scripts/seed-accounts.mjs
 *
 * ⚠️ 서비스 계정 키 파일은 비밀번호와 같습니다. 이 폴더나 Git 에 두지 말고, 끝나면 지우세요.
 * ⚠️ 비밀번호는 화면과 로그에 출력하지 않습니다. 실제로 쓰는 비밀번호를 쓰지 마세요.
 *
 * 에뮬레이터로 시험하려면 FIRESTORE_EMULATOR_HOST, FIREBASE_AUTH_EMULATOR_HOST 를 설정하면
 * 키 없이 에뮬레이터에만 만듭니다.
 */
import { applicationDefault, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'neulbom-c7096'
const EMAIL_DOMAIN = 'neulbom.app' // src/features/auth/lib/authMode.ts 의 ACCOUNT_EMAIL_DOMAIN 과 같아야 합니다.
const FAMILY_CODE = process.env.NEULBOM_FAMILY_CODE || 'NEULBM' // 시연용 어르신의 가족 코드

const ACCOUNTS = [
  { id: 'senior', role: 'elder', name: '어르신(시연용)', familyCode: FAMILY_CODE },
  { id: 'guardian', role: 'guardian', name: '보호자(시연용)', familyCode: FAMILY_CODE },
  { id: 'worker', role: 'worker', name: '복지사(시연용)' },
]

const usingEmulator = Boolean(process.env.FIRESTORE_EMULATOR_HOST && process.env.FIREBASE_AUTH_EMULATOR_HOST)
initializeApp(usingEmulator ? { projectId: PROJECT_ID } : { credential: applicationDefault(), projectId: PROJECT_ID })
const auth = getAuth()
const db = getFirestore()

const problems = []
for (const a of ACCOUNTS) {
  const password = process.env[`NEULBOM_PASSWORD_${a.id.toUpperCase()}`]
  if (!password || password.length < 6) {
    problems.push(`NEULBOM_PASSWORD_${a.id.toUpperCase()} 에 6자 이상 비밀번호를 넣어 주세요.`)
  } else if (password === '1234') {
    problems.push(`${a.id}: 시연용 비밀번호(1234)는 쓸 수 없어요.`)
  }
}
if (problems.length) {
  console.error(problems.join('\n'))
  process.exit(1)
}

const uids = {}
for (const a of ACCOUNTS) {
  const email = `${a.id}@${EMAIL_DOMAIN}`
  const password = process.env[`NEULBOM_PASSWORD_${a.id.toUpperCase()}`]
  let user
  try {
    user = await auth.getUserByEmail(email)
    user = await auth.updateUser(user.uid, { password, displayName: a.name })
    console.log(`계정 갱신: ${email}`)
  } catch (e) {
    if (e?.code !== 'auth/user-not-found') throw e
    user = await auth.createUser({ email, password, displayName: a.name })
    console.log(`계정 생성: ${email}`)
  }
  uids[a.id] = user.uid
  await db.doc(`users/${user.uid}`).set({
    role: a.role,
    name: a.name,
    ...(a.familyCode ? { familyCode: a.familyCode } : {}),
    updatedAt: new Date().toISOString(),
  })
}

await db.doc(`workers/${uids.worker}/assignments/${FAMILY_CODE}`).set(
  {
    displayName: '김영수',
    dong: '',
    tags: ['독거'],
    pinnedToday: false,
    addedAt: new Date().toISOString(),
  },
  { merge: true },
)
console.log(`복지사 담당 배정: ${FAMILY_CODE}`)
console.log(`완료${usingEmulator ? ' (에뮬레이터)' : ''}: 로그인 화면에서 아이디 senior / guardian / worker 와 위에서 정한 비밀번호로 로그인하세요.`)
