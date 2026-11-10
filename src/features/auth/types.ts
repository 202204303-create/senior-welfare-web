import type { IncomeLevel, Region } from '@/shared/types'

export interface UserProfile {
  name: string
  birthYear: number
  phone: string
  address: string
  region: Region
  income: IncomeLevel
  career: string
  guardianName: string
  guardianPhone: string
  livingAlone: boolean
}
