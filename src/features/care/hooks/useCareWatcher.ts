import { useCallback, useEffect } from 'react'
import { timeToMinutes, todayKey, useCareStore, type AlertChannel } from '@/features/care/store/useCareStore'
import { useUserStore } from '@/features/auth/store/useUserStore'
import { useSettingsStore } from '@/shared/store/useSettingsStore'
import { useNow } from '@/shared/hooks/useNow'
import type { Medication } from '@/features/care/types'

export type MedStatus = 'taken' | 'upcoming' | 'due' | 'missed'

export function getMedStatus(
  med: Medication,
  takenAt: string | undefined,
  now: Date,
  graceMin: number,
): MedStatus {
  if (takenAt) return 'taken'
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const t = timeToMinutes(med.time)
  if (nowMin < t - 30) return 'upcoming'
  if (nowMin <= t + graceMin) return 'due'
  return 'missed'
}

export const CHANNEL_LABEL: Record<AlertChannel, string> = {
  webpush: '웹 푸시',
  kakao: '카카오톡',
  sms: '문자(SMS)',
}

function sendWebPush(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon.svg', tag: title })
  } catch {
    /* 일부 모바일 브라우저는 서비스워커 없이 생성 불가 */
  }
}

/**
 * 기상 확인 / 복약 체크 미확인 시 보호자·복지사에게 긴급 알림을 보냅니다.
 * 실제 카카오톡·SMS 발송은 백엔드에서 처리하며, 프론트엔드에서는 발송 요청 기록을 남깁니다.
 */
export function useAlertDispatch() {
  const channels = useCareStore((s) => s.channels)
  const pushAlert = useCareStore((s) => s.pushAlert)
  const profile = useUserStore((s) => s.profile)
  const showToast = useSettingsStore((s) => s.showToast)

  const dispatch = useCallback(
    (key: string, reason: string) => {
      const recipients = [profile.guardianName, '담당 사회복지사']
      const sent = pushAlert(key, { reason, channels, recipients })
      if (!sent) return
      if (channels.includes('webpush')) sendWebPush('늘봄 안부 알림', reason)
      showToast(`보호자께 알림을 보냈어요: ${reason}`, 'warn')
    },
    [channels, profile.guardianName, pushAlert, showToast],
  )

  const sendSOS = useCallback(() => {
    dispatch(`sos-${Date.now()}`, `${profile.name} 님이 긴급 도움 요청 버튼을 누르셨어요.`)
  }, [dispatch, profile.name])

  return { dispatch, sendSOS }
}

/** 앱 전체에서 한 번만 실행되는 안부·복약 감시 훅 */
export function useCareWatcher() {
  const now = useNow(30_000)
  const { medications, records, wakeUpDeadline, medGraceMinutes } = useCareStore()
  const profile = useUserStore((s) => s.profile)
  const isLoggedIn = useUserStore((s) => s.isLoggedIn)
  const { dispatch } = useAlertDispatch()

  useEffect(() => {
    if (!isLoggedIn) return
    const k = todayKey(now)
    const rec = records[k] ?? { takenMeds: {} }
    const nowMin = now.getHours() * 60 + now.getMinutes()

    if (!rec.wakeUpAt && nowMin > timeToMinutes(wakeUpDeadline)) {
      dispatch(`${k}-wake`, `${profile.name} 님이 ${wakeUpDeadline}까지 기상 확인을 하지 않으셨어요.`)
    }

    for (const med of medications) {
      if (getMedStatus(med, rec.takenMeds[med.id], now, medGraceMinutes) === 'missed') {
        dispatch(
          `${k}-med-${med.id}`,
          `${profile.name} 님이 ${med.slot} 약(${med.name})을 아직 드시지 않았어요.`,
        )
      }
    }
  }, [now, records, medications, wakeUpDeadline, medGraceMinutes, isLoggedIn, profile.name, dispatch])
}

export async function requestPushPermission(): Promise<NotificationPermission | 'unsupported'> {
  if (typeof Notification === 'undefined') return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}
