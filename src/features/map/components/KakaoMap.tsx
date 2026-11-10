import { useEffect, useRef, useState } from 'react'
import type { Coords } from '@/features/map/hooks/useGeolocation'
import type { Facility } from '@/features/map/types'
import { markerHtml } from '@/features/map/components/facilityMeta'

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    kakao?: any
  }
}

let sdkPromise: Promise<any> | null = null

function loadKakaoSdk(appKey: string): Promise<any> {
  if (window.kakao?.maps?.LatLng) return Promise.resolve(window.kakao)
  if (sdkPromise) return sdkPromise
  sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.async = true
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = () => {
      sdkPromise = null
      reject(new Error('카카오맵을 불러오지 못했어요.'))
    }
    document.head.appendChild(script)
  })
  return sdkPromise
}

interface Props {
  appKey: string
  center: Coords
  facilities: Facility[]
  selectedId: string | null
  onSelect: (id: string) => void
  radiusKm: number
  onError: () => void
}

export function KakaoMap({ appKey, center, facilities, selectedId, onSelect, radiusKm, onError }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const overlaysRef = useRef<any[]>([])
  const circleRef = useRef<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadKakaoSdk(appKey)
      .then((kakao) => {
        if (cancelled || !ref.current) return
        mapRef.current = new kakao.maps.Map(ref.current, {
          center: new kakao.maps.LatLng(center.lat, center.lng),
          level: 5,
        })
        mapRef.current.addControl(new kakao.maps.ZoomControl(), kakao.maps.ControlPosition.RIGHT)
        setReady(true)
      })
      .catch(onError)
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appKey])

  // 내 위치 + 반경 원
  useEffect(() => {
    if (!ready) return
    const kakao = window.kakao
    const pos = new kakao.maps.LatLng(center.lat, center.lng)
    mapRef.current.setCenter(pos)
    circleRef.current?.setMap(null)
    circleRef.current = new kakao.maps.Circle({
      center: pos,
      radius: radiusKm * 1000,
      strokeWeight: 2,
      strokeColor: '#1f9bf0',
      strokeOpacity: 0.6,
      fillColor: '#85d1ff',
      fillOpacity: 0.15,
    })
    circleRef.current.setMap(mapRef.current)
  }, [ready, center.lat, center.lng, radiusKm])

  // 시설 커스텀 마커
  useEffect(() => {
    if (!ready) return
    const kakao = window.kakao
    overlaysRef.current.forEach((o) => o.setMap(null))
    const me = document.createElement('div')
    me.innerHTML =
      '<div style="width:22px;height:22px;border-radius:999px;background:#1f9bf0;border:4px solid #fff;box-shadow:0 0 0 8px rgba(31,155,240,.25)"></div>'
    const meOverlay = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(center.lat, center.lng),
      content: me,
      zIndex: 5,
    })
    meOverlay.setMap(mapRef.current)

    overlaysRef.current = [
      meOverlay,
      ...facilities.map((f) => {
        const el = document.createElement('div')
        el.innerHTML = markerHtml(f.type, f.name, f.id === selectedId)
        el.addEventListener('click', () => onSelect(f.id))
        const o = new kakao.maps.CustomOverlay({
          position: new kakao.maps.LatLng(f.lat, f.lng),
          content: el,
          yAnchor: 1,
          zIndex: f.id === selectedId ? 10 : 1,
        })
        o.setMap(mapRef.current)
        return o
      }),
    ]
  }, [ready, facilities, selectedId, onSelect, center.lat, center.lng])

  useEffect(() => {
    if (!ready || !selectedId) return
    const f = facilities.find((x) => x.id === selectedId)
    if (f) mapRef.current.panTo(new window.kakao.maps.LatLng(f.lat, f.lng))
  }, [ready, selectedId, facilities])

  return <div ref={ref} className="size-full" role="application" aria-label="복지 시설 지도" />
}
