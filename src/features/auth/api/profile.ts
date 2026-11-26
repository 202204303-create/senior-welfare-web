import { doc, getDoc } from 'firebase/firestore'
import type { Role } from '@/features/auth/lib/demoAccounts'
import { getDb } from '@/shared/api/firebase'

/**
 * users/{uid}: 계정의 역할과 연결된 가족 코드. 서버(관리자)만 만들고, 본인만 읽습니다.
 * 만드는 방법: `node scripts/seed-accounts.mjs` (README "계정 로그인으로 전환하기")
 */
export interface AccountProfile {
  role: Role
  name: string
  /** 어르신·보호자: 연결된 가족 코드. 복지사는 없음(담당 배정은 workers/{uid}/assignments) */
  familyCode?: string
}

const ROLES: Role[] = ['elder', 'guardian', 'worker']

export async function fetchAccountProfile(uid: string): Promise<AccountProfile | null> {
  const db = getDb()
  if (!db) return null
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return null
  const data = snap.data()
  if (!ROLES.includes(data.role)) return null
  return {
    role: data.role as Role,
    name: typeof data.name === 'string' ? data.name : '',
    familyCode: typeof data.familyCode === 'string' ? data.familyCode : undefined,
  }
}
