/**
 * 휴대폰·브라우저 알림을 띄웁니다. (알림 권한이 있을 때만)
 *
 * 안드로이드 크롬과 홈 화면에 설치한 앱(PWA)은 `new Notification()`을 지원하지 않으므로
 * 서비스 워커(registration.showNotification)로 띄우고, 서비스 워커가 없을 때만 기본 방식을 씁니다.
 */
/** 급한 정도: urgent(긴급, 강한 진동) · warn(확인 필요, 보통 진동) — 서버 휴대폰 알림(push-sw.js)과 같게 맞춤 */
export type NotifyLevel = 'urgent' | 'warn'
const VIBRATE: Record<NotifyLevel, number[]> = { urgent: [500, 150, 500, 150, 900], warn: [250, 120, 250] }

export function showSystemNotification(title: string, body: string, level: NotifyLevel = 'warn') {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  // requireInteraction: 사용자가 직접 닫을 때까지 알림이 화면에 남습니다. (지원하는 기기에서)
  const options: NotificationOptions = {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    tag: body,
    requireInteraction: true,
    // 진동은 안드로이드에서 동작합니다. (TS 기본 타입에 없어 확장)
    ...({ vibrate: VIBRATE[level] } as object),
  }

  const fallback = () => {
    try {
      new Notification(title, options)
    } catch {
      /* 이 브라우저에서는 알림을 띄울 수 없음 (화면 안내·음성으로 대신함) */
    }
  }

  if (!('serviceWorker' in navigator)) return fallback()
  navigator.serviceWorker
    .getRegistration()
    .then((reg) => (reg ? reg.showNotification(title, options) : fallback()))
    .catch(fallback)
}

/** 글을 한국어 음성으로 읽어 줍니다. (어르신 안내용) */
export function speak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'ko-KR'
    u.rate = 0.9 // 조금 천천히
    window.speechSynthesis.speak(u)
  } catch {
    /* 음성 합성을 막은 환경 */
  }
}
