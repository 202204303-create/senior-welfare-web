import { Briefcase, ChevronRight, HeartPulse, Landmark, MapPin, Pill, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useJobsQuery } from '@/features/jobs/api/queries'
import { usePoliciesQuery } from '@/features/policies/api/queries'
import { MedChecklist, MedProgress, SOSButton, WakeUpCard } from '@/features/care/components/CareWidgets'
import { InfoCard, Skeleton } from '@/shared/ui'
import { dDayLabel, isJobEligible } from '@/features/jobs/lib/jobs'
import { isPolicyEligible } from '@/features/policies/lib/eligibility'
import { getAge, useUserStore } from '@/features/auth/store/useUserStore'

const QUICK = [
  {
    to: '/care',
    label: '안부·복약',
    desc: '약 챙기기',
    Icon: HeartPulse,
    tint: 'from-rose-100 to-white text-rose-500',
  },
  {
    to: '/jobs',
    label: '일자리',
    desc: '원클릭 신청',
    Icon: Briefcase,
    tint: 'from-amber-100 to-white text-amber-500',
  },
  {
    to: '/map',
    label: '시설 지도',
    desc: '내 주변 찾기',
    Icon: MapPin,
    tint: 'from-emerald-100 to-white text-emerald-500',
  },
  {
    to: '/policies',
    label: '복지 혜택',
    desc: '맞춤 정책',
    Icon: Landmark,
    tint: 'from-violet-100 to-white text-violet-500',
  },
]

export function DashboardPage() {
  const profile = useUserStore((s) => s.profile)
  const jobs = useJobsQuery({ kind: 'all', region: profile.region })
  const policies = usePoliciesQuery()

  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })
  const eligiblePolicies = policies.data?.filter((p) => isPolicyEligible(p, profile)) ?? []
  const recJobs = jobs.data?.filter((j) => isJobEligible(j, profile)).slice(0, 3) ?? []

  return (
    <div className="animate-fade-up space-y-5">
      <div>
        <p className="text-base font-semibold text-brand-600">{today}</p>
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">
          {profile.name} 님, 안녕하세요
        </h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-5">
          <WakeUpCard />

          <InfoCard
            title="오늘의 약"
            icon={<Pill />}
            action={
              <Link
                to="/care"
                className="flex min-h-11 items-center gap-0.5 rounded-xl px-2 text-base font-bold text-brand-600 hover:bg-brand-50"
              >
                전체 <ChevronRight className="size-5" aria-hidden />
              </Link>
            }
          >
            <div className="mb-4">
              <MedProgress />
            </div>
            <MedChecklist compact />
          </InfoCard>
        </div>

        <div className="space-y-5">
          <nav aria-label="바로가기" className="grid grid-cols-2 gap-3">
            {QUICK.map(({ to, label, desc, Icon, tint }) => (
              <Link
                key={to}
                to={to}
                className="glass group flex min-h-32 flex-col justify-between rounded-3xl p-4 transition hover:-translate-y-0.5 hover:shadow-glass-lg"
              >
                <span
                  className={`grid size-12 place-items-center rounded-2xl bg-linear-to-br ring-1 ring-white ${tint}`}
                >
                  <Icon className="size-6" aria-hidden />
                </span>
                <span>
                  <span className="block text-lg font-extrabold">{label}</span>
                  <span className="block text-sm text-ink-soft">{desc}</span>
                </span>
              </Link>
            ))}
          </nav>

          <Link
            to="/policies"
            className="glass-sky flex items-center gap-4 rounded-3xl p-5 transition hover:shadow-glass-lg"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white text-brand-500 shadow-sm">
              <Sparkles className="size-7" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-base text-ink-soft">
                만 {getAge(profile.birthYear)}세 · {profile.region} · {profile.income}
              </span>
              {policies.isLoading ? (
                <Skeleton className="mt-1 h-7 w-48" />
              ) : (
                <span className="block text-xl font-extrabold">
                  받을 수 있는 혜택 <span className="text-brand-600">{eligiblePolicies.length}개</span>
                </span>
              )}
            </span>
            <ChevronRight className="size-7 shrink-0 text-brand-400" aria-hidden />
          </Link>

          <SOSButton />
        </div>
      </div>

      <InfoCard
        title="추천 일자리·프로그램"
        subtitle={`${profile.region} 지역 최신 공고`}
        icon={<Briefcase />}
        action={
          <Link
            to="/jobs"
            className="flex min-h-11 items-center gap-0.5 rounded-xl px-2 text-base font-bold text-brand-600 hover:bg-brand-50"
          >
            더보기 <ChevronRight className="size-5" aria-hidden />
          </Link>
        }
      >
        {jobs.isLoading ? (
          <div className="grid gap-3 md:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        ) : jobs.isError ? (
          <p className="text-base text-ink-soft">
            공고를 불러오지 못했어요. 일자리 메뉴에서 다시 시도해 주세요.
          </p>
        ) : (
          <ul className="grid gap-3 md:grid-cols-3">
            {recJobs.map((j) => (
              <li key={j.id}>
                <Link
                  to={`/jobs/${j.id}/apply`}
                  className="block h-full rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100 transition hover:ring-brand-300"
                >
                  <div className="mb-1.5 flex items-center gap-2">
                    <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-sm font-bold text-brand-700">
                      {j.kind === 'job' ? '일자리' : '프로그램'}
                    </span>
                    <span className="text-sm font-bold text-rose-500">{dDayLabel(j.deadline)}</span>
                  </div>
                  <p className="text-lg font-extrabold leading-snug">{j.title}</p>
                  <p className="mt-1 text-sm text-ink-soft">
                    {j.pay} · {j.schedule}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </InfoCard>
    </div>
  )
}
