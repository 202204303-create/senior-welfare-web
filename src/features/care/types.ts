export type MedSlot = '아침' | '점심' | '저녁' | '취침 전'

export interface Medication {
  id: string
  name: string
  slot: MedSlot
  time: string // HH:mm
  memo?: string
  /** 약을 등록한 시각 (ISO). 오늘 복용 시각이 지난 뒤 등록한 약은 내일부터 챙깁니다. */
  createdAt?: string
}
