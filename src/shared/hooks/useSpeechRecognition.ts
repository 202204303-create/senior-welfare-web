import { useCallback, useEffect, useRef, useState } from 'react'

/* Web Speech API(STT) 최소 타입 정의 */
interface SpeechRecognitionResultLike {
  0: { transcript: string }
  isFinal: boolean
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: ArrayLike<SpeechRecognitionResultLike>
}
interface SpeechRecognitionLike {
  lang: string
  interimResults: boolean
  continuous: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((e: SpeechRecognitionEventLike) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': '마이크 사용이 허용되지 않았어요. 브라우저 설정에서 마이크를 허용해 주세요.',
  'no-speech': '말씀이 들리지 않았어요. 다시 한 번 말씀해 주세요.',
  network: '인터넷 연결을 확인해 주세요.',
  'audio-capture': '마이크를 찾을 수 없어요.',
}

export function useSpeechRecognition(onFinal: (text: string) => void) {
  const supported = getCtor() !== null
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognitionLike | null>(null)
  const onFinalRef = useRef(onFinal)

  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  useEffect(() => () => recRef.current?.abort(), [])

  const start = useCallback(() => {
    const Ctor = getCtor()
    if (!Ctor) {
      setError('이 브라우저는 음성 입력을 지원하지 않아요. 크롬 브라우저를 사용해 주세요.')
      return
    }
    setError(null)
    setInterim('')
    const rec = new Ctor()
    rec.lang = 'ko-KR'
    rec.interimResults = true
    rec.continuous = false
    rec.onresult = (e) => {
      let finalText = ''
      let interimText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else interimText += r[0].transcript
      }
      setInterim(interimText)
      if (finalText) onFinalRef.current(finalText.trim())
    }
    rec.onerror = (e) => {
      setError(ERROR_MESSAGES[e.error] ?? '음성 인식 중 문제가 생겼어요.')
      setListening(false)
    }
    rec.onend = () => {
      setListening(false)
      setInterim('')
    }
    recRef.current = rec
    rec.start()
    setListening(true)
  }, [])

  const stop = useCallback(() => {
    recRef.current?.stop()
    setListening(false)
  }, [])

  return { supported, listening, interim, error, start, stop }
}
