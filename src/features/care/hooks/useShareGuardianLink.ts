import { useState } from 'react'
import { useUserStore } from '@/features/auth/store/useUserStore'
import { useCareStore } from '@/features/care/store/useCareStore'

export type ShareResult = { tone: 'success' | 'info'; text: string } | null

/**
 * 보호자 연결 링크(/guardian?code=…)를 보냅니다.
 * 휴대폰 공유 창(카카오톡 등)이 있으면 그걸 쓰고, 없으면 링크를 복사합니다.
 * 보호자는 링크만 누르면 코드 입력 없이 연결됩니다.
 */
export function useShareGuardianLink() {
  const code = useCareStore((s) => s.familyCode)
  const setSent = useCareStore((s) => s.setGuardianLinkSent)
  const elderName = useUserStore((s) => s.profile.name)
  const [result, setResult] = useState<ShareResult>(null)
  const link = `${window.location.origin}/guardian?code=${code}`

  const share = async () => {
    const text = `${elderName} 님의 늘봄 안부 확인 링크예요. 누르면 오늘 기상·복약 상태를 바로 볼 수 있어요.`
    if (navigator.share) {
      try {
        await navigator.share({ title: '늘봄 보호자 연결', text, url: link })
        setSent()
        setResult({ tone: 'success', text: '보호자 연결 링크를 보냈어요.' })
        return
      } catch (e) {
        if ((e as Error).name === 'AbortError') return // 공유 창을 닫음
      }
    }
    try {
      await navigator.clipboard.writeText(`${text}\n${link}`)
      setSent()
      setResult({ tone: 'success', text: '링크를 복사했어요. 카카오톡이나 문자에 붙여 넣어 보내 주세요.' })
    } catch {
      setResult({ tone: 'info', text: `이 주소를 보호자께 보내 주세요: ${link}` })
    }
  }

  return { share, result, clearResult: () => setResult(null), link }
}
