import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/features/auth/store/useUserStore'
import {
  DEMO_FAMILY_CODE,
  GUARDIAN_CODE_KEY,
  homePathOf,
  type DemoAccount,
} from '@/features/auth/lib/demoAccounts'
import { fetchAccountProfile } from '@/features/auth/api/profile'
import { emailOf } from '@/features/auth/lib/authMode'
import { clearGuardianCodes } from '@/features/care/lib/guardianCodes'
import { useCareStore } from '@/features/care/store/useCareStore'
import { signInWithEmail, signOutFirebase } from '@/shared/api/firebase'

const FRIENDLY_AUTH_ERRORS: Record<string, string> = {
  'auth/invalid-credential': '아이디나 비밀번호가 맞지 않아요.',
  'auth/wrong-password': '아이디나 비밀번호가 맞지 않아요.',
  'auth/user-not-found': '아이디나 비밀번호가 맞지 않아요.',
  'auth/invalid-email': '아이디를 다시 확인해 주세요.',
  'auth/user-disabled': '사용할 수 없는 계정이에요. 관리자에게 문의해 주세요.',
  'auth/too-many-requests': '시도가 너무 많아요. 잠시 뒤에 다시 해 주세요.',
  'auth/network-request-failed': '인터넷 연결을 확인해 주세요.',
}

function describeError(e: unknown) {
  const code = (e as { code?: string } | null)?.code ?? ''
  if (FRIENDLY_AUTH_ERRORS[code]) return FRIENDLY_AUTH_ERRORS[code]
  if (code === 'permission-denied') return '계정 정보를 읽지 못했어요. 관리자에게 문의해 주세요.'
  return '로그인하지 못했어요. 잠시 뒤에 다시 해 주세요.'
}

/** 시연용 계정 / Firebase 계정 로그인·로그아웃 */
export function useAccountAuth() {
  const navigate = useNavigate()
  const loginAs = useUserStore((s) => s.loginAs)
  const storeLogout = useUserStore((s) => s.logout)

  const signIn = (account: DemoAccount, from = '/') => {
    loginAs(account.role)
    if (account.role === 'elder') {
      // 보호자·복지사 계정과 같은 기록을 보도록 시연용 가족 코드를 씁니다.
      useCareStore.setState({ familyCode: DEMO_FAMILY_CODE })
      navigate(from, { replace: true })
      return
    }
    if (account.role === 'guardian') {
      try {
        localStorage.setItem(GUARDIAN_CODE_KEY, DEMO_FAMILY_CODE)
      } catch {
        /* 저장이 막힌 브라우저에서는 코드를 직접 입력 */
      }
    }
    navigate(homePathOf(account.role), { replace: true })
  }

  /**
   * Firebase 이메일 로그인(계정 로그인 모드). 성공하면 null, 실패하면 사용자에게 보여 줄 문구를 돌려줍니다.
   * 아이디에는 `@${ACCOUNT_EMAIL_DOMAIN}` 이 자동으로 붙습니다. (이메일 전체를 적어도 됩니다)
   */
  const signInFirebase = async (id: string, password: string, from = '/'): Promise<string | null> => {
    const typed = id.trim()
    const email = typed.includes('@') ? typed.toLowerCase() : emailOf(typed)
    try {
      const user = await signInWithEmail(email, password)
      const account = await fetchAccountProfile(user.uid)
      if (!account) {
        await signOutFirebase()
        return '이 계정에는 역할이 정해져 있지 않아요. 관리자에게 알려 주세요.'
      }
      if (account.role !== 'worker' && !account.familyCode) {
        await signOutFirebase()
        return '이 계정에는 연결된 가족이 없어요. 관리자에게 알려 주세요.'
      }
      loginAs(account.role)
      if (account.role === 'elder') {
        useCareStore.setState({ familyCode: account.familyCode })
        navigate(from, { replace: true })
        return null
      }
      if (account.role === 'guardian') {
        try {
          localStorage.setItem(GUARDIAN_CODE_KEY, account.familyCode as string)
        } catch {
          /* 저장이 막힌 브라우저에서는 코드를 직접 입력 */
        }
      }
      navigate(homePathOf(account.role), { replace: true })
      return null
    } catch (e) {
      await signOutFirebase().catch(() => {})
      return describeError(e)
    }
  }

  const signOut = () => {
    if (useUserStore.getState().role === 'guardian') {
      clearGuardianCodes()
    }
    storeLogout()
    navigate('/login', { replace: true })
  }

  return { signIn, signInFirebase, signOut }
}
