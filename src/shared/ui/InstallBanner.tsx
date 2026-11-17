import { Download, Share, X } from 'lucide-react'
import { useInstallPrompt } from '@/shared/hooks/useInstallPrompt'

/** 홈 화면에 앱 설치를 안내하는 배너. 이미 설치했거나 닫은 경우, 설치할 수 없는 환경에서는 보이지 않습니다. */
export function InstallBanner() {
  const { canInstall, isIOS, install, dismiss } = useInstallPrompt()
  if (!canInstall) return null

  return (
    <section
      aria-label="앱 설치 안내"
      className="mb-4 flex items-start gap-3 rounded-2xl border border-brand-200 bg-white/80 p-4 shadow-glass"
    >
      <img src="/pwa-192x192.png" alt="" className="size-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="text-base font-bold text-ink">늘봄을 홈 화면에 추가하세요</p>
        {isIOS ? (
          <p className="mt-1 text-sm text-ink-soft">
            아래 <Share className="inline size-4 align-text-bottom" aria-hidden /> 공유 버튼을 누르고{' '}
            <b>홈 화면에 추가</b>를 선택해 주세요.
          </p>
        ) : (
          <>
            <p className="mt-1 text-sm text-ink-soft">앱처럼 바로 열고, 알림도 받을 수 있어요.</p>
            <button
              type="button"
              onClick={install}
              className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-xl bg-brand-600 px-5 text-base font-bold text-white"
            >
              <Download className="size-5" aria-hidden /> 앱 설치하기
            </button>
          </>
        )}
      </div>
      <button
        type="button"
        onClick={dismiss}
        aria-label="설치 안내 닫기"
        className="grid size-12 shrink-0 place-items-center rounded-xl text-ink-soft"
      >
        <X className="size-5" aria-hidden />
      </button>
    </section>
  )
}
