import { BellRing } from 'lucide-react'
import { useEffect, useState } from 'react'
import { requestPushPermission } from '@/features/care/hooks/useCareWatcher'
import { registerPushDevice } from '@/shared/api/push'
import { BigButton, StatusNote } from '@/shared/ui'

type Permission = NotificationPermission | 'unsupported'
const read = (): Permission => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

/**
 * 복지사 기기를 알림 받을 기기로 등록합니다. (긴급 요청, 보호자가 오래 확인하지 않은 알림)
 * 담당 어르신마다 기기를 등록해야 서버가 그 어르신의 알림을 이 기기로 보냅니다.
 */
export function WorkerPushSetup({ codes }: { codes: string[] }) {
  const [permission, setPermission] = useState<Permission>(read)
  const [result, setResult] = useState<'pending' | 'ok' | 'fail' | null>(null)
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

  const ask = async () => {
    const res = await requestPushPermission()
    setPermission(res)
    if (res === 'granted') setResult('pending')
  }

  if (permission === 'unsupported')
    return (
      <StatusNote tone="info">
        이 브라우저에서는 휴대폰 알림을 받을 수 없어요. 아이폰은 홈 화면에 추가한 뒤 열어 주세요.
      </StatusNote>
    )
  if (permission === 'denied')
    return (
      <StatusNote tone="warn">
        알림이 막혀 있어요. 브라우저 설정 → 사이트 설정 → 알림에서 늘봄을 허용해 주세요.
      </StatusNote>
    )
  if (permission === 'granted')
    return result === 'ok' ? (
      <StatusNote tone="success">
        긴급 요청과 보호자 미확인 알림을 이 기기로 받아요. 화면이 꺼져 있어도 도착해요.
      </StatusNote>
    ) : result === 'fail' ? (
      <StatusNote tone="warn">
        알림 기기 등록에 실패했어요. 인터넷 연결을 확인하고 화면을 다시 열어 주세요.
      </StatusNote>
    ) : null
  return (
    <BigButton variant="soft" fullWidth icon={<BellRing />} onClick={ask}>
      이 기기에서 긴급·미확인 알림 받기
    </BigButton>
  )
}
