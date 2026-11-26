import { useEffect } from 'react'
import { useUserStore } from '@/features/auth/store/useUserStore'
import { timeToMinutes, todayKey, useCareStore } from '@/features/care/store/useCareStore'
import { useNow } from '@/shared/hooks/useNow'
import { showSystemNotification, speak } from '@/shared/lib/notify'
import { useSettingsStore } from '@/shared/store/useSettingsStore'

/** 기상 마감 몇 분 전에 어르신께 안내할지 */
export const WAKE_REMIND_BEFORE_MIN = 30

/**
 * 어르신 본인에게 드리는 안내입니다. (보호자 알림과는 별개)
 * - 약 드실 시각이 되면: 휴대폰 알림 + 음성 (화면에는 안내 배너가 계속 떠 있음)
 * - 기상 확인 마감 30분 전까지 '일어났어요'를 누르지 않으셨으면: 같은 방식으로 안내
 * 같은 안내는 하루에 한 번만 드립니다.
 */
export function useCareReminder() {
  const now = useNow(30_000)
  const isLoggedIn = useUserStore((s) => s.isLoggedIn)
  const { medications, records, wakeUpDeadline, medGraceMinutes, markReminded } = useCareStore()

  useEffect(() => {
    if (!isLoggedIn) return
    const k = todayKey(now)
    const rec = records[k] ?? { takenMeds: {} }
    const nowMin = now.getHours() * 60 + now.getMinutes()
    // tag: 서버가 보내는 같은 안내와 같은 꼬리표 → 휴대폰에 두 번 쌓이지 않고 하나로 겹칩니다.
    const messages: { text: string; tag?: string }[] = []

    const deadline = timeToMinutes(wakeUpDeadline)
    if (
      !rec.wakeUpAt &&
      nowMin >= deadline - WAKE_REMIND_BEFORE_MIN &&
      nowMin <= deadline &&
      markReminded(`${k}-wake`)
    ) {
      messages.push({ text: `좋은 아침이에요. 일어나셨으면 '일어났어요' 버튼을 눌러 주세요.` })
    }

    for (const med of medications) {
      const t = timeToMinutes(med.time)
      if (
        !rec.takenMeds[med.id] &&
        nowMin >= t &&
        nowMin <= t + medGraceMinutes &&
        markReminded(`${k}-med-${med.id}`)
      ) {
        messages.push({
          text: `${med.name} 드실 시간이에요. 드신 뒤 '먹었어요'를 눌러 주세요.`,
          tag: `${k}-remind-${med.id}`,
        })
      }
    }

    if (!messages.length) return
    messages.forEach((m) => showSystemNotification('늘봄', m.text, 'warn', m.tag))
    if (useSettingsStore.getState().voiceGuide) speak(messages.map((m) => m.text).join(' '))
  }, [now, records, medications, wakeUpDeadline, medGraceMinutes, isLoggedIn, markReminded])
}

/**
 * 휴대폰 알림(PWA)과 음성 안내(설정이 켜져 있을 때)로 알려 드립니다.
 * 몇 초 뒤 사라지는 토스트는 쓰지 않고, 화면에는 안내 배너·상태 표시가 계속 남습니다.
 */
export function announce(text: string) {
  showSystemNotification('늘봄', text)
  if (useSettingsStore.getState().voiceGuide) speak(text)
}
