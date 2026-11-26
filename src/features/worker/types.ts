/**
 * 복지사 화면에서 쓰는 타입. 서버가 만드는 요약(`api/_lib/summary.ts`)과 같은 모양입니다.
 * 서버 코드는 화면 코드를 가져다 쓰지 않으므로 두 곳을 같이 고쳐야 합니다.
 */
export type Grade = 'P1' | 'P2' | 'P3' | 'P4' | 'P5'
export type IssueType = 'sos' | 'guardian-unacked' | 'wake-missed' | 'med-repeat' | 'no-contact'
/** checked: 전화 없이 '확인했어요' (보호자가 이미 연락했거나 상황을 알고 있을 때). call_ok 처럼 이슈를 닫음 */
export type ActionResult =
  'call_ok' | 'checked' | 'call_no_answer' | 'visit_needed' | 'guardian_notified' | 'other'

export interface LastAction {
  result: ActionResult
  at: string
  byName: string
  followUpAt?: string
}

export interface OpenIssue {
  type: IssueType
  grade: Grade
  since: string
  text: string
  alertId?: string
  lastAction?: LastAction
}

export interface Summary {
  dateKey: string
  elderName: string
  elderPhone: string | null
  guardianName: string | null
  lastActionAt: string | null
  handledToday: boolean
  todayWakeAt: string | null
  todayMedDone: number
  todayMedTotal: number
  openIssues: OpenIssue[]
  openCount: number
  highestGrade: Grade | null
  lastContactAt: string | null
  status: '정상' | '관찰' | '위험'
  updatedAt: string
}

/** 담당 배정 한 건 (workers/{uid}/assignments/{code}) 과 그 가족의 요약 */
export interface QueueRow {
  code: string
  displayName: string
  /** 동네(동). 담당 배정에 적혀 있으면 표시 */
  dong: string
  tags: string[]
  pinnedToday: boolean
  /** 아직 요약이 없으면 null (서버가 처음 만들기 전) */
  summary: Summary | null
}

/** 방금 남긴 처리를 서버 요약이 따라잡기 전까지 화면에 먼저 반영하기 위한 기록 */
export interface Overlay {
  at: string
  result: ActionResult
  byName: string
  followUpAt?: string
  /** 이 처리로 닫힌 이슈 (call_ok·checked 일 때) */
  closed: { type: IssueType; alertId?: string }[]
}
