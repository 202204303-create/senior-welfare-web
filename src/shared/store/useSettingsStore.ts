import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type FontScale = 'normal' | 'large' | 'xlarge'

export const FONT_SCALE_PX: Record<FontScale, number> = {
  normal: 18,
  large: 20,
  xlarge: 22,
}

interface SettingsState {
  fontScale: FontScale
  setFontScale: (f: FontScale) => void
  voiceGuide: boolean // 복약·기상 안내를 소리로 읽어 줄지
  setVoiceGuide: (on: boolean) => void
  toast: { id: number; message: string; tone: 'info' | 'success' | 'warn' } | null
  showToast: (message: string, tone?: 'info' | 'success' | 'warn') => void
  hideToast: () => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      fontScale: 'normal',
      setFontScale: (fontScale) => set({ fontScale }),
      voiceGuide: true,
      setVoiceGuide: (voiceGuide) => set({ voiceGuide }),
      toast: null,
      showToast: (message, tone = 'info') => set({ toast: { id: Date.now(), message, tone } }),
      hideToast: () => set({ toast: null }),
    }),
    { name: 'neulbom-settings', partialize: (s) => ({ fontScale: s.fontScale, voiceGuide: s.voiceGuide }) },
  ),
)
