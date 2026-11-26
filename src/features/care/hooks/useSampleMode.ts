import { DEMO_FAMILY_CODE } from '@/features/auth/lib/demoAccounts'
import { DEFAULT_PROFILE, useUserStore } from '@/features/auth/store/useUserStore'
import { DEFAULT_MEDS, useCareStore } from '@/features/care/store/useCareStore'

/** 아직 첫 설정 전이라 예시 이름·약이 보이는 중인지 (시연 계정은 제외) */
export function useSampleMode() {
  const { setupDone, familyCode, medications } = useCareStore()
  const profileName = useUserStore((s) => s.profile.name)
  const hasSampleMeds = medications.some((m) => DEFAULT_MEDS.some((d) => d.id === m.id))
  const hasSampleName = profileName === DEFAULT_PROFILE.name
  return !setupDone && familyCode !== DEMO_FAMILY_CODE && (hasSampleMeds || hasSampleName)
}
