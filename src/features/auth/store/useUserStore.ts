import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { isFirebaseAuth } from '@/features/auth/lib/authMode'
import type { Role } from '@/features/auth/lib/demoAccounts'
import type { UserProfile } from '@/features/auth/types'
import { signOutFirebase } from '@/shared/api/firebase'

export type SocialProvider = 'kakao' | 'naver' | 'guest'

interface UserState {
  isLoggedIn: boolean
  provider: SocialProvider | null
  /** 로그인한 역할. 예전에 저장된 값에는 없으므로 비어 있으면 사용자(어르신)로 봅니다. */
  role: Role | null
  profile: UserProfile
  login: (provider: SocialProvider, partial?: Partial<UserProfile>) => void
  /** 시연용 계정으로 로그인 */
  loginAs: (role: Role, partial?: Partial<UserProfile>) => void
  logout: () => void
  updateProfile: (partial: Partial<UserProfile>) => void
}

export const DEFAULT_PROFILE: UserProfile = {
  name: '김영수',
  birthYear: 1956,
  phone: '010-1234-5678',
  address: '서울특별시 중구 세종대로 110',
  region: '서울',
  income: '중위소득 100% 이하',
  career: '중소기업 사무 관리 30년, 아파트 관리사무소 근무 5년',
  guardianName: '김민지 (딸)',
  guardianPhone: '010-9876-5432',
  livingAlone: true,
}

export const getAge = (birthYear: number) => new Date().getFullYear() - birthYear

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      isLoggedIn: false,
      provider: null,
      role: null,
      profile: DEFAULT_PROFILE,
      login: (provider, partial) =>
        set((s) => ({ isLoggedIn: true, provider, role: 'elder', profile: { ...s.profile, ...partial } })),
      loginAs: (role, partial) =>
        set((s) => ({ isLoggedIn: true, provider: 'guest', role, profile: { ...s.profile, ...partial } })),
      logout: () => {
        set({ isLoggedIn: false, provider: null, role: null })
        // 계정 로그인 모드에서는 서버 로그인도 끊어, 다음 사람이 이전 계정으로 이어지지 않게 합니다.
        if (isFirebaseAuth) void signOutFirebase().catch(() => {})
      },
      updateProfile: (partial) => set((s) => ({ profile: { ...s.profile, ...partial } })),
    }),
    { name: 'neulbom-user' },
  ),
)
