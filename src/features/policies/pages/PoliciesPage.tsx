import {
  BadgeCheck,
  Building,
  ChevronDown,
  ExternalLink,
  FileText,
  Gift,
  SearchX,
  SlidersHorizontal,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { usePoliciesQuery } from '@/features/policies/api/queries'
import {
  ChipGroup,
  EmptyState,
  ErrorState,
  LoadingList,
  PageHeader,
  SelectField,
  TextField,
  VoiceInputBox,
} from '@/shared/ui'
import { isPolicyEligible } from '@/features/policies/lib/eligibility'
import { getAge, useUserStore } from '@/features/auth/store/useUserStore'
import type { IncomeLevel, Region } from '@/shared/types'
import type { Policy, PolicyCategory } from '@/features/policies/types'

const REGIONS: Region[] = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '강원']
const INCOMES: IncomeLevel[] = [
  '기초생활수급',
  '차상위',
  '중위소득 50% 이하',
  '중위소득 100% 이하',
  '해당 없음',
]
const CATEGORIES = ['전체', '생활지원', '의료·건강', '주거', '일자리', '돌봄', '교통·문화'] as const
const SCOPES = ['나에게 맞는 혜택', '전체 보기'] as const

const CATEGORY_TINT: Record<PolicyCategory, string> = {
  생활지원: 'bg-brand-100 text-brand-700',
  '의료·건강': 'bg-rose-100 text-rose-700',
  주거: 'bg-amber-100 text-amber-700',
  일자리: 'bg-emerald-100 text-emerald-700',
  돌봄: 'bg-violet-100 text-violet-700',
  '교통·문화': 'bg-cyan-100 text-cyan-700',
}

