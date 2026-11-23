import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type NoticeTone = 'info' | 'success' | 'warn' | 'danger'

export interface Notice {
  id: string
  /** 같은 알림이 두 번 쌓이지 않게 하는 키 (선택) */
  key?: string
  message: string
  tone: NoticeTone
  at: string // ISO
}

interface NoticeState {
  notices: Notice[]
  addNotice: (n: { message: string; tone?: NoticeTone; key?: string }) => void
  dismissNotice: (id: string) => void
  dismissAll: () => void
}

const MAX_NOTICES = 20

export type NoticeStore = ReturnType<typeof createNoticeStore>

function createNoticeStore(storageName: string) {
  return create<NoticeState>()(
    persist(
      (set) => ({
        notices: [],
        addNotice: ({ message, tone = 'info', key }) =>
          set((s) => {
            if (key && s.notices.some((n) => n.key === key)) return {}
            const notice: Notice = {
              id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              key,
              message,
              tone,
              at: new Date().toISOString(),
            }
            return { notices: [notice, ...s.notices].slice(0, MAX_NOTICES) }
          }),
        dismissNotice: (id) => set((s) => ({ notices: s.notices.filter((n) => n.id !== id) })),
        dismissAll: () => set({ notices: [] }),
      }),
      { name: storageName },
    ),
  )
}

/**
 * 지워지지 않는 화면 알림.
 * 몇 초 뒤 사라지는 토스트 대신, 사용자가 '확인했어요'를 누를 때까지 남습니다.
 * 브라우저에 저장되어 새로고침하거나 앱을 다시 열어도 그대로 보입니다.
 * 같은 휴대폰에서 두 화면을 열 수도 있어 어르신 화면과 보호자 화면은 따로 저장합니다.
 */
export const useNoticeStore = createNoticeStore('neulbom-notices')
export const useGuardianNoticeStore = createNoticeStore('neulbom-guardian-notices')

/** 컴포넌트 밖(훅·함수)에서 어르신 화면 알림을 남길 때 씁니다. */
export const addNotice = (n: { message: string; tone?: NoticeTone; key?: string }) =>
  useNoticeStore.getState().addNotice(n)
