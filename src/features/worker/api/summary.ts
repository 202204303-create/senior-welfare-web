import { doc, onSnapshot } from 'firebase/firestore'
import type { Summary } from '@/features/worker/types'
import { ensureSignedIn, getDb } from '@/shared/api/firebase'

type Unsubscribe = () => void

/** 서버가 만든 요약 families/{code}/summary/current 를 실시간으로 읽습니다. (없으면 null) */
export function watchSummary(
  code: string,
  onData: (summary: Summary | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  let off: Unsubscribe | null = null
  let cancelled = false
  ensureSignedIn()
    .then(() => {
      const db = getDb()
      if (cancelled || !db) return
      off = onSnapshot(
        doc(db, 'families', code, 'summary', 'current'),
        (snap) => onData(snap.exists() ? (snap.data() as Summary) : null),
        onError,
      )
    })
    .catch(onError)
  return () => {
    cancelled = true
    off?.()
  }
}
