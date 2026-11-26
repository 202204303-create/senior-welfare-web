import { useEffect, useState } from 'react'
import { isFirebaseAuth } from '@/features/auth/lib/authMode'
import { DEMO_FAMILY_CODE, WORKER_FAMILY_CODES } from '@/features/auth/lib/demoAccounts'
import { watchAssignments, type Assignment } from '@/features/worker/api/assignments'

const DEMO_ASSIGNMENTS: Assignment[] = WORKER_FAMILY_CODES.map((code) => ({
  code,
  displayName: code === DEMO_FAMILY_CODE ? '김영수' : code,
  dong: '',
  tags: [],
  pinnedToday: false,
}))

export interface AssignmentsState {
  assignments: Assignment[]
  loading: boolean
  error: string | null
}

/**
 * 로그인한 복지사의 담당 어르신 목록.
 * - 시연용 계정 모드: 코드에 고정된 어르신(`WORKER_FAMILY_CODES`)
 * - 계정 로그인 모드: Firestore `workers/{uid}/assignments`
 */
export function useAssignments(): AssignmentsState {
  const [state, setState] = useState<AssignmentsState>(
    isFirebaseAuth
      ? { assignments: [], loading: true, error: null }
      : { assignments: DEMO_ASSIGNMENTS, loading: false, error: null },
  )

  useEffect(() => {
    if (!isFirebaseAuth) return
    return watchAssignments(
      (assignments) => setState({ assignments, loading: false, error: null }),
      (e) => setState({ assignments: [], loading: false, error: e.message }),
    )
  }, [])

  return state
}
