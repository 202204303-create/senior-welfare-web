import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UserProfile } from '@/features/auth/types'
import { useApplicationStore } from '../store/useApplicationStore'
import { fetchJob, fetchJobs, submitApplication, type JobFilter } from './jobs'

export function useJobsQuery(filter: JobFilter) {
  return useQuery({
    queryKey: ['jobs', filter],
    queryFn: () => fetchJobs(filter),
    staleTime: 60_000,
  })
}

export function useJobQuery(id: string | undefined) {
  return useQuery({
    queryKey: ['job', id ?? ''],
    queryFn: () => fetchJob(id!),
    enabled: Boolean(id),
  })
}

export function useApplyMutation() {
  const qc = useQueryClient()
  const addApplication = useApplicationStore((s) => s.add)
  return useMutation({
    mutationFn: (vars: { postingId: string; postingTitle: string; profile: UserProfile; message: string }) =>
      submitApplication(vars).then((res) => ({ ...res, ...vars })),
    onSuccess: (data) => {
      addApplication({
        id: data.applicationId,
        postingId: data.postingId,
        postingTitle: data.postingTitle,
        appliedAt: new Date().toISOString(),
        status: '접수 완료',
      })
      qc.invalidateQueries({ queryKey: ['jobs'] })
    },
  })
}
