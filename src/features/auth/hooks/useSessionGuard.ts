import { useEffect } from 'react'
import { isFirebaseAuth } from '@/features/auth/lib/authMode'
import { useUserStore } from '@/features/auth/store/useUserStore'
import { restoreSession } from '@/shared/api/firebase'

/**
 * 계정 로그인 모드에서, 앱 안에는 로그인 상태가 남아 있는데 Firebase 로그인이 사라진 경우
 * (브라우저 데이터 삭제, 시연용 계정으로 쓰던 기기 등) 로그인 화면으로 돌려보냅니다.
 */
export function useSessionGuard() {
  useEffect(() => {
    if (!isFirebaseAuth) return
    let alive = true
    restoreSession()
      .then((user) => {
        if (alive && !user && useUserStore.getState().isLoggedIn) useUserStore.getState().logout()
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])
}
