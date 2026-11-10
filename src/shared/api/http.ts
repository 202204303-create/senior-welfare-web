/**
 * 공통 API 클라이언트.
 * - VITE_USE_MOCK 이 'false' 가 아니면 각 기능의 api 파일이 Mock 데이터를 사용합니다. (기본값: Mock)
 * - 백엔드가 준비되면 .env 에 VITE_USE_MOCK=false 와 VITE_API_BASE_URL 을 넣으면 됩니다.
 */
export const USE_MOCK = import.meta.env.VITE_USE_MOCK !== 'false'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

export class ApiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function toQuery(params?: Record<string, string | number | undefined>) {
  if (!params) return ''
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    throw new ApiError('인터넷 연결을 확인해 주세요.', 0)
  }
  if (!res.ok) {
    throw new ApiError(
      res.status >= 500 ? '서버에 문제가 생겼어요. 잠시 후 다시 시도해 주세요.' : '요청을 처리하지 못했어요.',
      res.status,
    )
  }
  return res.json() as Promise<T>
}

export const http = {
  get: <T>(path: string, params?: Record<string, string | number | undefined>) =>
    request<T>(`${path}${toQuery(params)}`),
  post: <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
}
