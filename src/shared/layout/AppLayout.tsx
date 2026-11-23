import { Briefcase, HeartPulse, Home, Landmark, MapPin, Type, UserRound } from 'lucide-react'
import { useEffect } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { MedReminderBanner } from '@/features/care/components/CareWidgets'
import { useCareReminder } from '@/features/care/hooks/useCareReminder'
import { useCareSync } from '@/features/care/hooks/useCareSync'
import { useCareWatcher } from '@/features/care/hooks/useCareWatcher'
import { FONT_SCALE_PX, useSettingsStore, type FontScale } from '@/shared/store/useSettingsStore'
import { useUserStore } from '@/features/auth/store/useUserStore'
import { InstallBanner, Toast } from '@/shared/ui'

const NAV = [
  { to: '/', label: '홈', Icon: Home, end: true },
  { to: '/care', label: '안부·복약', Icon: HeartPulse },
  { to: '/jobs', label: '일자리', Icon: Briefcase },
  { to: '/map', label: '시설 지도', Icon: MapPin },
  { to: '/policies', label: '복지 혜택', Icon: Landmark },
] as const

const SCALE_ORDER: FontScale[] = ['normal', 'large', 'xlarge']
const SCALE_LABEL: Record<FontScale, string> = { normal: '보통', large: '크게', xlarge: '아주 크게' }

export function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2.5" aria-label="늘봄 홈으로">
      <span className="grid size-11 place-items-center rounded-2xl bg-linear-to-br from-brand-300 to-brand-600 text-white shadow-glass">
        <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden>
          <path
            d="M12 21s-7.5-4.6-9.6-9.3C1 8.4 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3h3c.8-1.2 2.1-2.3 4.1-2.3C21 5 23 8.4 21.6 11.7 19.5 16.4 12 21 12 21Z"
            opacity=".95"
          />
          <circle cx="12" cy="11" r="2.4" fill="#e0f2fe" />
        </svg>
      </span>
      <span className="leading-none">
        <span className="block text-xl font-black tracking-tight text-brand-800">늘봄</span>
        <span className="block text-xs font-semibold text-brand-600/80">시니어 통합 복지</span>
      </span>
    </Link>
  )
}

export function AppLayout() {
  useCareWatcher()
  useCareSync()
  useCareReminder()
  const { fontScale, setFontScale } = useSettingsStore()
  const profile = useUserStore((s) => s.profile)
  const { pathname } = useLocation()

  useEffect(() => {
    document.documentElement.style.fontSize = `${FONT_SCALE_PX[fontScale]}px`
  }, [fontScale])

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  const cycleFont = () => setFontScale(SCALE_ORDER[(SCALE_ORDER.indexOf(fontScale) + 1) % SCALE_ORDER.length])

  return (
    <div className="min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-3"
      >
        본문으로 바로가기
      </a>

      {/* 상단 헤더 */}
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/60 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <Logo />
          <nav className="ml-6 hidden items-center gap-1 md:flex" aria-label="주요 메뉴">
            {NAV.map(({ to, label, Icon, ...rest }) => (
              <NavLink
                key={to}
                to={to}
                end={'end' in rest}
                className={({ isActive }) =>
                  `flex min-h-12 items-center gap-2 rounded-2xl px-4 text-base font-bold transition ${
                    isActive
                      ? 'bg-brand-100 text-brand-800'
                      : 'text-ink-soft hover:bg-white/80 hover:text-brand-700'
                  }`
                }
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={cycleFont}
              className="flex min-h-12 items-center gap-1.5 rounded-2xl bg-white/80 px-3.5 text-base font-bold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-50"
              aria-label={`글자 크기 변경, 현재 ${SCALE_LABEL[fontScale]}`}
            >
              <Type className="size-5" aria-hidden />
              <span className="hidden sm:inline">글자</span> {SCALE_LABEL[fontScale]}
            </button>
            <NavLink
              to="/my"
              className={({ isActive }) =>
                `grid size-12 place-items-center rounded-2xl ring-1 transition ${
                  isActive
                    ? 'bg-brand-600 text-white ring-brand-600'
                    : 'bg-white/80 text-brand-700 ring-brand-100 hover:bg-brand-50'
                }`
              }
              aria-label={`${profile.name} 님 내 정보`}
            >
              <UserRound className="size-6" />
            </NavLink>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto max-w-6xl px-4 pb-32 pt-5 sm:px-6 md:pb-12">
        <InstallBanner />
        {/* 안부·복약 화면에는 복약 체크 목록이 있으므로 배너를 띄우지 않습니다. */}
        {pathname !== '/care' && <MedReminderBanner />}
        <Outlet />
      </main>

      {/* 모바일 하단 탭바 */}
      <nav
        className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/80 bg-white/75 backdrop-blur-xl md:hidden"
        aria-label="하단 메뉴"
      >
        <ul className="mx-auto grid max-w-lg grid-cols-5 px-1 pt-1.5">
          {NAV.map(({ to, label, Icon, ...rest }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={'end' in rest}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl text-[0.8rem] font-bold transition ${
                    isActive ? 'text-brand-700' : 'text-ink-soft'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid h-8 w-12 place-items-center rounded-full transition ${isActive ? 'bg-brand-100' : ''}`}
                    >
                      <Icon className="size-6" aria-hidden strokeWidth={isActive ? 2.5 : 2} />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Toast />
    </div>
  )
}
