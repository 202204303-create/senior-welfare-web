import { useCallback, useEffect } from 'react'
import { timeToMinutes, todayKey, useCareStore, type AlertChannel } from '@/features/care/store/useCareStore'
import { useUserStore } from '@/features/auth/store/useUserStore'
import { hasAssignedWorker } from '@/features/auth/lib/demoAccounts'
import { useNow } from '@/shared/hooks/useNow'
import type { Medication } from '@/features/care/types'

/** later: 오늘 복용 시각이 지난 뒤 등록·변경한 약 (오늘은 챙기지 않고 내일부터) */
export type MedStatus = 'taken' | 'upcoming' | 'due' | 'missed' | 'later'

export function getMedStatus(
  med: Medication,
  takenAt: string | undefined,
  now: Date,
  graceMin: number,
): MedStatus {
  if (takenAt) return 'taken'
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const t = timeToMinutes(med.time)
  if (med.createdAt) {
    const created = new Date(med.createdAt)
    const createdMin = created.getHours() * 60 + created.getMinutes()
    if (todayKey(created) === todayKey(now) && createdMin > t + graceMin) return 'later'
  }
  if (nowMin < t - 30) return 'upcoming'
  if (nowMin <= t + graceMin) return 'due'
  return 'missed'
}

/** 실제로 동작하는 알림 방식. 카카오톡·문자는 백엔드 연동 전이라 '준비 중' */
export const READY_CHANNELS: AlertChannel[] = ['webpush']

export const CHANNEL_LABEL: Record<AlertChannel, string> = {
  webpush: '휴대폰 알림',
  kakao: '카카오톡',
  sms: '문자(SMS)',
}

/**
 * 기상 확인 / 복약 체크 미확인 시 보호자·복지사에게 긴급 알림을 보냅니다.
 * 실제 카카오톡·SMS 발송은 백엔드에서 처리하며, 프론트엔드에서는 발송 요청 기록을 남깁니다.
 */
export function useAlertDispatch() {
  const pushAlert = useCareStore((s) => s.pushAlert)
  const profile = useUserStore((s) => s.profile)

  const dispatch = useCallback(
    (key: string, reason: string) => {
      const recipients = [
        profile.guardianName.trim() || '보호자',
        ...(hasAssignedWorker(useCareStore.getState().familyCode) ? ['담당 사회복지사'] : []),
      ]
      // 카카오톡·문자는 아직 실제로 보내지 않으므로, 실제로 쓰는 휴대폰 알림만 기록합니다.
      const sent = pushAlert(key, {
        reason,
        // '알림 보낼 방법' 버튼을 없앴으므로, 예전에 꺼 둔 기기도 실제로 쓰는 휴대폰 알림으로 기록합니다.
        channels: [...READY_CHANNELS],
        recipients,
      })
      if (!sent) return
      // 보호자용 휴대폰 알림은 보호자 화면(/guardian)이 띄웁니다. 어르신 휴대폰에는 띄우지 않습니다.
    },
    [profile.guardianName, pushAlert],
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
