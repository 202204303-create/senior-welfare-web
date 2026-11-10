import { Compass } from 'lucide-react'
import { BigLink, EmptyState } from '@/shared/ui'

export function NotFoundPage() {
  return (
    <div className="mx-auto max-w-md py-10">
      <EmptyState
        icon={<Compass />}
        title="페이지를 찾을 수 없어요"
        desc="주소가 바뀌었거나 없는 페이지예요."
        action={<BigLink to="/">홈으로 가기</BigLink>}
      />
    </div>
  )
}
