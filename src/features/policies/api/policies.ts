import { http, USE_MOCK } from '@/shared/api/http'
import { simulateNetwork } from '@/shared/api/mock'
import type { Policy } from '../types'
import { MOCK_POLICIES } from './mock'

export async function fetchPolicies(): Promise<Policy[]> {
  if (!USE_MOCK) return http.get<Policy[]>('/policies')

  await simulateNetwork(0.03)
  return MOCK_POLICIES
}
