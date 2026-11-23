/** 브라우저 알림(권한이 있을 때)을 띄웁니다. 지원하지 않는 브라우저에서는 조용히 넘어갑니다. */
export function showSystemNotification(title: string, body: string) {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return
  try {
    new Notification(title, { body, icon: '/favicon.svg', tag: body })
  } catch {
    /* 일부 모바일 브라우저는 서비스워커 없이 알림 생성 불가 */
  }
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
