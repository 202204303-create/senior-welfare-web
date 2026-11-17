import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { ensureSignedIn, getDb } from '@/shared/api/firebase'
import type { AlertLog, DayRecord } from '@/features/care/store/useCareStore'
import type { Medication } from '@/features/care/types'

/**
 * Firestore 구조 (가족 코드 하나 = 어르신 한 분)
 *
 * families/{code}               어르신 이름, 보호자 이름, 약 목록, 알림 기준
 * families/{code}/days/{날짜}   그날의 기상 시각과 복용 기록
 * families/{code}/alerts/{id}   미확인·긴급 알림 기록
 */

export interface FamilyInfo {
  elderName: string
  elderPhone: string
  guardianName: string
  medications: Medication[]
  wakeUpDeadline: string
  medGraceMinutes: number
}

const familyRef = (code: string) => doc(getDb()!, 'families', code)

// ---------- 어르신 기기 → 서버 ----------

export async function saveFamilyInfo(code: string, info: FamilyInfo) {
  await ensureSignedIn()
  await setDoc(familyRef(code), { ...info, updatedAt: serverTimestamp() }, { merge: true })
}

export async function saveDayRecord(code: string, dateKey: string, rec: DayRecord) {
  await ensureSignedIn()
  await setDoc(doc(familyRef(code), 'days', dateKey), {
    wakeUpAt: rec.wakeUpAt ?? null,
    takenMeds: rec.takenMeds,
    updatedAt: serverTimestamp(),
  })
}

export async function saveAlert(code: string, alert: AlertLog) {
  await ensureSignedIn()
  await setDoc(doc(familyRef(code), 'alerts', alert.id), { ...alert, createdAt: serverTimestamp() })
}

// ---------- 서버 → 보호자 화면 (실시간) ----------

type Unsubscribe = () => void

export function watchFamily(
  code: string,
  onData: (info: FamilyInfo | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return withSignIn(onError, () =>
    onSnapshot(
      familyRef(code),
      (snap) => onData(snap.exists() ? (snap.data() as FamilyInfo) : null),
      onError,
    ),
  )
}

export function watchDay(
  code: string,
  dateKey: string,
  onData: (rec: DayRecord) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return withSignIn(onError, () =>
    onSnapshot(
      doc(familyRef(code), 'days', dateKey),
      (snap) => {
        const d = snap.data()
        onData({ wakeUpAt: d?.wakeUpAt ?? undefined, takenMeds: d?.takenMeds ?? {} })
      },
      onError,
    ),
  )
}

export function watchAlerts(
  code: string,
  onData: (alerts: AlertLog[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return withSignIn(onError, () =>
    onSnapshot(
      query(collection(familyRef(code), 'alerts'), orderBy('at', 'desc'), limit(30)),
      (snap) => onData(snap.docs.map((d) => d.data() as AlertLog)),
      onError,
    ),
  )
}

/** 익명 로그인이 끝난 뒤 구독을 시작하고, 화면을 떠나면 구독을 끊습니다. */
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
