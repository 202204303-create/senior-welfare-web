export type MedSlot = '아침' | '점심' | '저녁' | '취침 전'

export interface Medication {
  id: string
  name: string
  slot: MedSlot
  time: string // HH:mm
  memo?: string
}
