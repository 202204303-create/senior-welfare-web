import { ChevronDown } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * 눌러서 펼치는 상자. 자주 안 보는 내용(지난 기록·설정)을 접어 두어 화면을 짧게 만듭니다.
 * 브라우저 기본 <details> 를 써서 키보드·화면 읽기 프로그램에서도 그대로 동작합니다.
 */
export function Fold({
  title,
  hint,
  icon,
  children,
  defaultOpen = false,
}: {
  title: string
  /** 제목 옆 짧은 요약 (예: '3개', '켜짐') */
  hint?: ReactNode
  icon?: ReactNode
  children: ReactNode
  defaultOpen?: boolean
}) {
  return (
    <details className="group glass rounded-3xl" open={defaultOpen}>
      <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 rounded-3xl px-5 py-3 [&::-webkit-details-marker]:hidden">
        {icon && (
          <span
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600 [&>svg]:size-5"
            aria-hidden
          >
            {icon}
          </span>
        )}
        <span className="min-w-0 flex-1 text-lg font-bold">{title}</span>
        {hint && <span className="shrink-0 text-base font-bold whitespace-nowrap text-ink-soft">{hint}</span>}
        <ChevronDown className="size-6 shrink-0 text-ink-soft transition group-open:rotate-180" aria-hidden />
      </summary>
      <div className="px-5 pb-5">{children}</div>
    </details>
  )
}
