import { getAge } from '@/features/auth/store/useUserStore'
import type { UserProfile } from '@/features/auth/types'
import type { JobPosting } from '../types'

export function isJobEligible(j: JobPosting, profile: Pick<UserProfile, 'birthYear'>) {
  return getAge(profile.birthYear) >= j.minAge
}

export function daysLeft(deadline: string) {
  const end = new Date(`${deadline}T23:59:59`)
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000)
}

export function dDayLabel(deadline: string) {
  const d = daysLeft(deadline)
  if (d < 0) return '마감'
  if (d === 0) return '오늘 마감'
  return `D-${d}`
}
