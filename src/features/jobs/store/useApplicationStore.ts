import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Application } from '@/features/jobs/types'

interface ApplicationState {
  applications: Application[]
  add: (a: Application) => void
  hasApplied: (postingId: string) => boolean
}

export const useApplicationStore = create<ApplicationState>()(
  persist(
    (set, get) => ({
      applications: [],
      add: (a) => set((s) => ({ applications: [a, ...s.applications] })),
      hasApplied: (postingId) => get().applications.some((a) => a.postingId === postingId),
    }),
    { name: 'neulbom-applications' },
  ),
)
