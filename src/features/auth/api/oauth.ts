import type { SocialProvider } from '@/features/auth/store/useUserStore'

/**
 * 소셜 간편 로그인 진입점.
 * - .env 에 VITE_KAKAO_REST_KEY / VITE_NAVER_CLIENT_ID 가 있으면 실제 OAuth 인가 페이지로 이동합니다.
 *   (인가 코드 → 토큰 교환은 백엔드 `/auth/{provider}/callback` 에서 처리)
 * - 키가 없으면 데모 모드로 즉시 로그인합니다.
 */
export function getOAuthUrl(provider: Exclude<SocialProvider, 'guest'>): string | null {
  const redirect = `${window.location.origin}/auth/${provider}/callback`
  if (provider === 'kakao') {
    const key = import.meta.env.VITE_KAKAO_REST_KEY
    if (!key) return null
    return `https://kauth.kakao.com/oauth/authorize?client_id=${key}&redirect_uri=${encodeURIComponent(redirect)}&response_type=code`
  }
  const id = import.meta.env.VITE_NAVER_CLIENT_ID
  if (!id) return null
  const state = crypto.randomUUID()
  sessionStorage.setItem('naver_oauth_state', state)
  return `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${id}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`
}
