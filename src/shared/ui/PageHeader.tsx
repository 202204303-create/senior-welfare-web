import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'

interface PageHeaderProps {
  title: string
  desc?: ReactNode
  back?: boolean
  action?: ReactNode
}

export function PageHeader({ title, desc, back, action }: PageHeaderProps) {
  const navigate = useNavigate()
  return (
    <div className="mb-5 flex items-start gap-3">
      {back && (
        <button
          onClick={() => navigate(-1)}
          className="glass -ml-1 grid size-12 shrink-0 place-items-center rounded-2xl text-brand-700"
          aria-label="뒤로 가기"
        >
          <ChevronLeft className="size-7" />
        </button>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-tight text-ink">{title}</h1>
        {desc && <p className="mt-1 text-base text-ink-soft">{desc}</p>}
      </div>
      {action}
    </div>
  )
}
