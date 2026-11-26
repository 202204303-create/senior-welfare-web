import { Bell, BellOff, BellRing } from 'lucide-react'
import { useEffect, useState } from 'react'
import { requestPushPermission } from '@/features/care/hooks/useCareWatcher'
import { registerPushDevice } from '@/shared/api/push'

type Permission = NotificationPermission | 'unsupported'
const read = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/**
 * 복지사 기기를 알림 받을 기기로 등록합니다. (긴급 요청, 보호자가 오래 확인하지 않은 알림)
 * 담당 어르신마다 등록해야 서버가 그 어르신의 알림을 이 기기로 보냅니다. 상단 바에 작게 표시합니다.
 */
export function WorkerPushSetup({ codes }: { codes: string[] }) {
  const [permission, setPermission] = useState<Permission>(read)
  const [result, setResult] = useState<'ok' | 'fail' | null>(null)
  const codesKey = codes.join(',')

  useEffect(() => {
    if (permission !== 'granted' || !codesKey) return
    let alive = true
    Promise.all(codesKey.split(',').map((c) => registerPushDevice(c, 'worker'))).then((rs) => {
      if (alive) setResult(rs.every((r) => r === 'registered') ? 'ok' : 'fail')
    })
    return () => {
      alive = false
    }
  }, [permission, codesKey])

  if (permission === 'unsupported' || permission === 'denied') {
    return (
      <span
        className="flex items-center gap-1 text-amber-300"
        title={
          permission === 'denied'
            ? '브라우저 설정 → 사이트 설정 → 알림에서 늘봄을 허용해 주세요.'
            : '이 브라우저는 알림을 받을 수 없어요.'
        }
      >
        <BellOff className="size-3.5" aria-hidden /> 알림 꺼짐
      </span>
    )
  }
  if (permission === 'granted') {
    return result === 'fail' ? (
      <span
        className="flex items-center gap-1 text-amber-300"
        title="인터넷 연결을 확인하고 화면을 다시 열어 주세요."
      >
        <BellOff className="size-3.5" aria-hidden /> 알림 등록 실패
      </span>
    ) : (
      <span
        className="flex items-center gap-1 text-emerald-300"
        title="긴급 요청과 보호자 미확인 알림을 이 기기로 받아요."
      >
        <BellRing className="size-3.5" aria-hidden /> 알림 받는 중
      </span>
    )
  }
  return (
    <button
      type="button"
      onClick={async () => setPermission(await requestPushPermission())}
      className="flex items-center gap-1 rounded bg-slate-700 px-2 py-0.5 hover:bg-slate-600"
    >
      <Bell className="size-3.5" aria-hidden /> 긴급 알림 받기
    </button>
  )
}
