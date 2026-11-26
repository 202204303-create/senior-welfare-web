import { useEffect, useMemo, useState } from 'react'
import { watchSummary } from '@/features/worker/api/summary'
import type { Assignment } from '@/features/worker/api/assignments'
import type { QueueRow, Summary } from '@/features/worker/types'

/** 담당 어르신마다 서버가 만든 요약(summary)만 구독해서 큐 재료(QueueRow)를 만듭니다. */
export function useWorkerQueue(assignments: Assignment[]) {
  const [summaries, setSummaries] = useState<Record<string, Summary | null>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const codesKey = assignments.map((a) => a.code).join(',')

  useEffect(() => {
    const offs = codesKey
      .split(',')
      .filter(Boolean)
      .map((code) =>
        watchSummary(
          code,
          (s) => setSummaries((prev) => ({ ...prev, [code]: s })),
          (e) => setErrors((prev) => ({ ...prev, [code]: e.message })),
        ),
      )
    return () => offs.forEach((off) => off())
  }, [codesKey])

  const rows: QueueRow[] = useMemo(
    () =>
      assignments.map((a) => ({
        code: a.code,
        displayName: a.displayName,
        dong: a.dong,
        tags: a.tags,
        pinnedToday: a.pinnedToday,
        summary: summaries[a.code] ?? null,
      })),
    [assignments, summaries],
  )

  const loading = assignments.some((a) => !(a.code in summaries) && !errors[a.code])
  const errorList = Object.values(errors)
  return { rows, loading, error: errorList.length ? errorList[0] : null }
}
