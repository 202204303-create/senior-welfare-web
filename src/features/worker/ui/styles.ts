/**
 * 복지사 업무 화면 전용 스타일. 어르신·보호자 화면의 큰 부품(BigButton 등)과 글자 크기 설정을 쓰지 않고,
 * 글자 13~15px, 표 한 줄 36~40px 의 촘촘한 업무용 화면으로 만듭니다. (px 로 고정해 어르신 글자 크기 설정의 영향을 받지 않음)
 */
import type { Grade } from '@/features/worker/types'

export const GRADE_TAG: Record<Grade, string> = {
  P1: 'bg-rose-50 text-rose-800 border-rose-300',
  P2: 'bg-orange-50 text-orange-800 border-orange-300',
  P3: 'bg-amber-50 text-amber-800 border-amber-300',
  P4: 'bg-yellow-50 text-yellow-800 border-yellow-300',
  P5: 'bg-sky-50 text-sky-800 border-sky-300',
}
export const OK_TAG = 'bg-emerald-50 text-emerald-800 border-emerald-300'

export const tag =
  'inline-block rounded-[3px] border px-1.5 py-px text-[11px] font-bold leading-4 whitespace-nowrap'
export const btn =
  'inline-flex items-center justify-between gap-2 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] text-slate-800 hover:bg-slate-50 disabled:opacity-50'
export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded border border-blue-700 bg-blue-700 px-2.5 py-1.5 text-[13px] font-bold text-white hover:bg-blue-800 disabled:opacity-50'
export const kbd =
  'rounded-[3px] border border-slate-400 bg-slate-50 px-1 font-mono text-[11px] text-slate-600'
export const paneHead =
  'flex items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2 text-[13px] font-bold'
export const th =
  'sticky top-0 border-b border-slate-300 bg-slate-100 px-2 py-1.5 text-left text-[12px] font-semibold text-slate-600'
export const td = 'border-b border-slate-100 px-2 py-2 align-middle'

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

export const fmtDateTime = (iso: string, todayKey: string) => {
  const day = new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' })
  if (day === todayKey) return fmtTime(iso)
  const d = new Date(iso).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  })
  return `${d} ${fmtTime(iso)}`
}
