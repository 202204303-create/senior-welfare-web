import { http, USE_MOCK } from '@/shared/api/http'
import { simulateNetwork } from '@/shared/api/mock'
import type { Facility } from '../types'
import { MOCK_FACILITIES } from './mock'

export type FacilityWithDistance = Facility & { distanceKm: number }

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function fetchFacilities(params: {
  lat: number
  lng: number
  radiusKm: number
}): Promise<FacilityWithDistance[]> {
  if (!USE_MOCK) return http.get<FacilityWithDistance[]>('/facilities', params)

  await simulateNetwork()
  // Mock 전용: 서울시청 기준 데이터를 사용자 위치 주변으로 평행 이동하여 어디서든 데모가 가능하게 합니다.
  const BASE = { lat: 37.5665, lng: 126.978 }
  return MOCK_FACILITIES.map((f) => {
    const lat = f.lat - BASE.lat + params.lat
    const lng = f.lng - BASE.lng + params.lng
    return { ...f, lat, lng, distanceKm: haversineKm(params.lat, params.lng, lat, lng) }
  })
    .filter((f) => f.distanceKm <= params.radiusKm)
    .sort((a, b) => a.distanceKm - b.distanceKm)
}
