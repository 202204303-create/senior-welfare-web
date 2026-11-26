import { useEffect, useMemo, useState } from 'react'
import { watchAlerts, watchDays, watchFamily, type FamilyInfo } from '@/features/care/api/family'
import type { AlertLog, DayRecord } from '@/features/care/store/useCareStore'
import { todayKey } from '@/features/care/store/useCareStore'
import { watchActions, watchNotes, type Note } from '@/features/worker/api/chart'
import { isSampleCode, sampleChart } from '@/features/worker/lib/sampleElders'
import type { ChartAction } from '@/features/worker/lib/chart'

export interface ElderChart {
  family: FamilyInfo | null | undefined
  days: Record<string, DayRecord>
  alerts: AlertLog[]
  actions: ChartAction[]
  notes: Note[]
  error: string | null
}

const EMPTY: ElderChart = { family: undefined, days: {}, alerts: [], actions: [], notes: [], error: null }

/** 고른 어르신 한 명의 차트 데이터. 고를 때만 읽습니다. (명단·큐는 요약만 읽음) */
export function useElderChart(code: string | null): ElderChart {
  const [chart, setChart] = useState<{ code: string | null; data: ElderChart }>({ code: null, data: EMPTY })

  useEffect(() => {
    if (!code) return
    if (isSampleCode(code)) return // 예시 어르신은 서버를 읽지 않음 (아래에서 예시 기록을 씀)
    const since = todayKey(new Date(Date.now() - 6 * 86_400_000))
    const put = (patch: Partial<ElderChart>) =>
      setChart((prev) => ({ code, data: { ...(prev.code === code ? prev.data : EMPTY), ...patch } }))
    const onError = (e: Error) => put({ error: e.message })
    const offs = [
      watchFamily(code, (family) => put({ family }), onError),
      watchDays(code, since, (days) => put({ days }), onError),
      watchAlerts(code, (alerts) => put({ alerts }), onError),
      watchActions(code, (actions) => put({ actions }), onError),
      watchNotes(code, (notes) => put({ notes }), onError),
    ]
    return () => offs.forEach((off) => off())
  }, [code])

  const sample = useMemo(
    () => (code && isSampleCode(code) ? { ...EMPTY, ...sampleChart(code) } : null),
    [code],
  )
  if (sample) return sample
  return chart.code === code ? chart.data : EMPTY
}
