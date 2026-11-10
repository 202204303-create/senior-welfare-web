import { CheckCircle2, Send, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApplyMutation, useJobQuery } from '@/features/jobs/api/queries'
import {
  BigButton,
  BigLink,
  ErrorState,
  InfoCard,
  LoadingList,
  PageHeader,
  TextField,
  VoiceInputBox,
} from '@/shared/ui'
import { dDayLabel } from '@/features/jobs/lib/jobs'
import { useApplicationStore } from '@/features/jobs/store/useApplicationStore'
import { getAge, useUserStore } from '@/features/auth/store/useUserStore'

export function JobApplyPage() {
  const { id } = useParams()
  const { data: job, isLoading, isError, error, refetch } = useJobQuery(id)
  const profile = useUserStore((s) => s.profile)
  const alreadyApplied = useApplicationStore((s) => s.applications.some((a) => a.postingId === id))
  const apply = useApplyMutation()

  // 프로필 기반 자동 완성 (Auto-fill)
  const [form, setForm] = useState({
    name: profile.name,
    age: String(getAge(profile.birthYear)),
    phone: profile.phone,
    address: profile.address,
    career: profile.career,
  })
  const [message, setMessage] = useState('')
  const [agree, setAgree] = useState(false)

  const isAuto = (k: keyof typeof form) => {
    const orig = {
      name: profile.name,
      age: String(getAge(profile.birthYear)),
      phone: profile.phone,
      address: profile.address,
      career: profile.career,
    }
    return form[k] === orig[k] && form[k] !== ''
  }

  if (isLoading) return <LoadingList count={2} />
  if (isError || !job)
    return <ErrorState message={(error as Error | null)?.message} onRetry={() => refetch()} />

  if (apply.isSuccess || alreadyApplied) {
    return (
      <div className="mx-auto max-w-lg animate-fade-up py-8 text-center">
        <div className="mx-auto mb-5 grid size-24 place-items-center rounded-full bg-emerald-500 text-white shadow-lg">
          <CheckCircle2 className="size-14" aria-hidden />
        </div>
        <h1 className="text-3xl font-black">신청이 완료되었어요!</h1>
        <p className="mt-3 text-lg text-ink-soft">
          <b className="text-ink">{job.title}</b>
          <br />
          담당자가 확인 후 <b className="text-ink">{profile.phone}</b>로 연락드릴 예정이에요.
        </p>
        <div className="mt-8 space-y-3">
          <BigLink to="/jobs" fullWidth size="xl">
            다른 공고 보기
          </BigLink>
          <BigLink to="/" variant="ghost" fullWidth>
            홈으로
          </BigLink>
        </div>
      </div>
    )
  }

  const submit = () =>
    apply.mutate({
      postingId: job.id,
      postingTitle: job.title,
      profile: { ...profile, name: form.name, phone: form.phone, address: form.address, career: form.career },
      message,
    })

  return (
    <div className="mx-auto max-w-3xl animate-fade-up">
      <PageHeader back title="원클릭 지원서" desc="자동으로 채워진 내용을 확인하고 신청하세요." />

      <InfoCard tone="sky" className="mb-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-brand-700">
            {job.kind === 'job' ? '일자리' : '프로그램'} · {job.category}
          </span>
          <span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-bold text-rose-600">
            {dDayLabel(job.deadline)}
          </span>
        </div>
        <h2 className="text-2xl font-extrabold leading-snug">{job.title}</h2>
        <p className="mt-1 text-base text-ink-soft">
          {job.org} · {job.pay} · {job.schedule}
        </p>
        <p className="mt-3 text-base leading-relaxed">{job.description}</p>
      </InfoCard>

      <form
        className="glass space-y-5 rounded-3xl p-5 sm:p-6"
        onSubmit={(e) => {
          e.preventDefault()
          if (agree) submit()
        }}
      >
        <div className="flex items-center gap-2 rounded-2xl bg-brand-50 p-3 text-base font-semibold text-brand-700">
          <Wand2 className="size-5 shrink-0" aria-hidden />
          회원 정보로 지원서를 자동 작성했어요.
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="이름"
            autoFilled={isAuto('name')}
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            autoComplete="name"
          />
          <TextField
            label="나이 (만)"
            autoFilled={isAuto('age')}
            value={form.age}
            readOnly
            inputMode="numeric"
          />
          <TextField
            label="연락처"
            autoFilled={isAuto('phone')}
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
            type="tel"
            autoComplete="tel"
          />
          <TextField
            label="주소"
            autoFilled={isAuto('address')}
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            required
            autoComplete="street-address"
          />
        </div>
        <TextField
          label="주요 경력"
          autoFilled={isAuto('career')}
          value={form.career}
          onChange={(e) => setForm({ ...form, career: e.target.value })}
        />

        <VoiceInputBox
          label="하고 싶은 말 (선택)"
          multiline
          value={message}
          onChange={setMessage}
          placeholder="예: 성실하게 열심히 하겠습니다."
        />

        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-white/80 p-4 ring-1 ring-brand-100">
          <input
            type="checkbox"
            checked={agree}
            onChange={(e) => setAgree(e.target.checked)}
            className="mt-0.5 size-7 shrink-0 accent-brand-600"
          />
          <span className="text-base">
            <b>개인정보 제공에 동의합니다.</b>
            <span className="block text-sm text-ink-soft">
              지원서 내용은 모집 기관({job.org})에만 전달돼요.
            </span>
          </span>
        </label>

        {apply.isError && (
          <p role="alert" className="rounded-2xl bg-rose-50 p-4 text-base font-semibold text-rose-700">
            {(apply.error as Error).message}
          </p>
        )}

        <BigButton
          type="submit"
          size="xl"
          fullWidth
          icon={<Send />}
          disabled={!agree}
          loading={apply.isPending}
        >
          {apply.isPending ? '신청하는 중…' : apply.isError ? '다시 신청하기' : '이대로 신청하기'}
        </BigButton>
      </form>
    </div>
  )
}
