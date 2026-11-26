// 실행: npm run test:web — 복지사 차트 계산 시험
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildTimeline, lastDays, medGrid, weekStats, type ChartAction, type ChartMed } from './chart.ts'

const meds: ChartMed[] = [
  { id: 'm-1', name: '혈압약', slot: '아침', time: '08:00' },
  { id: 'm-2', name: '영양제', slot: '점심', time: '12:30' },
]
const T = (d: string, hhmm: string) => `2026-11-${d}T${hhmm}:00+09:00`

test('타임라인은 알림·기상·복용·처리를 최근 순으로 합친다', () => {
  const tl = buildTimeline(
    meds,
    { '2026-11-26': { wakeUpAt: T('26', '07:30'), takenMeds: { 'm-1': T('26', '08:05') } } },
    [{ id: 'a1', kind: 'sos', at: T('26', '10:42'), reason: '긴급 도움 요청' }],
    [
      {
        id: 'x1',
        at: T('26', '10:50'),
        type: '이슈처리',
        result: 'call_ok',
        byName: '담당 사회복지사',
        note: '식사 잘 하심',
      },
    ],
  )
  assert.deepEqual(
    tl.map((e) => [e.tag, e.text]),
    [
      ['상담', '통화 · 이상 없음 · "식사 잘 하심"'],
      ['긴급', '긴급 도움 요청 · 아직 확인 안 함'],
      ['기록', '혈압약 복용'],
      ['기록', '기상 확인'],
    ],
  )
})

test('이슈마다 남은 같은 처리 기록은 한 줄로, 정정 기록은 무엇을 취소했는지 보여 준다', () => {
  const at = T('26', '10:50')
  const acts: ChartAction[] = [
    { id: 'x1', at, type: '이슈처리', result: 'visit_needed' },
    { id: 'x2', at, type: '이슈처리', result: 'visit_needed' },
    { id: 'f1', at: T('26', '10:51'), type: '정정', corrects: 'x1' },
  ]
  const tl = buildTimeline(meds, {}, [], acts)
  assert.equal(tl.length, 2)
  assert.equal(tl[0].tag, '정정')
  assert.match(tl[0].text, /방문 필요/)
  assert.equal(tl[1].text, '방문 필요')
})

test('다음 행동과 예정 시각을 처리 기록에 함께 보여 준다', () => {
  const tl = buildTimeline(
    meds,
    {},
    [],
    [
      {
        id: 'x1',
        at: T('26', '10:00'),
        type: '이슈처리',
        result: 'call_no_answer',
        nextAction: 'recall',
        followUpAt: T('26', '10:30'),
      },
    ],
  )
  assert.equal(tl[0].text, '통화 · 받지 않음 · 다음: 재통화 · 10:30 예정')
})

test('최근 7일 날짜와 이번 주 수치', () => {
  assert.deepEqual(lastDays('2026-11-26'), [
    '2026-11-20',
    '2026-11-21',
    '2026-11-22',
    '2026-11-23',
    '2026-11-24',
    '2026-11-25',
    '2026-11-26',
  ])
  const days = {
    '2026-11-25': { wakeUpAt: 'x', takenMeds: { 'm-1': 'x', 'm-2': 'x' } },
    '2026-11-26': { wakeUpAt: 'x', takenMeds: { 'm-1': 'x' } },
  }
  const s = weekStats(meds, days, '2026-11-26')
  assert.equal(s.wakeDays, 2)
  assert.equal(s.medRate, Math.round((3 / 14) * 100))
  // 오늘 등록한 약은 지난 날에 세지 않음
  const fresh = weekStats([{ ...meds[0], createdAt: '2026-11-26T09:00:00+09:00' }], {}, '2026-11-26')
  assert.equal(fresh.medRate, 0)
  assert.equal(weekStats([], {}, '2026-11-26').medRate, null)
})

test('복약 표: 드심 / 기록은 있는데 놓침 / 기록 없음(모름), 오늘은 놓침으로 단정하지 않음', () => {
  const g = medGrid(
    meds,
    {
      '2026-11-25': { takenMeds: { 'm-1': 'x' } },
      '2026-11-26': { takenMeds: {} },
    },
    '2026-11-26',
  )
  const m1 = g.rows[0].cells.slice(-3)
  const m2 = g.rows[1].cells.slice(-3)
  assert.deepEqual(m1, ['none', 'taken', 'none'])
  assert.deepEqual(m2, ['none', 'missed', 'none'])
})
