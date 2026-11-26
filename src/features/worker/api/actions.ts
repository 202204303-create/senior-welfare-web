import { collection, deleteField, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { ackAlert } from '@/features/care/api/family'
import { isFirebaseAuth } from '@/features/auth/lib/authMode'
import type { ActionResult, OpenIssue } from '@/features/worker/types'
import { ensureSignedIn, getDb, getIdToken } from '@/shared/api/firebase'

/** 어르신 화면에 "OO 님이 확인했어요"로 보이는 이름 */
export const WORKER_NAME = '담당 사회복지사'

export interface ActionInput {
  code: string
  issues: OpenIssue[]
  result: ActionResult
  note?: string
  /** 재시도 예정 시각 (ISO) — 받지 않음일 때 */
  followUpAt?: string
  templateId?: string
}

export interface SavedAction {
  code: string
  at: string
  actionIds: string[]
  /** 이 처리 때문에 우리가 확인 표시한 알림 (되돌릴 때 확인 표시를 지움) */
  ackedAlertIds: string[]
}

/**
 * 처리 결과를 남깁니다. 이슈마다 기록 한 건씩 한 번에 저장하고(추가만 가능, 수정·삭제 불가),
 * 통화 · 이상 없음이면 관련 알림에 "확인했어요"를 남겨 보호자·어르신 화면에도 반영합니다.
 */
export async function saveActions(input: ActionInput): Promise<SavedAction> {
  const user = await ensureSignedIn()
  const db = getDb()
  if (!db) throw new Error('Firebase 설정이 없습니다.')
  const at = new Date().toISOString()
  const batch = writeBatch(db)
  const actionIds: string[] = []
  for (const issue of input.issues) {
    const ref = doc(collection(db, 'families', input.code, 'actions'))
    actionIds.push(ref.id)
    batch.set(ref, {
      at,
      createdAt: serverTimestamp(),
      by: user.uid,
      byName: WORKER_NAME,
      type: '이슈처리',
      result: input.result,
      issueType: issue.type,
      ...(issue.alertId ? { alertId: issue.alertId } : {}),
      ...(input.note ? { note: input.note } : {}),
      ...(input.followUpAt ? { followUpAt: input.followUpAt } : {}),
      ...(input.templateId ? { templateId: input.templateId } : {}),
    })
  }
  await batch.commit()

  const ackedAlertIds: string[] = []
  if (input.result === 'call_ok') {
    for (const issue of input.issues) {
      if (!issue.alertId) continue
      try {
        await ackAlert(input.code, issue.alertId, WORKER_NAME)
        ackedAlertIds.push(issue.alertId)
      } catch {
        /* 확인 표시가 안 되어도 처리 기록은 이미 저장됨 */
      }
    }
  }
  void refreshSummaryNow(input.code)
  return { code: input.code, at, actionIds, ackedAlertIds }
}

/**
 * 방금 한 처리를 되돌립니다. 처리 기록은 지울 수 없으므로 "정정" 기록을 새로 추가하고,
 * 우리가 남긴 확인 표시는 지웁니다.
 */
export async function undoActions(saved: SavedAction): Promise<void> {
  const user = await ensureSignedIn()
  const db = getDb()
  if (!db) throw new Error('Firebase 설정이 없습니다.')
  const batch = writeBatch(db)
  const at = new Date().toISOString()
  for (const id of saved.actionIds) {
    batch.set(doc(collection(db, 'families', saved.code, 'actions')), {
      at,
      createdAt: serverTimestamp(),
      by: user.uid,
      byName: WORKER_NAME,
      type: '정정',
      corrects: id,
    })
  }
  for (const alertId of saved.ackedAlertIds) {
    const ref = doc(db, 'families', saved.code, 'alerts', alertId)
    const snap = await getDoc(ref)
    // 그 사이 보호자가 직접 확인했다면 그대로 둡니다.
    if (snap.exists() && snap.get('ackBy') === WORKER_NAME) {
      batch.update(ref, { ackAt: deleteField(), ackBy: deleteField() })
    }
  }
  await batch.commit()
  void refreshSummaryNow(saved.code)
}

/**
 * 서버에 요약을 바로 새로 만들어 달라고 요청합니다. (계정 로그인 모드에서만, 로그인 토큰으로 확인)
 * 실패해도 10분마다 도는 서버 확인이 따라잡으므로 화면 동작에는 영향이 없습니다.
 */
export async function refreshSummaryNow(code: string) {
  if (!isFirebaseAuth) return
  try {
    const token = await getIdToken()
    if (!token) return
    await fetch('/api/refresh-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    })
  } catch {
    /* 무시 */
  }
}
