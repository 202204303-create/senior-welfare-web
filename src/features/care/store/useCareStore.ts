import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Medication } from '@/features/care/types'

export type AlertChannel = 'webpush' | 'kakao' | 'sms'

export type AlertKind = 'wake' | 'med' | 'sos'

export interface AlertLog {
  id: string
  /** 중복 방지 키 (예: 2026-11-17-wake, 2026-11-17-med-m-1, sos-1731800000000) */
  key?: string
  kind?: AlertKind
  at: string
  reason: string
  channels: AlertChannel[]
  recipients: string[]
  /** 보호자가 확인한 시각 (ISO) */
  ackAt?: string
  /** 확인한 보호자 이름 */
  ackBy?: string
}

export interface DayRecord {
  wakeUpAt?: string // ISO
  takenMeds: Record<string, string> // medId -> ISO
}

interface CareState {
  medications: Medication[]
  records: Record<string, DayRecord> // YYYY-MM-DD -> record
  wakeUpDeadline: string // HH:mm
  medGraceMinutes: number
  channels: AlertChannel[]
  alerts: AlertLog[]
  sentAlertKeys: string[] // 중복 발송 방지 키
  familyCode: string // 보호자가 /guardian 에서 입력하는 가족 코드
  remindedKeys: string[] // 어르신에게 이미 알려 드린 복약·기상 안내 (중복 방지)
  guardianLinkSent: boolean // 보호자에게 연결 링크를 보낸 적이 있는지 (처음 사용 안내용)
  guideDismissed: boolean // 처음 사용 안내를 닫았는지
  setupDone: boolean // 예시 정보(이름·약)를 내 것으로 바꾸는 첫 설정을 마쳤거나 넘겼는지

  checkWakeUp: () => void
  toggleMed: (medId: string) => void
  addMedication: (m: Omit<Medication, 'id' | 'createdAt'>) => void
  updateMedication: (id: string, patch: Omit<Medication, 'id' | 'createdAt'>) => void
  removeMedication: (id: string) => void
  setWakeUpDeadline: (t: string) => void
  toggleChannel: (c: AlertChannel) => void
  pushAlert: (key: string, alert: Omit<AlertLog, 'id' | 'at'>) => boolean
  clearAlerts: () => void
  markReminded: (key: string) => boolean
  setGuardianLinkSent: () => void
  dismissGuide: () => void
  /** 첫 설정: 예시 약을 지우고(선택) 설정을 마친 것으로 표시 */
  finishSetup: (clearSampleMeds: boolean) => void
  applyAcks: (acks: Pick<AlertLog, 'id' | 'ackAt' | 'ackBy'>[]) => void
  mergeServerAlerts: (list: AlertLog[]) => void
}

export const todayKey = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const sortByTime = (list: Medication[]) => [...list].sort((a, b) => a.time.localeCompare(b.time))

/** 알림 키로 종류를 정합니다. */
export function alertKind(key: string): AlertKind {
  if (key.startsWith('sos-')) return 'sos'
  if (key.endsWith('-wake')) return 'wake'
  return 'med'
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 헷갈리는 0·O·1·I 제외

/** 6자리 가족 코드를 만듭니다. 예: K7MP3Q */
export function makeFamilyCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
}

export const DEFAULT_MEDS: Medication[] = [
  { id: 'm-1', name: '혈압약 (아모디핀)', slot: '아침', time: '08:00', memo: '식후 30분' },
  { id: 'm-2', name: '관절 영양제', slot: '점심', time: '12:30', memo: '식후' },
  { id: 'm-3', name: '당뇨약 (메트포르민)', slot: '저녁', time: '18:30', memo: '식사 직후' },
  { id: 'm-4', name: '수면 보조제', slot: '취침 전', time: '21:30' },
]

