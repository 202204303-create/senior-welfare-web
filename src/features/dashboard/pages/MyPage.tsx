import { LogOut, Save, UserRound } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BigButton, InfoCard, PageHeader, SelectField, StatusNote, TextField } from '@/shared/ui'
import { FONT_SCALE_PX, useSettingsStore, type FontScale } from '@/shared/store/useSettingsStore'
import { getAge, useUserStore } from '@/features/auth/store/useUserStore'
import type { IncomeLevel, Region } from '@/shared/types'
import type { UserProfile } from '@/features/auth/types'

const REGIONS: Region[] = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '강원']
const INCOMES: IncomeLevel[] = [
  '기초생활수급',
  '차상위',
  '중위소득 50% 이하',
  '중위소득 100% 이하',
  '해당 없음',
]
const PROVIDER_LABEL = { kakao: '카카오 계정', naver: '네이버 계정', guest: '둘러보기 모드' }
const SCALE_LABEL: Record<FontScale, string> = { normal: '보통', large: '크게', xlarge: '아주 크게' }

export function MyPage() {
  const { profile, updateProfile, logout, provider } = useUserStore()
  const { fontScale, setFontScale } = useSettingsStore()
  const [saved, setSaved] = useState(false) // 저장 결과 (다시 고치기 전까지 남음)
  const navigate = useNavigate()
  const [draft, setDraft] = useState<UserProfile>(profile)
  const set = <K extends keyof UserProfile>(k: K, v: UserProfile[K]) => {
    setSaved(false)
    setDraft((d) => ({ ...d, [k]: v }))
  }

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <PageHeader title="내 정보" desc="여기 적은 정보로 지원서와 맞춤 혜택이 자동으로 채워져요." />

      <div className="glass-sky mb-5 flex items-center gap-4 rounded-3xl p-5">
        <div className="grid size-16 place-items-center rounded-full bg-white text-brand-500 shadow-sm">
          <UserRound className="size-9" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-2xl font-extrabold">{profile.name} 님</p>
          <p className="text-base text-ink-soft">
            만 {getAge(profile.birthYear)}세 · {provider ? PROVIDER_LABEL[provider] : ''}
          </p>
        </div>
      </div>

      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault()
          updateProfile(draft)
          setSaved(true)
        }}
      >
        <InfoCard title="기본 정보">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="이름"
              value={draft.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
            <TextField
              label="출생 연도"
              type="number"
              inputMode="numeric"
              min={1920}
              max={new Date().getFullYear()}
              value={draft.birthYear}
              onChange={(e) => set('birthYear', Number(e.target.value))}
              hint={`만 ${getAge(draft.birthYear)}세`}
            />
            <TextField
              label="연락처"
              type="tel"
              value={draft.phone}
              onChange={(e) => set('phone', e.target.value)}
            />
            <SelectField
              label="거주 지역"
              options={REGIONS}
              value={draft.region}
              onChange={(e) => set('region', e.target.value as Region)}
            />
            <TextField
              label="주소"
              className="sm:col-span-2"
              value={draft.address}
              onChange={(e) => set('address', e.target.value)}
            />
            <SelectField
              label="소득 수준"
              options={INCOMES}
              value={draft.income}
              onChange={(e) => set('income', e.target.value as IncomeLevel)}
            />
            <label className="flex min-h-14 cursor-pointer items-center gap-3 self-end rounded-2xl bg-white/85 px-4 ring-2 ring-brand-100">
              <input
                type="checkbox"
                checked={draft.livingAlone}
                onChange={(e) => set('livingAlone', e.target.checked)}
                className="size-7 accent-brand-600"
              />
              <span className="text-lg font-bold">혼자 살고 있어요</span>
            </label>
            <TextField
              label="주요 경력"
              className="sm:col-span-2"
              value={draft.career}
              onChange={(e) => set('career', e.target.value)}
            />
          </div>
        </InfoCard>

        <InfoCard title="보호자 정보" subtitle="안부 미확인 시 알림을 받는 분이에요">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="보호자 이름"
              value={draft.guardianName}
              onChange={(e) => set('guardianName', e.target.value)}
            />
            <TextField
              label="보호자 연락처"
              type="tel"
              value={draft.guardianPhone}
              onChange={(e) => set('guardianPhone', e.target.value)}
            />
          </div>
        </InfoCard>

        {saved && <StatusNote onClose={() => setSaved(false)}>내 정보를 저장했어요.</StatusNote>}
        <BigButton type="submit" size="xl" fullWidth icon={<Save />}>
          저장하기
        </BigButton>
      </form>

      <InfoCard title="화면 설정" className="mt-5">
        <p className="mb-3 text-base font-bold">글자 크기</p>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="글자 크기">
          {(Object.keys(FONT_SCALE_PX) as FontScale[]).map((f) => (
            <button
              key={f}
              role="radio"
              aria-checked={fontScale === f}
              onClick={() => setFontScale(f)}
              className={`min-h-16 rounded-2xl font-bold ring-2 transition ${
                fontScale === f ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white/80 ring-brand-100'
              }`}
              style={{ fontSize: FONT_SCALE_PX[f] }}
            >
              {SCALE_LABEL[f]}
            </button>
          ))}
        </div>
      </InfoCard>

      <BigButton
        variant="ghost"
        fullWidth
        icon={<LogOut />}
        className="mt-5"
        onClick={() => {
          logout()
          navigate('/login', { replace: true })
        }}
      >
        로그아웃
      </BigButton>
    </div>
  )
}
