import type { IncomeLevel, Region } from '@/shared/types'

export type PolicyCategory = '생활지원' | '의료·건강' | '주거' | '일자리' | '돌봄' | '교통·문화'

export interface Policy {
  id: string
  title: string
  summary: string
  category: PolicyCategory
  agency: string
  regions: Region[]
  minAge: number
  incomes: IncomeLevel[] // 비어있으면 소득 무관
  benefit: string
  howToApply: string
  link: string
}
