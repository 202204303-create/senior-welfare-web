/* 늘봄 휴대폰 알림 (서버 → Firebase 클라우드 메시징 → 이 서비스 워커)
 * vite-plugin-pwa 가 만드는 sw.js 에 importScripts 로 들어갑니다. (vite.config.ts)
 * 앱이 닫혀 있거나 화면이 꺼져 있어도 알림을 띄웁니다.
 */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    const json = event.data ? event.data.json() : {}
    data = json.data || json
  } catch {
    data = { body: event.data ? event.data.text() : '' }
  }

  event.waitUntil(
    (async () => {
      // 늘봄 화면을 보고 있는 중이면 화면이 직접 알려 주므로 중복으로 띄우지 않습니다.
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      if (windows.some((w) => w.visibilityState === 'visible')) return

      // 급한 정도에 따라 진동을 다르게 합니다. (안드로이드에서 동작, 아이폰은 기기 설정을 따름)
      // urgent: 긴급 요청(SOS) — 길고 강한 진동, 같은 tag 라도 다시 울림
      // warn:   기상·복약 미확인 — 보통 진동
      const urgent = data.level === 'urgent'
      await self.registration.showNotification(data.title || '늘봄', {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        tag: data.tag || undefined,
        renotify: Boolean(data.tag) && urgent,
        vibrate: urgent ? [500, 150, 500, 150, 900] : [250, 120, 250],
        requireInteraction: true, // 직접 닫을 때까지 남김
        data: { url: data.url || '/' },
      })
    })(),
  )
})

// 알림을 누르면 늘봄을 열고 해당 화면(보호자 화면 등)으로 이동합니다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const w of windows) {
        if ('focus' in w) {
          try {
            await w.navigate(url)
          } catch {
            /* 다른 주소면 이동하지 못할 수 있음 */
          }
          return w.focus()
        }
      }
      return self.clients.openWindow(url)
    })(),
  )
})
