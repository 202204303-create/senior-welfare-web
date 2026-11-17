import { useEffect, useRef } from 'react'
import { create } from 'zustand'
import { isFirebaseEnabled } from '@/shared/api/firebase'
import { saveAlert, saveDayRecord, saveFamilyInfo } from '@/features/care/api/family'
import { todayKey, useCareStore, type DayRecord } from '@/features/care/store/useCareStore'
import { useUserStore } from '@/features/auth/store/useUserStore'

export type SyncStatus = 'off' | 'syncing' | 'ok' | 'error'

/** 서버 저장 상태 (화면 표시용, 브라우저에 저장하지 않음) */
export const useSyncStatus = create<{ status: SyncStatus; set: (s: SyncStatus) => void }>((set) => ({
  status: isFirebaseEnabled ? 'syncing' : 'off',
  set: (status) => set({ status }),
}))

const RECENT_DAYS = 7

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
}
