import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import {
  saveAlert,
  saveDayRecord,
  saveFamilyInfo,
  saveHeartbeat,
  watchAlerts,
} from '@/features/care/api/family'
import { remind } from '@/features/care/hooks/useCareReminder'
import { todayKey, useCareStore, type DayRecord } from '@/features/care/store/useCareStore'
import { useUserStore } from '@/features/auth/store/useUserStore'

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error'

/** 서버 저장 상태 (화면 표시용, 브라우저에 저장하지 않음) */
export const useSyncStatus = create<{ status: SyncStatus; set: (s: SyncStatus) => void }>((set) => ({
  status: isFirebaseEnabled ? 'syncing' : 'off',
  set: (status) => set({ status }),
}))

const RECENT_DAYS = 7
const HEARTBEAT_MS = 5 * 60 * 1000 // 5분마다 '앱 사용 중'을 알림

function track(p: Promise<unknown>) {
  const { set } = useSyncStatus.getState()
  set('syncing')
  p.then(() => set('ok')).catch((e) => {
    console.warn('[늘봄] 서버 저장 실패', e)
    set('error')
  })
}

/**
 * 어르신 기기에서 기상·복약 기록, 약 목록, 알림을 Firestore 에 올립니다.
 * 보호자 화면(/guardian)은 이 데이터를 실시간으로 읽습니다.
 * Firebase 설정이 없으면 아무것도 하지 않습니다.
 */
export function useCareSync() {
  const isLoggedIn = useUserStore((s) => s.isLoggedIn)
  const elderName = useUserStore((s) => s.profile.name)
  const elderPhone = useUserStore((s) => s.profile.phone)
  const guardianName = useUserStore((s) => s.profile.guardianName)
  const { familyCode, medications, wakeUpDeadline, medGraceMinutes, records, alerts } = useCareStore()
  const active = isFirebaseEnabled && isLoggedIn

  // 약 목록과 알림 기준
  useEffect(() => {
    if (!active) return
    track(
      saveFamilyInfo(familyCode, {
        elderName,
        elderPhone,
        guardianName,
        medications,
        wakeUpDeadline,
        medGraceMinutes,
      }),
    )
  }, [active, familyCode, elderName, elderPhone, guardianName, medications, wakeUpDeadline, medGraceMinutes])

  // 날짜별 기상·복약 기록: 바뀐 날짜만 올립니다. 처음에는 최근 7일치를 올립니다.
  const prevRecords = useRef<Record<string, DayRecord> | null>(null)
  useEffect(() => {
    if (!active) return
    const prev = prevRecords.current
    const since = todayKey(new Date(Date.now() - RECENT_DAYS * 86_400_000))
    const changed = Object.entries(records).filter(([k, rec]) => k >= since && (!prev || prev[k] !== rec))
    prevRecords.current = records
    if (changed.length) track(Promise.all(changed.map(([k, rec]) => saveDayRecord(familyCode, k, rec))))
  }, [active, familyCode, records])

  // 알림 기록: 아직 올리지 않은 것만 올립니다.
  const sentIds = useRef(new Set<string>())
  useEffect(() => {
    if (!active) return
    const fresh = alerts.filter((a) => !sentIds.current.has(a.id))
    fresh.forEach((a) => sentIds.current.add(a.id))
    if (fresh.length) track(Promise.all(fresh.map((a) => saveAlert(familyCode, a))))
  }, [active, familyCode, alerts])

  // 마지막 활동 시각: 앱을 열 때, 다시 화면에 돌아올 때, 5분마다 올립니다.
  useEffect(() => {
    if (!active) return
    const beat = () => {
      if (document.visibilityState === 'visible') saveHeartbeat(familyCode).catch(() => {})
    }
    beat()
    const id = setInterval(beat, HEARTBEAT_MS)
    document.addEventListener('visibilitychange', beat)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', beat)
    }
  }, [active, familyCode])

  // 보호자의 '확인했어요'를 받아 내 알림 기록에 표시하고, 새로 확인되면 소리로 알려 드립니다.
  useEffect(() => {
    if (!active) return
    return watchAlerts(
      familyCode,
      (list) => {
        const local = new Map(useCareStore.getState().alerts.map((a) => [a.id, a]))
        const newlyAcked = list.filter((a) => a.ackAt && local.has(a.id) && !local.get(a.id)!.ackAt)
        useCareStore.getState().applyAcks(list)
        if (newlyAcked.length) {
          const who = newlyAcked[0].ackBy ?? '보호자'
          const sos = newlyAcked.some((a) => a.kind === 'sos')
          remind(
            sos ? `${who}님이 긴급 요청을 확인했어요. 곧 연락드릴 거예요.` : `${who}님이 알림을 확인했어요.`,
            'success',
          )
        }
      },
      (e) => console.warn('[늘봄] 확인 응답 받기 실패', e),
    )
  }, [active, familyCode])
}
