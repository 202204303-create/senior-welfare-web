import { BellRing } from 'lucide-react'
import { useEffect, useState } from 'react'
import { requestPushPermission } from '@/features/care/hooks/useCareWatcher'
import { BigButton, StatusNote } from '@/shared/ui'
import { registerPushDevice, type PushRegisterResult, type PushRole } from '@/shared/api/push'

type PermissionState = NotificationPermission | 'unsupported'

const readPermission = (): PermissionState =>
  typeof Notification === 'undefined' ? 'unsupported' : Notification.permission

/**
 * 이 기기에서 휴대폰 알림을 받도록 허용하는 버튼과 현재 상태.
 * 허용하면 이 기기를 서버에 '알림 받을 기기'로 등록해, 화면이 꺼져 있어도 알림이 옵니다.
 * 결과를 잠깐 띄우지 않고 버튼 아래에 계속 보여 줍니다.
 */
export function PushPermission({
  label = '이 기기에서 휴대폰 알림 받기',
  role,
  familyCode,
  onGranted,
}: {
  label?: string
  /** guardian: 보호자 기기, elder: 어르신 기기 */
  role: PushRole
  familyCode: string
  onGranted?: () => void
}) {
  const [state, setState] = useState<PermissionState>(readPermission)
  const [device, setDevice] = useState<PushRegisterResult | 'pending' | null>(null)

  // 이미 허용된 기기는 열 때마다 조용히 다시 등록합니다. (토큰이 바뀌는 경우 대비)
  useEffect(() => {
    if (state !== 'granted' || !familyCode) return
    let alive = true
    registerPushDevice(familyCode, role).then((r) => alive && setDevice(r))
    return () => {
      alive = false
    }
  }, [state, familyCode, role])

  const ask = async () => {
    const res = await requestPushPermission()
    setState(res)
    if (res === 'granted') {
      setDevice('pending')
      onGranted?.()
    }
  }

  return (
    <div className="space-y-2">
      {state !== 'granted' && state !== 'unsupported' && (
        <BigButton variant="soft" fullWidth icon={<BellRing />} onClick={ask}>
          {label}
        </BigButton>
      )}
      {state === 'granted' && device === 'registered' && (
        <StatusNote tone="success">
          휴대폰 알림이 켜져 있어요. 늘봄을 닫아 두거나 화면이 꺼져 있어도 알림이 와요.
        </StatusNote>
      )}
      {state === 'granted' && device !== 'registered' && (
        <StatusNote tone={device === 'error' ? 'warn' : 'success'}>
          휴대폰 알림이 켜져 있어요. 늘봄이 열려 있으면 다른 앱을 쓰는 중에도 알림으로 알려 드려요.
          {device === 'unsupported' &&
            ' (이 브라우저는 앱이 닫혀 있을 때의 알림을 지원하지 않아요. 아이폰은 홈 화면에 늘봄을 추가해 주세요.)'}
          {device === 'error' &&
            ' (앱이 닫혀 있을 때의 알림 등록에 실패했어요. 인터넷 연결을 확인하고 다시 열어 주세요.)'}
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
