import { Mic, MicOff, Search, X } from 'lucide-react'
import { useId } from 'react'
import { useSpeechRecognition } from '@/shared/hooks/useSpeechRecognition'

interface VoiceInputBoxProps {
  value: string
  onChange: (v: string) => void
  onSubmit?: (v: string) => void
  placeholder?: string
  label?: string
  multiline?: boolean
}

/** 타이핑이 어려운 어르신을 위한 음성 입력(STT) 지원 입력창 */
export function VoiceInputBox({
  value,
  onChange,
  onSubmit,
  placeholder = '말씀하시거나 입력해 주세요',
  label,
  multiline,
}: VoiceInputBoxProps) {
  const id = useId()
  const { supported, listening, interim, error, start, stop } = useSpeechRecognition((text) => {
    const next = multiline && value ? `${value} ${text}` : text
    onChange(next)
    if (!multiline) onSubmit?.(next)
  })

  const fieldClass =
    'w-full bg-transparent text-lg text-ink placeholder:text-ink-soft/60 outline-none focus-visible:outline-none'

  return (
    <div>
      {label && (
        <label htmlFor={id} className="mb-2 block text-base font-bold text-ink">
          {label}
        </label>
      )}
      <div
        className={`flex items-center gap-2 rounded-2xl bg-white/85 p-2 pl-4 ring-2 transition focus-within:ring-brand-400 ${
          listening ? 'ring-brand-400' : 'ring-brand-100'
        } ${multiline ? 'items-start' : ''}`}
      >
        {!multiline && <Search className="size-6 shrink-0 text-brand-400" aria-hidden />}
        {multiline ? (
          <textarea
            id={id}
            rows={4}
            value={listening && interim ? `${value} ${interim}` : value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            className={`${fieldClass} resize-none py-2`}
          />
        ) : (
          <input
            id={id}
            type="search"
            value={listening && interim ? interim : value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onSubmit?.(value)}
            placeholder={placeholder}
            className={`${fieldClass} min-h-12`}
            enterKeyHint="search"
          />
        )}
        {value && !listening && (
          <button
            type="button"
            onClick={() => onChange('')}
            className="grid size-11 shrink-0 place-items-center rounded-xl text-ink-soft hover:bg-brand-50"
            aria-label="입력 내용 지우기"
          >
            <X className="size-5" />
          </button>
        )}
        <button
          type="button"
          onClick={listening ? stop : start}
          disabled={!supported}
          className={`grid size-14 shrink-0 place-items-center rounded-2xl text-white transition ${
            listening
              ? 'animate-pulse-ring bg-rose-500'
              : 'bg-linear-to-br from-brand-400 to-brand-600 hover:from-brand-500 hover:to-brand-700'
          } disabled:cursor-not-allowed disabled:opacity-40`}
          aria-label={listening ? '음성 입력 멈추기' : '음성으로 입력하기'}
          aria-pressed={listening}
        >
          {listening ? <MicOff className="size-7" /> : <Mic className="size-7" />}
        </button>
      </div>
      <p className="mt-2 min-h-6 text-sm text-ink-soft" aria-live="polite">
        {listening ? (
          '듣고 있어요… 천천히 말씀해 주세요.'
        ) : error ? (
          <span className="text-rose-600">{error}</span>
        ) : supported ? (
          '마이크 버튼을 누르고 말씀하시면 글자로 바뀌어요.'
        ) : (
          '이 브라우저에서는 음성 입력을 쓸 수 없어요.'
        )}
      </p>
    </div>
  )
}
