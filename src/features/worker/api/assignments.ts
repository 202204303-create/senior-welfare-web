import { collection, onSnapshot } from 'firebase/firestore'
import { ensureSignedIn, getDb } from '@/shared/api/firebase'

/**
 * workers/{복지사 uid}/assignments/{가족 코드}: 이 복지사가 담당하는 어르신.
 * 서버(관리자)가 만들고(`scripts/seed-accounts.mjs`), 복지사 본인만 읽습니다.
 */
export interface Assignment {
  code: string
  displayName: string
  dong: string
  tags: string[]
  pinnedToday: boolean
}

type Unsubscribe = () => void

export function watchAssignments(
  onData: (list: Assignment[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  let off: Unsubscribe | null = null
  let cancelled = false
  ensureSignedIn()
    .then((user) => {
      const db = getDb()
      if (cancelled || !db) return
      off = onSnapshot(
        collection(db, 'workers', user.uid, 'assignments'),
        (snap) =>
          onData(
            snap.docs
              .map((d) => {
                const v = d.data()
                return {
                  code: d.id,
                  displayName: typeof v.displayName === 'string' && v.displayName ? v.displayName : d.id,
                  dong: typeof v.dong === 'string' ? v.dong : '',
                  tags: Array.isArray(v.tags) ? v.tags.filter((t): t is string => typeof t === 'string') : [],
                  pinnedToday: v.pinnedToday === true,
                }
              })
              .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ko')),
          ),
        onError,
      )
    })
    .catch(onError)
  return () => {
    cancelled = true
    off?.()
  }
}
