import {
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Coins,
  MapPin,
  SearchX,
  Zap,
} from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useJobsQuery } from '@/features/jobs/api/queries'
import {
  BigLink,
  ChipGroup,
  EmptyState,
  ErrorState,
  InfoCard,
  LoadingList,
  PageHeader,
  VoiceInputBox,
} from '@/shared/ui'
import { dDayLabel, daysLeft, isJobEligible } from '@/features/jobs/lib/jobs'
import { useApplicationStore } from '@/features/jobs/store/useApplicationStore'
import { useUserStore } from '@/features/auth/store/useUserStore'
import type { Region } from '@/shared/types'

const KINDS = ['전체', '일자리', '활동 프로그램'] as const
const REGIONS = ['전체', '서울', '경기', '인천', '부산', '대전', '광주'] as const
const CATEGORIES = [
  '전체',
  '공익활동',
  '사회서비스',
  '시장형',
  '취업알선',
  '교육',
  '건강·운동',
  '문화·여가',
] as const

export function JobsPage() {
  const profile = useUserStore((s) => s.profile)
  const applications = useApplicationStore((s) => s.applications)
  const [keyword, setKeyword] = useState('')
  const [search, setSearch] = useState('')
  const [kind, setKind] = useState<(typeof KINDS)[number]>('전체')
  const [region, setRegion] = useState<(typeof REGIONS)[number]>(
    (REGIONS as readonly string[]).includes(profile.region)
      ? (profile.region as (typeof REGIONS)[number])
      : '전체',
  )
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('전체')

  const { data, isLoading, isError, error, refetch, isFetching } = useJobsQuery({
    kind: kind === '전체' ? 'all' : kind === '일자리' ? 'job' : 'program',
    region: region as Region | '전체',
    category,
    keyword: search,
  })

  const appliedIds = new Set(applications.map((a) => a.postingId))

  return (
    <div className="animate-fade-up">
      <PageHeader title="일자리·활동 프로그램" desc="공공 일자리와 복지관 프로그램을 한 번에 신청하세요." />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <div className="glass space-y-4 rounded-3xl p-5">
            <VoiceInputBox
              label="검색"
              value={keyword}
              onChange={(v) => {
                setKeyword(v)
                if (!v) setSearch('')
              }}
              onSubmit={(v) => setSearch(v)}
              placeholder="예: 바리스타, 스마트폰"
            />
            <ChipGroup label="종류" options={KINDS} value={kind} onChange={setKind} />
            <ChipGroup label="지역" options={REGIONS} value={region} onChange={setRegion} />
            <ChipGroup label="분야" options={CATEGORIES} value={category} onChange={setCategory} />
          </div>

          <div className="flex items-center justify-between px-1" aria-live="polite">
            <p className="text-base font-bold text-ink-soft">
              {isLoading ? '찾는 중…' : `공고 ${data?.length ?? 0}건`}
              {isFetching && !isLoading && ' · 새로고침 중'}
            </p>
            {search && (
              <button
                onClick={() => {
                  setSearch('')
                  setKeyword('')
                }}
                className="min-h-11 px-2 text-base font-bold text-brand-600"
              >
                '{search}' 검색 취소
              </button>
            )}
          </div>

          {isLoading ? (
            <LoadingList />
          ) : isError ? (
            <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
          ) : data && data.length === 0 ? (
            <EmptyState
              icon={<SearchX />}
              title="조건에 맞는 공고가 없어요"
              desc="지역이나 분야를 '전체'로 바꿔 보세요."
            />
          ) : (
            <ul className="grid gap-4 xl:grid-cols-2">
              {data?.map((j) => {
                const applied = appliedIds.has(j.id)
                const eligible = isJobEligible(j, profile)
                const closed = daysLeft(j.deadline) < 0
                return (
                  <li key={j.id} className="glass flex flex-col rounded-3xl p-5">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-sm font-bold ${
                          j.kind === 'job' ? 'bg-brand-100 text-brand-700' : 'bg-violet-100 text-violet-700'
                        }`}
                      >
                        {j.kind === 'job' ? '일자리' : '프로그램'} · {j.category}
                      </span>
                      <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600">
                        {dDayLabel(j.deadline)}
                      </span>
                    </div>
                    <h2 className="text-xl font-extrabold leading-snug">{j.title}</h2>
                    <dl className="mt-3 grid gap-1.5 text-base text-ink-soft">
                      <div className="flex items-center gap-2">
                        <Building2 className="size-5 shrink-0 text-brand-400" aria-hidden />
                        <dt className="sr-only">기관</dt>
                        <dd>{j.org}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <Coins className="size-5 shrink-0 text-brand-400" aria-hidden />
                        <dt className="sr-only">급여</dt>
                        <dd className="font-bold text-ink">{j.pay}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarClock className="size-5 shrink-0 text-brand-400" aria-hidden />
                        <dt className="sr-only">일정</dt>
                        <dd>{j.schedule}</dd>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="size-5 shrink-0 text-brand-400" aria-hidden />
                        <dt className="sr-only">지역</dt>
                        <dd>
                          {j.region} · 만 {j.minAge}세 이상
                        </dd>
                      </div>
                    </dl>
                    <div className="mt-auto pt-4">
                      {applied ? (
                        <div className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-50 text-lg font-bold text-emerald-700">
                          <CheckCircle2 className="size-6" aria-hidden /> 신청 완료
                        </div>
                      ) : !eligible ? (
                        <div className="flex min-h-14 items-center justify-center rounded-2xl bg-slate-100 text-base font-bold text-slate-500">
                          만 {j.minAge}세부터 신청할 수 있어요
                        </div>
                      ) : closed ? (
                        <div className="flex min-h-14 items-center justify-center rounded-2xl bg-slate-100 text-base font-bold text-slate-500">
                          모집이 마감되었어요
                        </div>
                      ) : (
                        <Link
                          to={`/jobs/${j.id}/apply`}
                          className="flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 text-lg font-bold text-white shadow-glass transition hover:from-brand-500 hover:to-brand-700 active:scale-[0.98]"
                        >
                          <Zap className="size-6" aria-hidden /> 원클릭 신청
                        </Link>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <aside className="space-y-5">
          <InfoCard title="내 신청 내역" icon={<ClipboardList />} subtitle={`총 ${applications.length}건`}>
            {applications.length === 0 ? (
              <p className="rounded-2xl bg-white/70 p-4 text-center text-base text-ink-soft">
                아직 신청한 공고가 없어요.
              </p>
            ) : (
              <ul className="space-y-2">
                {applications.map((a) => (
                  <li key={a.id} className="rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100">
                    <p className="text-base font-bold leading-snug">{a.postingTitle}</p>
                    <p className="mt-1 flex items-center justify-between text-sm text-ink-soft">
                      {new Date(a.appliedAt).toLocaleDateString('ko-KR')}
                      <span className="rounded-full bg-brand-100 px-2.5 py-0.5 font-bold text-brand-700">
                        {a.status}
                      </span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </InfoCard>
          <div className="glass-sky rounded-3xl p-5">
            <p className="text-lg font-extrabold">원클릭 신청이란?</p>
            <p className="mt-1 text-base text-ink-soft">
              회원가입 때 등록한 이름, 나이, 주소, 경력이 지원서에 자동으로 채워져요. 확인만 하고 바로
              신청하세요.
            </p>
            <BigLink to="/my" variant="outline" size="md" fullWidth className="mt-3">
              내 프로필 확인하기
            </BigLink>
          </div>
        </aside>
      </div>
    </div>
  )
}
