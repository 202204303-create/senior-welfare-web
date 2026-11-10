import { useCallback, useEffect, useState } from 'react'

export interface Coords {
  lat: number
  lng: number
}

// 위치 권한이 없을 때 사용하는 기본 위치 (서울시청)
export const DEFAULT_COORDS: Coords = { lat: 37.5665, lng: 126.978 }

type Status = 'idle' | 'loading' | 'success' | 'denied' | 'unsupported' | 'error'

export function useGeolocation(auto = true) {
  const [coords, setCoords] = useState<Coords | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  const locate = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('unsupported')
      setCoords(DEFAULT_COORDS)
      return
    }
    setStatus('loading')
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setStatus('success')
      },
      (err) => {
        setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : 'error')
        setCoords(DEFAULT_COORDS)
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60_000 },
    )
  }, [])

  useEffect(() => {
    if (auto) locate()
  }, [auto, locate])

  return { coords, status, locate, isFallback: status !== 'success' && coords !== null }
}
