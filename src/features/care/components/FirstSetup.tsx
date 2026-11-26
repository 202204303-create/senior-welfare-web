import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEFAULT_PROFILE, useUserStore } from '@/features/auth/store/useUserStore'
import { useSampleMode } from '@/features/care/hooks/useSampleMode'
import { useCareStore } from '@/features/care/store/useCareStore'
import { BigButton, TextField } from '@/shared/ui'

/**
 * 처음 쓰는 어르신에게 '지금 보이는 이름과 약은 예시'라는 것을 알려 주고,
 * 이름만 넣으면 예시 약을 지우고 바로 내 약을 넣을 수 있게 합니다.
 * 시연 계정(senior)은 예시 정보로 시연하므로 보이지 않습니다.
 */
export function FirstSetup() {
  const navigate = useNavigate()
  const { finishSetup } = useCareStore()
  const { profile, updateProfile } = useUserStore()
  const [name, setName] = useState('')
  const sampleMode = useSampleMode()

  if (!sampleMode) return null

  const clean = name.trim()
  return (
    <section className="rounded-3xl bg-amber-50 p-5 ring-2 ring-amber-200" aria-label="처음 설정">
      <p className="flex items-center gap-2 text-xl font-black text-amber-900">
        <Sparkles className="size-6 shrink-0" aria-hidden />
        처음 오셨나요?
      </p>
      <p className="mt-1 text-base text-ink">
        지금 보이는 이름({profile.name})·보호자·약은 <b>예시</b>예요. 이름을 넣으면 예시를 지우고 내 약을 넣을
        수 있어요.
      </p>
      <form
        className="mt-4 space-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          if (!clean) return
          // 예시 연락처·보호자 정보도 함께 비웁니다. (모르는 사람 이름이 알림에 나오지 않게)
          const sample = (k: 'phone' | 'guardianName' | 'guardianPhone') =>
            profile[k] === DEFAULT_PROFILE[k] ? '' : profile[k]
          updateProfile({
            name: clean,
            phone: sample('phone'),
            guardianName: sample('guardianName'),
            guardianPhone: sample('guardianPhone'),
            // 예시 출생 연도·'혼자 살아요'도 비웁니다. (내 정보에서 다시 넣기)
            birthYear: profile.birthYear === DEFAULT_PROFILE.birthYear ? 0 : profile.birthYear,
            livingAlone: profile.livingAlone === DEFAULT_PROFILE.livingAlone ? false : profile.livingAlone,
          })
          finishSetup(true)
          navigate('/care')
        }}
      >
        <TextField
          label="내 이름"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 홍길동"
        />
        <BigButton type="submit" fullWidth size="lg" disabled={!clean}>
          내 정보로 시작하기
        </BigButton>
      </form>
      <button
        type="button"
        onClick={() => finishSetup(false)}
        className="mt-2 min-h-12 w-full rounded-2xl text-base font-bold text-ink-soft hover:bg-amber-100"
      >
        예시 그대로 둘러볼게요
      </button>
    </section>
  )
}
