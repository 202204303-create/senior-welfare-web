/**
 * 복지사 차트(어르신별 화면)에 쓰는 순수 함수: 타임라인, 이번 주 수치, 복약 표.
 * 화면·Firebase 없이 시험할 수 있도록 상대 경로 import 만 씁니다.
 */
import type { ActionResult } from '../types'
import { RESULT_LABEL } from './queue'

export interface ChartMed {
  id: string
  name: string
  slot: string
  time: string
  createdAt?: string
}
export interface ChartDay {
  wakeUpAt?: string
  takenMeds: Record<string, string>
}
export interface ChartAlert {
  id: string
  kind?: 'sos' | 'wake' | 'med'
  at: string
  reason: string
  ackAt?: string
  ackBy?: string
}
export type NextAction = 'none' | 'recall' | 'visit' | 'guardian'
export interface ChartAction {
  id: string
  at: string
  byName?: string
  type?: '이슈처리' | '상담' | '정정'
  result?: ActionResult
  note?: string
  corrects?: string
  nextAction?: NextAction
  followUpAt?: string
}

export const NEXT_ACTION_LABEL: Record<NextAction, string> = {
  none: '없음',
  recall: '재통화',
  visit: '방문',
  guardian: '보호자 협의',
}

export type TimelineKind = 'alert' | 'record' | 'action'
export interface TimelineEntry {
  key: string
  at: string
  kind: TimelineKind
  /** 표시용 짧은 꼬리표: 긴급, 알림, 기록, 상담, 정정 */
  tag: '긴급' | '알림' | '기록' | '상담' | '정정'
  text: string
  by: string
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

/** 알림·기상·복용·처리 기록을 시간순(최근 먼저)으로 합칩니다. 같은 처리 기록 여러 건(이슈마다 한 건)은 하나로 묶습니다. */
export function buildTimeline(
  meds: ChartMed[],
  days: Record<string, ChartDay>,
  alerts: ChartAlert[],
  actions: ChartAction[],
): TimelineEntry[] {
  const out: TimelineEntry[] = []
  const medName = new Map(meds.map((m) => [m.id, m.name]))

  for (const a of alerts) {
    const acked = a.ackAt ? ` · ${a.ackBy ?? '확인'} ${fmtTime(a.ackAt)} 확인` : ' · 아직 확인 안 함'
    out.push({
      key: `alert-${a.id}`,
      at: a.at,
      kind: 'alert',
      tag: a.kind === 'sos' ? '긴급' : '알림',
      text: `${a.reason.replace(/[.。]\s*$/, '')}${acked}`,
      by: '어르신 앱·서버',
    })
  }

  for (const [date, d] of Object.entries(days)) {
    if (d.wakeUpAt)
      out.push({
        key: `wake-${date}`,
        at: d.wakeUpAt,
        kind: 'record',
        tag: '기록',
        text: '기상 확인',
        by: '어르신 앱',
      })
    for (const [id, at] of Object.entries(d.takenMeds ?? {})) {
      out.push({
        key: `med-${date}-${id}`,
        at,
        kind: 'record',
        tag: '기록',
        text: `${medName.get(id) ?? '약'} 복용`,
        by: '어르신 앱',
      })
    }
  }

  // 같은 시각·같은 결과로 이슈마다 남은 처리 기록은 한 줄로
  const byId = new Map(actions.map((a) => [a.id, a]))
  const groups = new Map<string, ChartAction[]>()
  for (const a of actions) {
    const g = `${a.at}|${a.type}|${a.result ?? ''}|${a.note ?? ''}`
    groups.set(g, [...(groups.get(g) ?? []), a])
  }
  for (const [g, list] of groups) {
    const a = list[0]
    if (a.type === '정정') {
      const target = a.corrects ? byId.get(a.corrects) : undefined
      out.push({
        key: `act-${g}`,
        at: a.at,
        kind: 'action',
        tag: '정정',
        text: target?.result
          ? `${fmtTime(target.at)} 기록 취소: "${RESULT_LABEL[target.result]}"`
          : '이전 기록 취소',
        by: a.byName ?? '복지사',
      })
      continue
    }
    const parts = [a.result ? RESULT_LABEL[a.result] : '상담']
    if (a.note) parts.push(`"${a.note}"`)
    if (a.nextAction && a.nextAction !== 'none') parts.push(`다음: ${NEXT_ACTION_LABEL[a.nextAction]}`)
    if (a.followUpAt) parts.push(`${fmtTime(a.followUpAt)} 예정`)
    out.push({
      key: `act-${g}`,
      at: a.at,
      kind: 'action',
      tag: '상담',
      text: parts.join(' · '),
      by: a.byName ?? '복지사',
    })
  }

  return out.sort((x, y) => y.at.localeCompare(x.at))
}

/** 최근 7일(오늘 포함) 날짜 키, 오래된 날부터 */
export function lastDays(todayKey: string, n = 7): string[] {
  const [y, m, d] = todayKey.split('-').map(Number)
  const base = Date.UTC(y, m - 1, d)
  return Array.from({ length: n }, (_, i) =>
    new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  )
}

/** 이번 주(최근 7일) 기상한 날 수와 복약 준수율. 약을 등록하기 전 날은 세지 않습니다. */
export function weekStats(meds: ChartMed[], days: Record<string, ChartDay>, todayKey: string) {
  const keys = lastDays(todayKey)
  const wakeDays = keys.filter((k) => days[k]?.wakeUpAt).length
  let expected = 0
  let taken = 0
  for (const k of keys) {
    for (const m of meds) {
      if (m.createdAt && m.createdAt.slice(0, 10) > k) continue
      expected++
      if (days[k]?.takenMeds?.[m.id]) taken++
    }
  }
  return { wakeDays, totalDays: keys.length, medRate: expected ? Math.round((taken / expected) * 100) : null }
}

export type MedCell = 'taken' | 'missed' | 'none'
/** 약 × 최근 7일 복용 표. 기록이 없는 날은 'none'(모름), 기록은 있는데 안 드신 약은 'missed' */
export function medGrid(meds: ChartMed[], days: Record<string, ChartDay>, todayKey: string) {
  const keys = lastDays(todayKey)
  return {
    days: keys,
    rows: meds.map((m) => ({
      med: m,
      cells: keys.map((k): MedCell => {
        const d = days[k]
        if (!d) return 'none'
        if (d.takenMeds?.[m.id]) return 'taken'
        return k === todayKey ? 'none' : 'missed'
      }),
    })),
  }
}
