import { useNavigate } from 'react-router-dom'
import { useUserStore } from '@/features/auth/store/useUserStore'
import {
  DEMO_FAMILY_CODE,
  GUARDIAN_CODE_KEY,
  homePathOf,
  type DemoAccount,
} from '@/features/auth/lib/demoAccounts'
import { useCareStore } from '@/features/care/store/useCareStore'

/** 시연용 계정 로그인·로그아웃 */
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

  const signOut = () => {
    if (useUserStore.getState().role === 'guardian') {
      try {
        localStorage.removeItem(GUARDIAN_CODE_KEY)
      } catch {
        /* 무시 */
      }
    }
    storeLogout()
    navigate('/login', { replace: true })
  }

  return { signIn, signOut }
}
