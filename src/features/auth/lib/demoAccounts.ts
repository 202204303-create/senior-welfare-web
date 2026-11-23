/**
 * 시연용 계정 (사용자·보호자·복지사 1개씩).
 *
 * ⚠️ 이 아이디와 비밀번호는 앱 코드에 그대로 들어 있어 누구나 볼 수 있습니다.
 *    실제 인증이 아니라 시연용이며, 실제 서비스에서는 Firebase 이메일 로그인 등으로 바꿔야 합니다.
 */
export type Role = 'elder' | 'guardian' | 'worker'

/** 시연용 어르신의 가족 코드. 사용자·보호자·복지사 계정이 모두 이 코드로 같은 기록을 봅니다. */
export const DEMO_FAMILY_CODE = 'NEULBM'

/** 복지사 계정이 담당하는 가족 코드 목록 */
export const WORKER_FAMILY_CODES = [DEMO_FAMILY_CODE]

/** 보호자 화면(GuardianPage)이 가족 코드를 기억해 두는 저장 키. GuardianPage 의 CODE_KEY 와 같아야 합니다. */
export const GUARDIAN_CODE_KEY = 'neulbom-guardian-code'

export interface DemoAccount {
  id: string
  password: string
  role: Role
  /** 로그인 화면에 보여 주는 이름 */
  label: string
  desc: string
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    id: 'senior',
    password: '1234',
    role: 'elder',
    label: '사용자(어르신)',
    desc: '안부 확인·복약·일자리·시설·혜택',
  },
  {
    id: 'guardian',
    password: '1234',
    role: 'guardian',
    label: '보호자',
    desc: '어르신의 오늘 상태 실시간 확인',
  },
  {
    id: 'worker',
    password: '1234',
    role: 'worker',
    label: '복지사',
    desc: '담당 어르신 상태와 긴급 요청 확인',
  },
]

export function findAccount(id: string, password: string) {
  const key = id.trim().toLowerCase()
  return DEMO_ACCOUNTS.find((a) => a.id === key && a.password === password) ?? null
}

/** 역할별 첫 화면 */
export function homePathOf(role: Role | null | undefined) {
  if (role === 'guardian') return '/guardian'
  if (role === 'worker') return '/worker'
  return '/'
}