export function PoliciesPage() {
  const profile = useUserStore((s) => s.profile)
  const { data, isLoading, isError, error, refetch } = usePoliciesQuery()

  const [cond, setCond] = useState<{ region: Region; birthYear: number; income: IncomeLevel }>({
    region: profile.region === '전국' ? '서울' : profile.region,
    birthYear: profile.birthYear,
    income: profile.income,
  })
  const [scope, setScope] = useState<(typeof SCOPES)[number]>('나에게 맞는 혜택')
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('전체')
  const [keyword, setKeyword] = useState('')
  const [showCond, setShowCond] = useState(false)

  const results = useMemo(() => {
    const kw = keyword.trim()
    return (data ?? [])
      .map((p) => ({ policy: p, eligible: isPolicyEligible(p, cond) }))
      .filter(({ policy, eligible }) => {
        if (scope === '나에게 맞는 혜택' && !eligible) return false
        if (category !== '전체' && policy.category !== category) return false
        if (kw && !(policy.title + policy.summary + policy.benefit).includes(kw)) return false
        return true
      })
      .sort((a, b) => Number(b.eligible) - Number(a.eligible))
  }, [data, cond, scope, category, keyword])

  const eligibleCount = (data ?? []).filter((p) => isPolicyEligible(p, cond)).length

  return (
    <div className="animate-fade-up">
      <PageHeader title="맞춤 복지 혜택" desc="거주지, 나이, 소득에 맞는 지원 제도를 골라드려요." />

      <div className="mb-5 overflow-hidden rounded-3xl bg-linear-to-br from-brand-300 via-brand-400 to-brand-600 p-5 text-white shadow-glass-lg sm:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-white/25 backdrop-blur">
            <Gift className="size-9" aria-hidden />
          </div>
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-base text-white/90">
              {cond.region} · 만 {getAge(cond.birthYear)}세 · {cond.income}
            </p>
            <p className="text-2xl font-black">받을 수 있는 혜택 {isLoading ? '…' : `${eligibleCount}개`}</p>
          </div>
          <button
            onClick={() => setShowCond((v) => !v)}
            aria-expanded={showCond}
            className="flex min-h-12 items-center gap-2 rounded-2xl bg-white/90 px-4 text-base font-bold text-brand-700"
          >
            <SlidersHorizontal className="size-5" aria-hidden /> 조건 바꾸기
          </button>
        </div>
        {showCond && (
          <div className="mt-5 grid gap-3 rounded-2xl bg-white/95 p-4 text-ink sm:grid-cols-3">
            <SelectField
              label="거주지"
              options={REGIONS}
              value={cond.region}
              onChange={(e) => setCond({ ...cond, region: e.target.value as Region })}
            />
            <TextField
              label="출생 연도"
              type="number"
              inputMode="numeric"
              min={1920}
              max={new Date().getFullYear()}
              value={cond.birthYear}
              onChange={(e) => setCond({ ...cond, birthYear: Number(e.target.value) || cond.birthYear })}
            />
            <SelectField
              label="소득 수준"
              options={INCOMES}
              value={cond.income}
              onChange={(e) => setCond({ ...cond, income: e.target.value as IncomeLevel })}
            />
          </div>
        )}
      </div>

      <div className="glass mb-5 space-y-4 rounded-3xl p-5">
        <VoiceInputBox
          value={keyword}
          onChange={setKeyword}
          onSubmit={setKeyword}
          placeholder="예: 연금, 병원비, 난방"
          label="혜택 검색"
        />
        <ChipGroup label="보기" options={SCOPES} value={scope} onChange={setScope} />
        <ChipGroup label="분야" options={CATEGORIES} value={category} onChange={setCategory} />
      </div>

      {isLoading ? (
        <LoadingList count={4} />
      ) : isError ? (
        <ErrorState message={(error as Error).message} onRetry={() => refetch()} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<SearchX />}
          title="조건에 맞는 혜택이 없어요"
          desc="'전체 보기'를 누르거나 분야를 바꿔 보세요."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {results.map(({ policy, eligible }) => (
            <li key={policy.id}>
              <PolicyCard policy={policy} eligible={eligible} />
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-center text-sm text-ink-soft">
        정책 정보는 복지로(bokjiro.go.kr) 공공데이터를 기반으로 하며, 실제 지원 여부는 기관 심사에 따라 달라질
        수 있어요.
      </p>
    </div>
  )
}

function PolicyCard({ policy, eligible }: { policy: Policy; eligible: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <article className={`glass flex h-full flex-col rounded-3xl p-5 ${eligible ? '' : 'opacity-80'}`}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-sm font-bold ${CATEGORY_TINT[policy.category]}`}>
          {policy.category}
        </span>
        {eligible ? (
          <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700">
            <BadgeCheck className="size-4" aria-hidden /> 신청 가능
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-500">
            조건 미해당
          </span>
        )}
      </div>
      <h2 className="text-xl font-extrabold leading-snug">{policy.title}</h2>
      <p className="mt-1.5 text-base leading-relaxed text-ink-soft">{policy.summary}</p>

      <div className="mt-4 rounded-2xl bg-brand-50/90 p-4">
        <p className="text-sm font-bold text-brand-600">지원 내용</p>
        <p className="text-lg font-extrabold text-brand-900">{policy.benefit}</p>
      </div>

      <div className="mt-auto pt-3">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex min-h-12 w-full items-center justify-between rounded-2xl px-1 text-base font-bold text-brand-700"
        >
          신청 방법 보기
          <ChevronDown className={`size-6 transition ${open ? 'rotate-180' : ''}`} aria-hidden />
        </button>
        {open && (
          <div className="animate-fade-up space-y-2 pb-1 text-base">
            <p className="flex gap-2">
              <FileText className="mt-0.5 size-5 shrink-0 text-brand-400" aria-hidden />
              {policy.howToApply}
            </p>
            <p className="flex gap-2 text-ink-soft">
              <Building className="mt-0.5 size-5 shrink-0 text-brand-400" aria-hidden />
              {policy.agency} · 만 {policy.minAge}세 이상
              {policy.regions.includes('전국') ? ' · 전국' : ` · ${policy.regions.join(', ')}`}
            </p>
            <a
              href={policy.link}
              target="_blank"
              rel="noreferrer"
              className="mt-2 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-linear-to-br from-brand-400 to-brand-600 text-lg font-bold text-white"
            >
              자세히 보기 <ExternalLink className="size-5" aria-hidden />
            </a>
          </div>
        )}
      </div>
    </article>
  )
}
