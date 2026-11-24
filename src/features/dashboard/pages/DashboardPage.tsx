import { ChevronRight, Pill } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  MedChecklist,
  MedProgress,
  SOSButton,
  StartGuide,
  WakeUpCard,
} from '@/features/care/components/CareWidgets'
import { FirstSetup } from '@/features/care/components/FirstSetup'
import { InfoCard } from '@/shared/ui'
import { useUserStore } from '@/features/auth/store/useUserStore'

/** 어르신 첫 화면: 아침 안부 → 오늘의 약 → 긴급 요청 순서로 크게 보여 줍니다. */
export function DashboardPage() {
  const profile = useUserStore((s) => s.profile)
  const today = new Date().toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' })

  return (
    <div className="mx-auto max-w-2xl animate-fade-up space-y-5">
      <div>
        <p className="text-base font-semibold text-brand-600">{today}</p>
        <h1 className="text-[1.75rem] font-extrabold leading-tight tracking-tight">
          {profile.name} 님, 안녕하세요
        </h1>
      </div>

      <FirstSetup />

      {/* 가장 중요한 '일어났어요'가 첫 화면에 바로 보이도록 맨 위에 둡니다. */}
      <WakeUpCard />

      <InfoCard
        title="오늘의 약"
        icon={<Pill />}
        action={
          <Link
            to="/care"
            className="flex min-h-11 items-center gap-0.5 rounded-xl px-2 text-base font-bold text-brand-600 hover:bg-brand-50"
          >
            약 고치기 <ChevronRight className="size-5" aria-hidden />
          </Link>
        }
      >
        <div className="mb-4">
          <MedProgress />
        </div>
        <MedChecklist />
      </InfoCard>

      <SOSButton />

      {/* 처음 쓰는 법 안내는 핵심 버튼들 아래에 둡니다. */}
      <StartGuide />
    </div>
  )
}
