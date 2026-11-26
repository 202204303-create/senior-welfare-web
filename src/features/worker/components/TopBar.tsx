import { LogOut, Search } from 'lucide-react'
import type { RefObject } from 'react'
import { useAccountAuth } from '@/features/auth/hooks/useAccountAuth'
import { WorkerPushSetup } from '@/features/worker/components/WorkerPushSetup'
import { GRADE_LABEL, GRADES, type QueueView } from '@/features/worker/lib/queue'
import type { Grade } from '@/features/worker/types'
import { kbd } from '@/features/worker/ui/styles'

const CHIP: Record<Grade, string> = {
  P1: 'bg-rose-700 text-white',
  P2: 'bg-orange-700 text-white',
  P3: 'bg-amber-600 text-white',
  P4: 'bg-yellow-600 text-white',
  P5: 'bg-sky-700 text-white',
}

/** 상단 바: 검색(/), 오늘 관리 요약(등급 버튼을 누르면 그 등급만), 진행률, 알림 받기, 로그아웃 */
export function TopBar({
  view,
  filter,
  onFilter,
  search,
  onSearch,
  searchRef,
  codes,
}: {
  view: QueueView
  filter: Grade | null
  onFilter: (g: Grade | null) => void
  search: string
  onSearch: (s: string) => void
  searchRef: RefObject<HTMLInputElement | null>
  codes: string[]
}) {
  const { signOut } = useAccountAuth()
  const pct = view.managed ? Math.round((view.done / view.managed) * 100) : 0
  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-slate-800 px-3 py-2 text-[13px] text-slate-200">
      <b className="text-[14px] text-white">늘봄 업무</b>
      <label className="flex items-center gap-1.5 rounded bg-slate-700 px-2 py-1">
        <Search className="size-3.5 text-slate-400" aria-hidden />
        <span className="sr-only">이름·동·태그 검색</span>
        <input
          ref={searchRef}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="이름·동·태그 검색"
          className="w-40 bg-transparent text-[13px] text-white outline-none placeholder:text-slate-400"
        />
        <span className={`${kbd} border-slate-500 bg-transparent text-slate-300`}>/</span>
      </label>
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="등급별로 보기">
        <button
          type="button"
          aria-pressed={filter === null}
          onClick={() => onFilter(null)}
          className={`rounded px-2 py-0.5 ${filter === null ? 'bg-white text-slate-900' : 'bg-slate-700'}`}
        >
          오늘 관리 {view.managed}명
        </button>
        {GRADES.filter((g) => view.counts[g] > 0).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={filter === g}
            onClick={() => onFilter(filter === g ? null : g)}
            className={`rounded px-2 py-0.5 ${CHIP[g]} ${filter === g ? 'outline-2 outline-offset-1 outline-white' : ''}`}
          >
            {GRADE_LABEL[g]} {view.counts[g]}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-2">
        <span>
          처리 {view.done}/{view.managed}
        </span>
        <div
          role="progressbar"
          aria-label="오늘 처리 진행률"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          className="h-1.5 w-24 overflow-hidden rounded bg-slate-600"
        >
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
        <WorkerPushSetup codes={codes} />
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-1 rounded px-2 py-0.5 hover:bg-slate-700"
        >
          <LogOut className="size-3.5" aria-hidden /> 로그아웃
        </button>
      </div>
    </header>
  )
}
