import type { Region } from '@/shared/types'

export type JobCategory =
  '공익활동' | '사회서비스' | '시장형' | '취업알선' | '문화·여가' | '건강·운동' | '교육'

export interface JobPosting {
  id: string
  kind: 'job' | 'program'
  title: string
  org: string
  category: JobCategory
  region: Region
  pay: string
  schedule: string
  deadline: string // YYYY-MM-DD
  minAge: number
  description: string
}

export interface Application {
  id: string
  postingId: string
  postingTitle: string
  appliedAt: string
  status: '접수 완료' | '검토 중' | '합격' | '불합격'
}