export const useCareStore = create<CareState>()(
  persist(
    (set, get) => ({
      medications: DEFAULT_MEDS,
      records: {},
      wakeUpDeadline: '10:00',
      medGraceMinutes: 60,
      channels: ['webpush', 'kakao'],
      alerts: [],
      sentAlertKeys: [],
      familyCode: makeFamilyCode(),
      remindedKeys: [],
      guardianLinkSent: false,
      guideDismissed: false,
      setGuardianLinkSent: () => set({ guardianLinkSent: true }),
      dismissGuide: () => set({ guideDismissed: true }),
      setupDone: false,
      finishSetup: (clearSampleMeds) =>
        set((s) => ({
          setupDone: true,
          medications: clearSampleMeds
            ? s.medications.filter((m) => !DEFAULT_MEDS.some((d) => d.id === m.id))
            : s.medications,
          // 예시 이름·약으로 생긴 알림 기록도 함께 비웁니다.
          alerts: clearSampleMeds ? [] : s.alerts,
        })),

      checkWakeUp: () =>
        set((s) => {
          const k = todayKey()
          const rec = s.records[k] ?? { takenMeds: {} }
          return { records: { ...s.records, [k]: { ...rec, wakeUpAt: new Date().toISOString() } } }
        }),

      toggleMed: (medId) =>
        set((s) => {
          const k = todayKey()
          const rec = s.records[k] ?? { takenMeds: {} }
          const taken = { ...rec.takenMeds }
          if (taken[medId]) delete taken[medId]
          else taken[medId] = new Date().toISOString()
          return { records: { ...s.records, [k]: { ...rec, takenMeds: taken } } }
        }),

      addMedication: (m) =>
        set((s) => ({
          medications: sortByTime([
            ...s.medications,
            { ...m, id: `m-${Date.now()}`, createdAt: new Date().toISOString() },
          ]),
        })),

      // 시간을 바꾸면 '오늘 이미 지난 시간'으로 바뀌어도 잘못 알리지 않도록 등록 시각을 새로 기록합니다.
      updateMedication: (id, patch) =>
        set((s) => ({
          medications: sortByTime(
            s.medications.map((m) =>
              m.id !== id
                ? m
                : {
                    ...m,
                    ...patch,
                    createdAt: patch.time !== m.time ? new Date().toISOString() : m.createdAt,
                  },
            ),
          ),
        })),

      removeMedication: (id) => set((s) => ({ medications: s.medications.filter((m) => m.id !== id) })),

      setWakeUpDeadline: (t) => set({ wakeUpDeadline: t }),

      toggleChannel: (c) =>
        set((s) => ({
          channels: s.channels.includes(c) ? s.channels.filter((x) => x !== c) : [...s.channels, c],
        })),

      pushAlert: (key, alert) => {
        if (get().sentAlertKeys.includes(key)) return false
        set((s) => ({
          sentAlertKeys: [...s.sentAlertKeys, key].slice(-100),
          alerts: [
            { ...alert, key, kind: alertKind(key), id: `a-${Date.now()}`, at: new Date().toISOString() },
            ...s.alerts,
          ].slice(0, 50),
        }))
        return true
      },

      clearAlerts: () => set({ alerts: [] }),

      markReminded: (key) => {
        if (get().remindedKeys.includes(key)) return false
        set((s) => ({ remindedKeys: [...s.remindedKeys, key].slice(-100) }))
        return true
      },

      mergeServerAlerts: (list) =>
        set((s) => {
          const have = new Set(s.alerts.map((a) => a.id))
          const fresh = list.filter((a) => !have.has(a.id))
          if (!fresh.length) return {}
          const keys = fresh.map((a) => a.key).filter((k): k is string => !!k)
          return {
            alerts: [...fresh, ...s.alerts].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 50),
            sentAlertKeys: [...new Set([...s.sentAlertKeys, ...keys])].slice(-200),
          }
        }),

      // 서버에서 받은 보호자 확인(ackAt)을 내 알림 기록에 반영합니다.
      applyAcks: (acks) =>
        set((s) => {
          const byId = new Map(acks.filter((a) => a.ackAt).map((a) => [a.id, a]))
          let changed = false
          const alerts = s.alerts.map((a) => {
            const ack = byId.get(a.id)
            if (!ack || a.ackAt === ack.ackAt) return a
            changed = true
            return { ...a, ackAt: ack.ackAt, ackBy: ack.ackBy }
          })
          return changed ? { alerts } : {}
        }),
    }),
    {
      name: 'neulbom-care',
      version: 1,
      // v0 에는 가족 코드가 없었으므로 새로 만들어 저장합니다.
      migrate: (persisted, version) => {
        const state = persisted as Partial<CareState>
        if (version < 1 && !state.familyCode) state.familyCode = makeFamilyCode()
        if (!state.remindedKeys) state.remindedKeys = []
        return state as CareState
      },
    },
  ),
)

export const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
