import {
  collection,
  doc,
  documentId,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore'
import { ensureSignedIn, getDb } from '@/shared/api/firebase'
import type { AlertLog, DayRecord } from '@/features/care/store/useCareStore'
import type { Medication } from '@/features/care/types'

/**
 * Firestore 구조 (가족 코드 하나 = 어르신 한 분)
 *
 * families/{code}               어르신 이름, 보호자 이름, 약 목록, 알림 기준, 마지막 활동 시각
 * families/{code}/days/{날짜}   그날의 기상 시각과 복용 기록
 * families/{code}/alerts/{id}   미확인·긴급 알림 기록 (+ 보호자 확인 시각 ackAt, 확인한 사람 ackBy)
 */

export interface FamilyInfo {
  elderName: string
  elderPhone: string
  guardianName: string
  medications: Medication[]
  wakeUpDeadline: string
  medGraceMinutes: number
  /** 어르신 앱이 마지막으로 열려 있던 시각 (ISO) */
  lastSeenAt?: string
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
  // merge: 보호자가 남긴 확인(ackAt)을 덮어쓰지 않도록 합칩니다.
  await setDoc(
    doc(familyRef(code), 'alerts', alert.id),
    { ...alert, createdAt: serverTimestamp() },
    { merge: true },
  )
}

/** 어르신 앱이 열려 있음을 알립니다. 보호자 화면의 '마지막 활동'에 쓰입니다. */
export async function saveHeartbeat(code: string) {
  await ensureSignedIn()
  await setDoc(familyRef(code), { lastSeenAt: new Date().toISOString() }, { merge: true })
}

// ---------- 보호자 화면 → 서버 ----------

/** 보호자가 알림을 확인했다고 남깁니다. 어르신 화면에 '확인했어요'가 표시됩니다. */
/**
 * 보호자의 확인. 복지사가 먼저 확인했으면(ackAt 있음) 그 기록은 그대로 두고 보호자 확인만 더합니다.
 * 아무도 확인하지 않았으면 첫 확인(ackAt, 복지사 연결 기준)도 함께 남깁니다.
 */
export async function ackAlertAsGuardian(code: string, alert: AlertLog, name: string) {
  await ensureSignedIn()
  const at = new Date().toISOString()
  await setDoc(
    doc(familyRef(code), 'alerts', alert.id),
    alert.ackAt
      ? { guardianAckAt: at, guardianAckBy: name }
      : { ackAt: at, ackBy: name, guardianAckAt: at, guardianAckBy: name },
    { merge: true },
  )
}

export async function ackAlert(code: string, alertId: string, ackBy: string) {
  await ensureSignedIn()
  await setDoc(
    doc(familyRef(code), 'alerts', alertId),
    { ackAt: new Date().toISOString(), ackBy },
    { merge: true },
  )
}

// ---------- 서버 → 화면 (실시간) ----------

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

/** sinceKey(YYYY-MM-DD) 이후 날짜별 기록을 { 날짜: 기록 } 으로 받습니다. */
export function watchDays(
  code: string,
  sinceKey: string,
  onData: (days: Record<string, DayRecord>) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return withSignIn(onError, () =>
    onSnapshot(
      query(collection(familyRef(code), 'days'), where(documentId(), '>=', sinceKey)),
      (snap) => {
        const days: Record<string, DayRecord> = {}
        snap.forEach((d) => {
          const v = d.data()
          days[d.id] = { wakeUpAt: v.wakeUpAt ?? undefined, takenMeds: v.takenMeds ?? {} }
        })
        onData(days)
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
