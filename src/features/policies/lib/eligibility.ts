import { getAge } from '@/features/auth/store/useUserStore'
import type { UserProfile } from '@/features/auth/types'
import type { Policy } from '../types'

/** 거주지·연령·소득 분위 기준으로 정책 자격을 판정합니다. */
export function isPolicyEligible(p: Policy, profile: Pick<UserProfile, 'region' | 'income' | 'birthYear'>) {
  const age = getAge(profile.birthYear)
  if (age < p.minAge) return false
  if (!p.regions.includes('전국') && !p.regions.includes(profile.region)) return false
  if (p.incomes.length > 0 && !p.incomes.includes(profile.income)) return false
  return true
}
