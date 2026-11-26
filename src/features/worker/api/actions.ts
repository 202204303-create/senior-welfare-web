import { collection, deleteField, doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore'
import { ackAlert } from '@/features/care/api/family'
import { isFirebaseAuth } from '@/features/auth/lib/authMode'
import type { NextAction } from '@/features/worker/lib/chart'
import type { ActionResult, OpenIssue } from '@/features/worker/types'
import { isSampleCode } from '@/features/worker/lib/sampleElders'
import { ensureSignedIn, getDb, getIdToken } from '@/shared/api/firebase'

/** 어르신 화면에 "OO 님이 확인했어요"로 보이는 이름 */
export const WORKER_NAME = '담당 사회복지사'

export interface ActionInput {
  code: string
  issues: OpenIssue[]
  result: ActionResult
  note?: string
  /** 다음 일정 (ISO): 재통화·방문 예정 시각 */
  followUpAt?: string
  /** 다음 행동 */
  nextAction?: NextAction
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
  // 예시 어르신(시연용)은 서버에 저장하지 않고, 이 화면에서만 처리된 것으로 보여 줍니다.
  if (isSampleCode(input.code))
    return { code: input.code, at: new Date().toISOString(), actionIds: [], ackedAlertIds: [] }
  const user = await ensureSignedIn()
  const db = getDb()
  if (!db) throw new Error('Firebase 설정이 없습니다.')
  const at = new Date().toISOString()
  const batch = writeBatch(db)
  const actionIds: string[] = []
  // 이슈가 없으면(정상 어르신 정기 통화 등) 상담 기록 한 건만 남깁니다.
  const targets: (OpenIssue | null)[] = input.issues.length ? input.issues : [null]
  for (const issue of targets) {
    const ref = doc(collection(db, 'families', input.code, 'actions'))
    actionIds.push(ref.id)
    batch.set(ref, {
      at,
      createdAt: serverTimestamp(),
      by: user.uid,
      byName: WORKER_NAME,
      type: issue ? '이슈처리' : '상담',
      result: input.result,
      ...(issue ? { issueType: issue.type } : {}),
      ...(issue?.alertId ? { alertId: issue.alertId } : {}),
      ...(input.note ? { note: input.note } : {}),
      ...(input.followUpAt ? { followUpAt: input.followUpAt } : {}),
      ...(input.nextAction && input.nextAction !== 'none' ? { nextAction: input.nextAction } : {}),
      ...(input.templateId ? { templateId: input.templateId } : {}),
    })
  }
  await batch.commit()

  const ackedAlertIds: string[] = []
  if (input.result === 'call_ok' || input.result === 'checked') {
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
  if (isSampleCode(saved.code)) return
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
      const gAt = snap.get('guardianAckAt')
      // 보호자가 먼저 확인해 둔 알림이면 보호자 확인으로 되돌리고, 아니면 확인 표시를 지웁니다.
      batch.update(
        ref,
        gAt
          ? { ackAt: gAt, ackBy: snap.get('guardianAckBy') ?? '보호자' }
          : { ackAt: deleteField(), ackBy: deleteField() },
      )
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
  if (isSampleCode(code)) return
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
