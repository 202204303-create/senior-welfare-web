import { useQuery } from '@tanstack/react-query'
import { fetchPolicies } from './policies'

export function usePoliciesQuery() {
  return useQuery({
    queryKey: ['policies'],
    queryFn: fetchPolicies,
    staleTime: 10 * 60_000,
  })
}
