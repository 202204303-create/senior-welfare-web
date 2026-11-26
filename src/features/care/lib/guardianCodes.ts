import { GUARDIAN_CODE_KEY } from '@/features/auth/lib/demoAccounts'

/**
 * 보호자 한 명이 돌보는 어르신 목록(가족 코드, 최대 4명)과 지금 보고 있는 어르신.
 * - 목록: neulbom-guardian-codes  (["K7MP3Q", ...])
 * - 지금 보는 어르신: neulbom-guardian-code (예전부터 쓰던 키, 보호자 계정 로그인도 여기에 저장)
 */
export const MAX_ELDERS = 4
export const CODES_KEY = 'neulbom-guardian-codes'

const isCode = (c: unknown): c is string => typeof c === 'string' && /^[A-Z0-9]{6}$/.test(c)

export function readCodes(): string[] {
  try {
    const list = JSON.parse(localStorage.getItem(CODES_KEY) ?? '[]')
    return Array.isArray(list) ? [...new Set(list.filter(isCode))].slice(0, MAX_ELDERS) : []
  } catch {
    return []
  }
}

export function saveCodes(codes: string[]) {
  try {
    localStorage.setItem(CODES_KEY, JSON.stringify(codes.slice(0, MAX_ELDERS)))
  } catch {
    /* 저장이 막힌 브라우저에서는 이번에만 유지 */
  }
}

export function readSelected(): string {
  try {
    return (localStorage.getItem(GUARDIAN_CODE_KEY) ?? '').toUpperCase()
  } catch {
    return ''
  }
}

export function saveSelected(code: string) {
  try {
    if (code) localStorage.setItem(GUARDIAN_CODE_KEY, code)
    else localStorage.removeItem(GUARDIAN_CODE_KEY)
  } catch {
    /* 무시 */
  }
}

/** 로그아웃할 때 보호자 기기에 남은 어르신 목록을 지웁니다. */
export function clearGuardianCodes() {
  try {
    localStorage.removeItem(CODES_KEY)
    localStorage.removeItem(GUARDIAN_CODE_KEY)
  } catch {
    /* 무시 */
  }
}

/**
 * 처음 화면을 열 때의 목록과 선택: 링크(?code=)로 들어오면 그 어르신을 목록에 넣고 선택합니다.
 * 예전 방식(코드 하나만 저장)으로 쓰던 기기도 그대로 이어집니다.
 * 목록이 이미 4명이면 새 어르신은 넣지 않고 full 을 알려 줍니다.
 */
export function initialCodes(fromLink: string): { codes: string[]; selected: string; full: boolean } {
  let codes = readCodes()
  const saved = readSelected()
  if (isCode(saved) && !codes.includes(saved) && codes.length < MAX_ELDERS) codes = [...codes, saved]
  let selected = isCode(saved) && codes.includes(saved) ? saved : (codes[0] ?? '')
  let full = false
  const link = fromLink.toUpperCase()
  if (isCode(link)) {
    if (codes.includes(link)) selected = link
    else if (codes.length < MAX_ELDERS) {
      codes = [...codes, link]
      selected = link
    } else full = true
  }
  saveCodes(codes)
  saveSelected(selected)
  return { codes, selected, full }
}
