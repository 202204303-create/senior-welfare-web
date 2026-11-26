import { BellRing, X } from 'lucide-react'
import { useState } from 'react'
import { DEMO_FAMILY_CODE } from '@/features/auth/lib/demoAccounts'
import { PushPermission } from '@/features/care/components/PushPermission'
import { useCareStore } from '@/features/care/store/useCareStore'

const DISMISS_KEY = 'neulbom-elder-push-asked'

const readDismissed = () => {
  try {
    return localStorage.getItem(DISMISS_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * 첫 설정을 마친 어르신께 '약 시간에 휴대폰으로 알려 드릴까요?'를 한 번 묻습니다.
 * 허락을 받아야 앱을 닫아 두어도 약 시간 안내가 휴대폰으로 와요.
 * (허락했거나, 거절했거나, '나중에'를 누르면 다시 묻지 않음. 알림 화면에서 언제든 켤 수 있음)
 */
export function ElderPushPrompt() {
  const { setupDone, familyCode } = useCareStore()
  const [dismissed, setDismissed] = useState(readDismissed)
  const [granted, setGranted] = useState(false)

  const permission = typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  if (!setupDone || familyCode === DEMO_FAMILY_CODE || dismissed) return null
  if (permission !== 'default' && !granted) return null

  const close = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* 저장 못 해도 이번 화면에서는 닫힘 */
    }
    setDismissed(true)
  }

  return (
    <section
      className="relative rounded-3xl bg-brand-50 p-5 ring-2 ring-brand-200"
      aria-label="휴대폰 알림 켜기"
    >
      <button
        type="button"
        onClick={close}
        aria-label="닫기"
        className="absolute top-3 right-3 grid size-11 place-items-center rounded-full text-ink-soft hover:bg-brand-100"
      >
        <X className="size-6" aria-hidden />
      </button>
      <p className="flex items-center gap-2 pr-10 text-xl font-black text-brand-800">
        <BellRing className="size-6 shrink-0" aria-hidden />약 시간에 휴대폰으로 알려 드릴까요?
      </p>
      <p className="mt-1 mb-3 text-base text-ink">
        아래 버튼을 누르고 <b>허용</b>을 눌러 주세요. 늘봄을 닫아 두어도 약 드실 시간에 알려 드려요.
      </p>
      <PushPermission
        label="휴대폰 알림 켜기"
        role="elder"
        familyCode={familyCode}
        onGranted={() => setGranted(true)}
      />
      {!granted && (
        <button
          type="button"
          onClick={close}
          className="mt-2 min-h-12 w-full rounded-2xl text-base font-bold text-ink-soft hover:bg-brand-100"
        >
          나중에 할게요
        </button>
      )}
      {granted && (
        <button
          type="button"
          onClick={close}
          className="mt-2 min-h-12 w-full rounded-2xl text-base font-bold text-brand-700 hover:bg-brand-100"
        >
          확인
        </button>
      )}
    </section>
  )
}
