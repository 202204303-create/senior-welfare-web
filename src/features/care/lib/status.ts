import type { MedStatus } from '@/features/care/hooks/useCareWatcher'

/** 복약 상태별 글자 뱃지 (색만으로 구분하지 않도록 글자를 함께 씁니다) */
export const STATUS_STYLE: Record<MedStatus, { label: string; cls: string }> = {
  taken: { label: '복용 완료', cls: 'bg-emerald-100 text-emerald-700' },
  due: { label: '드실 시간', cls: 'bg-brand-600 text-white' },
  upcoming: { label: '예정', cls: 'bg-slate-100 text-slate-600' },
  missed: { label: '놓침', cls: 'bg-rose-100 text-rose-700' },
}
