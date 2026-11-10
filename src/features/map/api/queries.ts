import { useQuery } from '@tanstack/react-query'
import { fetchFacilities } from './facilities'

export function useFacilitiesQuery(coords: { lat: number; lng: number } | null, radiusKm: number) {
  return useQuery({
    queryKey: [
      'facilities',
      Number((coords?.lat ?? 0).toFixed(3)),
      Number((coords?.lng ?? 0).toFixed(3)),
      radiusKm,
    ],
    queryFn: () => fetchFacilities({ lat: coords!.lat, lng: coords!.lng, radiusKm }),
    enabled: Boolean(coords),
    staleTime: 5 * 60_000,
  })
}
