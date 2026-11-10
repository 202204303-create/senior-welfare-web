import { Clock, Crosshair, Info, MapPinned, Navigation, Phone } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useFacilitiesQuery } from '@/features/map/api/queries'
import { FallbackMap } from '@/features/map/components/FallbackMap'
import { FACILITY_META } from '@/features/map/components/facilityMeta'
import { KakaoMap } from '@/features/map/components/KakaoMap'
import { BigButton, Chip, EmptyState, ErrorState, LoadingList, PageHeader, Skeleton } from '@/shared/ui'
import { useGeolocation } from '@/features/map/hooks/useGeolocation'
import type { FacilityType } from '@/features/map/types'

const TYPES = ['전체', ...(Object.keys(FACILITY_META) as FacilityType[])] as const
const RADII = [1, 2, 3] as const

export function MapPage() {
  const { coords, status, locate, isFallback } = useGeolocation()
  const [radius, setRadius] = useState<number>(2)
  const [type, setType] = useState<(typeof TYPES)[number]>('전체')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [kakaoFailed, setKakaoFailed] = useState(false)
  const kakaoKey = import.meta.env.VITE_KAKAO_MAP_KEY

  const { data, isLoading, isError, error, refetch } = useFacilitiesQuery(coords, radius)
  const list = useMemo(() => (data ?? []).filter((f) => type === '전체' || f.type === type), [data, type])
  const selected = list.find((f) => f.id === selectedId) ?? null
  const onSelect = useCallback((id: string) => setSelectedId(id), [])
  const onKakaoError = useCallback(() => setKakaoFailed(true), [])

  return (
    <div className="animate-fade-up">
      <PageHeader
        title="복지 시설 지도"
        desc="내 주변 복지관, 보건소, 경로당을 찾아보세요."
        action={
          <BigButton
            size="md"
            variant="soft"
            icon={<Crosshair />}
            onClick={locate}
            loading={status === 'loading'}
          >
            <span className="hidden sm:inline">내 위치</span>
          </BigButton>
        }
      />

      {isFallback && (
        <p
          className="mb-4 flex items-start gap-2 rounded-2xl bg-amber-50/90 p-4 text-base text-amber-800 ring-1 ring-amber-100"
          role="status"
        >
          <Info className="mt-0.5 size-5 shrink-0" aria-hidden />
          {status === 'denied'
            ? '위치 권한이 꺼져 있어 서울시청 주변을 보여드려요. 브라우저에서 위치를 허용하시면 내 주변을 찾아드려요.'
            : '현재 위치를 확인하지 못해 서울시청 주변을 보여드려요.'}
        </p>
      )}

      <div className="mb-4 space-y-3">
        <div
          className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]"
          role="group"
          aria-label="시설 종류"
        >
          {TYPES.map((t) => (
            <Chip
              key={t}
              selected={type === t}
              onClick={() => setType(t)}
              icon={t !== '전체' ? <span>{FACILITY_META[t].emoji}</span> : undefined}
            >
              {t}
            </Chip>
          ))}
        </div>
        <div className="flex gap-2" role="group" aria-label="검색 반경">
          {RADII.map((r) => (
            <Chip key={r} selected={radius === r} onClick={() => setRadius(r)}>
              {r}km 이내
            </Chip>
          ))}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="glass relative h-[55dvh] min-h-80 overflow-hidden rounded-3xl p-0 lg:h-[calc(100dvh-16rem)]">
          {!coords ? (
            <Skeleton className="size-full rounded-none" />
          ) : kakaoKey && !kakaoFailed ? (
            <KakaoMap
              appKey={kakaoKey}
              center={coords}
              facilities={list}
              selectedId={selectedId}
              onSelect={onSelect}
              radiusKm={radius}
              onError={onKakaoError}
            />
          ) : (
            <FallbackMap
              center={coords}
              facilities={list}
              selectedId={selectedId}
              onSelect={onSelect}
              radiusKm={radius}
            />
          )}

          {selected && (
            <div className="absolute inset-x-3 bottom-3 z-30 animate-fade-up rounded-3xl bg-white/95 p-4 shadow-glass-lg backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-sm font-bold ${FACILITY_META[selected.type].bg}`}
                  >
                    {selected.type}
                  </span>
                  <p className="mt-1 text-xl font-extrabold">{selected.name}</p>
                  <p className="text-base text-ink-soft">
                    {selected.address} · {(selected.distanceKm * 1000).toFixed(0)}m
                  </p>
                </div>
                <button
                  onClick={() => setSelectedId(null)}
                  className="min-h-11 px-2 text-base font-bold text-ink-soft"
                  aria-label="닫기"
                >
                  닫기
                </button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <a
                  href={`tel:${selected.phone}`}
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-brand-100 text-lg font-bold text-brand-800"
                >
                  <Phone className="size-5" aria-hidden /> 전화
                </a>
                <a
                  href={`https://map.kakao.com/link/to/${encodeURIComponent(selected.name)},${selected.lat},${selected.lng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 text-lg font-bold text-white"
                >
                  <Navigation className="size-5" aria-hidden /> 길찾기
                </a>
              </div>
            </div>
          )}
        </div>

        <section
          aria-label="주변 시설 목록"
          className="lg:max-h-[calc(100dvh-16rem)] lg:overflow-y-auto lg:pr-1"
        >
          <p className="mb-3 px-1 text-base font-bold text-ink-soft" aria-live="polite">
            {isLoading || !coords ? '주변 시설을 찾고 있어요…' : `주변 시설 ${list.length}곳`}
          </p>
          {isLoading || !coords ? (
            <LoadingList />
          ) : isError ? (
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          ) : list.length === 0 ? (
            <EmptyState
              icon={<MapPinned />}
              title="이 근처에는 시설이 없어요"
              desc="검색 반경을 넓혀 보세요."
            />
          ) : (
            <ul className="space-y-3">
              {list.map((f) => (
                <li key={f.id}>
                  <button
                    onClick={() => setSelectedId(f.id)}
                    aria-pressed={f.id === selectedId}
                    className={`glass w-full rounded-3xl p-4 text-left transition ${
                      f.id === selectedId ? 'ring-2 ring-brand-400' : 'hover:ring-2 hover:ring-brand-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`grid size-12 shrink-0 place-items-center rounded-2xl text-2xl ${FACILITY_META[f.type].bg}`}
                        aria-hidden
                      >
                        {FACILITY_META[f.type].emoji}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-lg font-extrabold leading-snug">{f.name}</span>
                        <span className="block text-sm text-ink-soft">
                          {f.type} ·{' '}
                          {f.distanceKm < 1
                            ? `${(f.distanceKm * 1000).toFixed(0)}m`
                            : `${f.distanceKm.toFixed(1)}km`}
                        </span>
                      </span>
                    </div>
                    <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-soft">
                      <Clock className="size-4 shrink-0" aria-hidden /> {f.hours}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}
