import { BellRing } from 'lucide-react'
import { useState } from 'react'
import { requestPushPermission } from '@/features/care/hooks/useCareWatcher'
import { BigButton, StatusNote } from '@/shared/ui'

type PermissionState = NotificationPermission | 'unsupported'

const readPermission = (): PermissionState =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission

/**
 * 이 기기에서 휴대폰 알림(PWA)을 받도록 허용하는 버튼과 현재 상태.
 * 결과를 잠깐 띄우지 않고 버튼 아래에 계속 보여 줍니다.
 */
export function PushPermission({
  label = '이 기기에서 휴대폰 알림 받기',
  onGranted,
}: {
  label?: string
  onGranted?: () => void
}) {
  const [state, setState] = useState<PermissionState>(readPermission)

  const ask = async () => {
    const res = await requestPushPermission()
    setState(res)
    if (res === 'granted') onGranted?.()
  }

  return (
    <div className="space-y-2">
      {state !== 'granted' && state !== 'unsupported' && (
        <BigButton variant="soft" fullWidth icon={<BellRing />} onClick={ask}>
          {label}
        </BigButton>
      )}
      {state === 'granted' && (
        <StatusNote tone="success">
          휴대폰 알림이 켜져 있어요. 늘봄이 열려 있으면 다른 앱을 쓰는 중에도 알림으로 알려 드려요.
        </StatusNote>
      )}
      {state === 'denied' && (
        <StatusNote tone="warn">
          알림이 막혀 있어요. 휴대폰의 브라우저 설정 → 사이트 설정 → 알림에서 늘봄을 허용해 주세요.
        </StatusNote>
      )}
      {state === 'unsupported' && (
        <StatusNote tone="info">
          이 브라우저에서는 휴대폰 알림을 받을 수 없어요. 아이폰은 홈 화면에 늘봄을 추가한 뒤 열어 주세요.
        </StatusNote>
      )}
    </div>
  )
}
