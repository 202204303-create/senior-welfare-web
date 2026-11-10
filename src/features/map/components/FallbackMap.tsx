import type { Coords } from '@/features/map/hooks/useGeolocation'
import type { Facility } from '@/features/map/types'
import { FACILITY_META } from '@/features/map/components/facilityMeta'

interface Props {
  center: Coords
  facilities: Facility[]
  selectedId: string | null
  onSelect: (id: string) => void
  radiusKm: number
}

/**
 * 카카오맵 API 키가 없을 때 사용하는 간이 지도.
 * 현재 위치를 중심으로 반경 내 시설의 상대 위치를 커스텀 마커로 표시합니다.
 */
export function FallbackMap({ center, facilities, selectedId, onSelect, radiusKm }: Props) {
  const project = (f: Facility) => {
    const dxKm = (f.lng - center.lng) * 111.32 * Math.cos((center.lat * Math.PI) / 180)
    const dyKm = (f.lat - center.lat) * 110.57
    return {
      left: `${50 + (dxKm / radiusKm) * 46}%`,
      top: `${50 - (dyKm / radiusKm) * 46}%`,
    }
  }

  return (
    <div
      className="relative size-full overflow-hidden bg-[#eaf6ff]"
      role="application"
      aria-label="복지 시설 위치 지도"
    >
      {/* 배경: 격자 + 가상 도로 */}
      <svg className="absolute inset-0 size-full" preserveAspectRatio="none" aria-hidden>
        <defs>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M40 0H0V40" fill="none" stroke="#cfe9fb" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        <line x1="0" y1="62%" x2="100%" y2="58%" stroke="#fff" strokeWidth="14" />
        <line x1="38%" y1="0" x2="44%" y2="100%" stroke="#fff" strokeWidth="12" />
        <line x1="0" y1="30%" x2="100%" y2="26%" stroke="#fff" strokeWidth="9" />
        <line x1="72%" y1="0" x2="68%" y2="100%" stroke="#fff" strokeWidth="9" />
        <ellipse cx="80%" cy="80%" rx="14%" ry="10%" fill="#d4f0e0" />
        <ellipse cx="15%" cy="15%" rx="10%" ry="8%" fill="#d4f0e0" />
      </svg>

      <span className="absolute right-3 top-3 z-30 rounded-full bg-white/85 px-3 py-1 text-sm font-bold text-brand-700 shadow-sm">
        반경 {radiusKm}km
      </span>

      {/* 가로·세로 비율과 무관하게 거리가 왜곡되지 않도록 정사각형 영역 기준으로 배치 */}
      <div className="absolute inset-0 [container-type:size]">
        <div className="absolute left-1/2 top-1/2 size-[min(100cqw,100cqh)] -translate-x-1/2 -translate-y-1/2">
          {/* 반경 원 */}
          <div
            className="absolute inset-[4%] rounded-full border-2 border-dashed border-brand-300 bg-brand-200/15"
            aria-hidden
          />

          {/* 내 위치 */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" aria-label="내 위치">
            <span className="block size-6 animate-pulse-ring rounded-full border-4 border-white bg-brand-500 shadow-lg" />
          </div>

          {/* 시설 마커 */}
          {facilities.map((f) => {
            const pos = project(f)
            const active = f.id === selectedId
            const meta = FACILITY_META[f.type]
            return (
              <button
                key={f.id}
                onClick={() => onSelect(f.id)}
                className="absolute -translate-x-1/2 -translate-y-full transition-transform"
                style={{ ...pos, zIndex: active ? 20 : 10 }}
                aria-label={`${f.name}, ${f.type}`}
                aria-pressed={active}
              >
                <span
                  className={`flex items-center gap-1 whitespace-nowrap rounded-full border-[2.5px] font-bold shadow-glass ${
                    active ? 'scale-110 px-3.5 py-2 text-base text-white' : 'bg-white px-2.5 py-1.5 text-sm'
                  }`}
                  style={{
                    borderColor: meta.color,
                    background: active ? meta.color : undefined,
                    color: active ? '#fff' : meta.color,
                  }}
                >
                  <span aria-hidden>{meta.emoji}</span>
                  <span className={active ? '' : 'hidden sm:inline'}>{f.name}</span>
                </span>
                <span
                  className="mx-auto block size-0 border-x-8 border-t-10 border-x-transparent"
                  style={{ borderTopColor: meta.color }}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
