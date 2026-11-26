/**
 * 로그인 방식.
 * - demo(기본): 앱 코드 안의 시연용 계정 3개. 서버는 익명 로그인 + 가족 코드로 접속합니다. (보안 아님)
 * - firebase: Firebase 이메일 로그인. 계정마다 역할(role)이 있고, Firestore 역할별 규칙과 함께 씁니다.
 *
 * 켜는 방법은 README "계정 로그인으로 전환하기"를 보세요.
 */
export const AUTH_MODE: 'demo' | 'firebase' =
  import.meta.env.VITE_AUTH_MODE === 'firebase' ? 'firebase' : 'demo'
export const isFirebaseAuth = AUTH_MODE === 'firebase'

/** Firebase 계정의 이메일은 아이디 뒤에 이 주소를 붙입니다. (실제 메일 주소가 아님) */
export const ACCOUNT_EMAIL_DOMAIN = 'neulbom.app'
export const emailOf = (id: string) => `${id.trim().toLowerCase()}@${ACCOUNT_EMAIL_DOMAIN}`
