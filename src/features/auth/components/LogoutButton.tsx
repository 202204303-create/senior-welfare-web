import { LogOut } from 'lucide-react'
import { useAccountAuth } from '@/features/auth/hooks/useAccountAuth'
import { useUserStore } from '@/features/auth/store/useUserStore'
import { BigButton } from '@/shared/ui'

/** 보호자·복지사 계정으로 로그인했을 때만 보이는 로그아웃 버튼 (링크로 들어온 보호자에게는 보이지 않음) */
export function LogoutButton() {
  const { isLoggedIn, role } = useUserStore()
  const { signOut } = useAccountAuth()
  if (!isLoggedIn || (role !== 'guardian' && role !== 'worker')) return null
  return (
    <BigButton size="md" variant="ghost" icon={<LogOut />} onClick={signOut}>
      로그아웃
    </BigButton>
  )
}
