import { BellRing, HeartPulse, ShieldCheck, Siren, Sun, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BigButton, StatusNote, TextField } from '@/shared/ui'
import { useAccountAuth } from '@/features/auth/hooks/useAccountAuth'
import { DEMO_ACCOUNTS, findAccount, homePathOf } from '@/features/auth/lib/demoAccounts'
import { useUserStore, type SocialProvider } from '@/features/auth/store/useUserStore'

const FEATURES = [
  { Icon: Sun, title: '아침 안부 확인', desc: '버튼 하나로 잘 지내심을 알려요' },
  { Icon: HeartPulse, title: '복약 알림·체크', desc: '약 드실 시간을 알려드려요' },
  { Icon: Siren, title: '긴급 도움 요청', desc: '보호자에게 바로 알려요' },
  { Icon: BellRing, title: '보호자 휴대폰 알림', desc: '화면이 꺼져 있어도 도착해요' },
]

export function LoginPage() {
  const { isLoggedIn, role, login } = useUserStore()
  const { signIn } = useAccountAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [pending, setPending] = useState<SocialProvider | null>(null)
  const [id, setId] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (isLoggedIn) return <Navigate to={role && role !== 'elder' ? homePathOf(role) : from} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const account = findAccount(id, password)
    if (!account) {
      setError('아이디나 비밀번호가 맞지 않아요. 아래 시연용 계정을 눌러 보세요.')
      return
    }
    setError(null)
    signIn(account, from)
  }

  // 로그인 없이 둘러보기: 사용자(어르신) 화면을 바로 엽니다.
  const guest = () => {
    setPending('guest')
    setTimeout(() => {
      login('guest')
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

        <form onSubmit={submit} className="glass space-y-4 rounded-3xl p-5">
          <p className="text-center text-base font-bold text-ink-soft">로그인</p>
          <TextField
            label="아이디"
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="username"
            autoCapitalize="none"
            placeholder="예: senior"
          />
          <TextField
            label="비밀번호"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
          {error && <StatusNote tone="warn">{error}</StatusNote>}
          <BigButton type="submit" size="xl" fullWidth icon={<UserRound />}>
            로그인
          </BigButton>

          <fieldset className="rounded-2xl bg-brand-50/80 p-3 ring-1 ring-brand-100">
            <legend className="px-2 text-sm font-bold text-brand-800">시연용 계정 (눌러서 채우기)</legend>
            <ul className="space-y-2">
              {DEMO_ACCOUNTS.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setId(a.id)
                      setPassword(a.password)
                      setError(null)
                    }}
                    className="flex min-h-14 w-full flex-col items-start gap-1 rounded-xl bg-white/90 px-4 py-3 text-left ring-1 ring-brand-100 transition active:scale-[0.98]"
                  >
                    <span>
                      <span className="block text-base font-bold">{a.label}</span>
                      <span className="block text-sm text-ink-soft">{a.desc}</span>
                    </span>
                    <span className="font-mono text-sm font-bold text-brand-700">
                      {a.id} / {a.password}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 px-1 text-xs text-ink-soft">
              시연용이라 아이디와 비밀번호가 화면에 보여요. 실제 서비스에서는 바뀝니다.
            </p>
          </fieldset>

          <BigButton
            variant="ghost"
            fullWidth
            onClick={guest}
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
        </form>

        <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-sm text-ink-soft">
          <ShieldCheck className="size-4 text-brand-500" aria-hidden />
          개인정보는 안전하게 보호되며, 동의 없이 공유되지 않아요.
        </p>
      </div>
    </div>
  )
}
