import { addDoc, collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import type { ChartAction } from '@/features/worker/lib/chart'
import { isSampleCode } from '@/features/worker/lib/sampleElders'
import { ensureSignedIn, getDb } from '@/shared/api/firebase'

type Unsubscribe = () => void

/** 로그인이 끝난 뒤 구독을 시작하고, 화면을 떠나면 끊습니다. */
function withSignIn(onError: (e: Error) => void, start: () => Unsubscribe): Unsubscribe {
  let off: Unsubscribe | null = null
  let cancelled = false
  ensureSignedIn()
    .then(() => {
      if (!cancelled) off = start()
    })
    .catch(onError)
  return () => {
    cancelled = true
    off?.()
  }
}

/** 복지사 처리·상담 기록 (최근 50건, 최근 먼저) */
export function watchActions(
  code: string,
  onData: (list: ChartAction[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return withSignIn(onError, () =>
    onSnapshot(
      query(collection(getDb()!, 'families', code, 'actions'), orderBy('at', 'desc'), limit(50)),
      (snap) => onData(snap.docs.map((d) => ({ ...(d.data() as ChartAction), id: d.id }))),
      onError,
    ),
  )
}

export type NoteCategory = '의료' | '생활' | '연락'
export interface Note {
  id: string
  text: string
  pinned: boolean
  category: NoteCategory
  createdAt: string
  createdBy: string
}

/** 특이사항(고정 메모): families/{code}/notes */
export function watchNotes(
  code: string,
  onData: (list: Note[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return withSignIn(onError, () =>
    onSnapshot(
      collection(getDb()!, 'families', code, 'notes'),
      (snap) =>
        onData(
          snap.docs
            .map((d) => ({ ...(d.data() as Omit<Note, 'id'>), id: d.id }))
            .sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt)),
        ),
      onError,
    ),
  )
}

export async function addNote(code: string, note: { text: string; pinned: boolean; category: NoteCategory }) {
  if (isSampleCode(code)) throw new Error('예시 어르신은 특이사항이 저장되지 않아요')
  const user = await ensureSignedIn()
  await addDoc(collection(getDb()!, 'families', code, 'notes'), {
    ...note,
    createdAt: new Date().toISOString(),
    createdBy: user.uid,
  })
}
