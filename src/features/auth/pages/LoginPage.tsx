import { Briefcase, HeartPulse, Landmark, MapPin, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { getOAuthUrl } from '@/features/auth/api/oauth'
import { BigButton } from '@/shared/ui'
import { useUserStore, type SocialProvider } from '@/features/auth/store/useUserStore'

const FEATURES = [
  { Icon: HeartPulse, title: '안부·복약 알림', desc: '약 드실 시간을 알려드려요' },
  { Icon: Briefcase, title: '일자리 한 번에 신청', desc: '지원서가 자동으로 채워져요' },
  { Icon: MapPin, title: '가까운 복지시설', desc: '내 주변 복지관을 찾아요' },
  { Icon: Landmark, title: '맞춤 복지 혜택', desc: '받을 수 있는 혜택만 골라요' },
]

export function LoginPage() {
  const { isLoggedIn, login } = useUserStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (isLoggedIn) return <Navigate to={from} replace />

  const handle = (provider: SocialProvider) => {
    if (provider !== 'guest') {
      const url = getOAuthUrl(provider)
      if (url) {
        window.location.href = url
        return
      }
    }
    // 데모 모드: 실제 OAuth 키가 없을 때 바로 로그인
    setPending(provider)
    setTimeout(() => {
      login(provider)
      navigate(from, { replace: true })
    }, 600)
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md animate-fade-up">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 grid size-24 place-items-center rounded-[2rem] bg-linear-to-br from-brand-200 via-brand-400 to-brand-600 text-white shadow-glass-lg">
            <svg viewBox="0 0 24 24" className="size-12" fill="currentColor" aria-hidden>
              <path d="M12 21s-7.5-4.6-9.6-9.3C1 8.4 3 5 6.4 5c2 0 3.3 1.1 4.1 2.3h3c.8-1.2 2.1-2.3 4.1-2.3C21 5 23 8.4 21.6 11.7 19.5 16.4 12 21 12 21Z" />
              <circle cx="12" cy="11" r="2.4" fill="#e0f2fe" />
            </svg>
          </div>
          <h1 className="text-4xl font-black tracking-tight text-brand-800">늘봄</h1>
          <p className="mt-2 text-lg text-ink-soft">어르신의 하루를 늘 봄처럼 따뜻하게</p>
        </div>

        <ul className="mb-8 grid grid-cols-2 gap-3">
          {FEATURES.map(({ Icon, title, desc }) => (
            <li key={title} className="glass rounded-3xl p-4">
              <Icon className="mb-2 size-7 text-brand-500" aria-hidden />
              <p className="text-base font-bold leading-snug">{title}</p>
              <p className="mt-0.5 text-sm text-ink-soft">{desc}</p>
            </li>
          ))}
        </ul>

        <div className="glass space-y-3 rounded-3xl p-5">
          <p className="mb-1 text-center text-base font-bold text-ink-soft">간편하게 시작하기</p>
          <button
            onClick={() => handle('kakao')}
            disabled={pending !== null}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#FEE500] text-lg font-bold text-[#191919] transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending === 'kakao' ? (
              <span className="size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden>
                <path
                  fill="#191919"
                  d="M12 3C6.48 3 2 6.58 2 11c0 2.85 1.86 5.35 4.66 6.77l-.95 3.48c-.08.3.26.54.52.37l4.13-2.73c.54.07 1.08.11 1.64.11 5.52 0 10-3.58 10-8S17.52 3 12 3Z"
                />
              </svg>
            )}
            카카오로 시작하기
          </button>
          <button
            onClick={() => handle('naver')}
            disabled={pending !== null}
            className="flex min-h-16 w-full items-center justify-center gap-3 rounded-2xl bg-[#03C75A] text-lg font-bold text-white transition active:scale-[0.98] disabled:opacity-60"
          >
            {pending === 'naver' ? (
              <span className="size-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" />
            ) : (
              <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
                <path fill="#fff" d="M16.27 12.84 7.46 0H0v24h7.73V11.16L16.54 24H24V0h-7.73z" />
              </svg>
            )}
            네이버로 시작하기
          </button>
          <BigButton
            variant="ghost"
            fullWidth
            onClick={() => handle('guest')}
            disabled={pending !== null}
            loading={pending === 'guest'}
          >
            로그인 없이 둘러보기
          </BigButton>
          <Link
            to="/guardian"
            className="flex min-h-12 items-center justify-center rounded-2xl text-base font-bold text-violet-700 hover:bg-violet-50"
          >
            보호자이신가요? 보호자 화면으로
          </Link>
        </div>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-sm text-ink-soft">
          <ShieldCheck className="size-4 text-brand-500" aria-hidden />
          개인정보는 안전하게 보호되며, 동의 없이 공유되지 않아요.
        </p>
      </div>
    </div>
  )
}
