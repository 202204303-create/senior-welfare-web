import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Medication } from '@/features/care/types'

export type AlertChannel = 'webpush' | 'kakao' | 'sms'

export interface AlertLog {
  id: string
  at: string
  reason: string
  channels: AlertChannel[]
  recipients: string[]
}

interface DayRecord {
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

  checkWakeUp: () => void
  toggleMed: (medId: string) => void
  addMedication: (m: Omit<Medication, 'id'>) => void
  removeMedication: (id: string) => void
  setWakeUpDeadline: (t: string) => void
  toggleChannel: (c: AlertChannel) => void
  pushAlert: (key: string, alert: Omit<AlertLog, 'id' | 'at'>) => boolean
  clearAlerts: () => void
}

export const todayKey = (d = new Date()) => {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const DEFAULT_MEDS: Medication[] = [
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
          medications: [...s.medications, { ...m, id: `m-${Date.now()}` }].sort((a, b) =>
            a.time.localeCompare(b.time),
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
          alerts: [{ ...alert, id: `a-${Date.now()}`, at: new Date().toISOString() }, ...s.alerts].slice(
            0,
            50,
          ),
        }))
        return true
      },

      clearAlerts: () => set({ alerts: [] }),
    }),
    { name: 'neulbom-care' },
  ),
)

export const timeToMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}
