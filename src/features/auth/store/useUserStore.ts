import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '@/features/auth/types'

export type SocialProvider = 'kakao' | 'naver' | 'guest'

interface UserState {
  isLoggedIn: boolean
  provider: SocialProvider | null
  profile: UserProfile
  login: (provider: SocialProvider, partial?: Partial<UserProfile>) => void
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
      profile: DEFAULT_PROFILE,
      login: (provider, partial) =>
        set((s) => ({ isLoggedIn: true, provider, profile: { ...s.profile, ...partial } })),
      logout: () => set({ isLoggedIn: false, provider: null }),
      updateProfile: (partial) => set((s) => ({ profile: { ...s.profile, ...partial } })),
    }),
    { name: 'neulbom-user' },
  ),
)
