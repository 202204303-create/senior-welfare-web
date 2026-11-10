import { http, USE_MOCK } from '@/shared/api/http'
import { simulateNetwork } from '@/shared/api/mock'
import type { Region } from '@/shared/types'
import type { UserProfile } from '@/features/auth/types'
import type { JobPosting } from '../types'
import { MOCK_JOBS } from './mock'

export interface JobFilter {
  kind?: 'all' | 'job' | 'program'
  region?: Region | '전체'
  category?: string | '전체'
  keyword?: string
}

export async function fetchJobs(filter: JobFilter = {}): Promise<JobPosting[]> {
  if (!USE_MOCK) return http.get<JobPosting[]>('/jobs', { ...filter })

  await simulateNetwork(0.03)
  const { kind = 'all', region = '전체', category = '전체', keyword = '' } = filter
  const kw = keyword.trim().toLowerCase()
  return MOCK_JOBS.filter((j) => {
    if (kind !== 'all' && j.kind !== kind) return false
    if (region !== '전체' && j.region !== region && j.region !== '전국') return false
    if (category !== '전체' && j.category !== category) return false
    if (kw && !(j.title + j.org + j.description).toLowerCase().includes(kw)) return false
    return true
  })
}

export async function fetchJob(id: string): Promise<JobPosting> {
  if (!USE_MOCK) return http.get<JobPosting>(`/jobs/${id}`)

  await simulateNetwork()
  const job = MOCK_JOBS.find((j) => j.id === id)
  if (!job) throw new Error('공고를 찾을 수 없습니다.')
  return job
}

export async function submitApplication(payload: {
  postingId: string
  profile: UserProfile
  message: string
}): Promise<{ applicationId: string }> {
  if (!USE_MOCK) return http.post<{ applicationId: string }>('/applications', payload)

  await simulateNetwork(0.05)
  return { applicationId: `app-${Date.now()}-${payload.postingId}` }
}
