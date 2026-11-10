import type { FacilityType } from '@/features/map/types'

export const FACILITY_META: Record<FacilityType, { color: string; bg: string; emoji: string }> = {
  복지관: { color: '#0b7fd2', bg: 'bg-brand-100 text-brand-700', emoji: '🏛️' },
  보건소: { color: '#e11d48', bg: 'bg-rose-100 text-rose-700', emoji: '🏥' },
  경로당: { color: '#059669', bg: 'bg-emerald-100 text-emerald-700', emoji: '🏡' },
  치매안심센터: { color: '#7c3aed', bg: 'bg-violet-100 text-violet-700', emoji: '🧠' },
  일자리센터: { color: '#d97706', bg: 'bg-amber-100 text-amber-700', emoji: '💼' },
}

export function markerHtml(type: FacilityType, name: string, active: boolean) {
  const { color, emoji } = FACILITY_META[type]
  return `
  <div style="display:flex;flex-direction:column;align-items:center;transform:translateY(-50%);cursor:pointer;">
    <div style="display:flex;align-items:center;gap:6px;padding:${active ? '8px 14px' : '6px 12px'};border-radius:999px;background:${active ? color : '#fff'};color:${active ? '#fff' : color};border:2.5px solid ${color};font:700 ${active ? '16px' : '14px'}/1.2 'Pretendard Variable',sans-serif;box-shadow:0 6px 18px -6px rgba(11,127,210,.55);white-space:nowrap;">
      <span style="font-size:${active ? '18px' : '16px'}">${emoji}</span>${name}
    </div>
    <div style="width:0;height:0;border-left:8px solid transparent;border-right:8px solid transparent;border-top:10px solid ${color};margin-top:-1px"></div>
  </div>`
}
