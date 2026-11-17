/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_KAKAO_MAP_KEY?: string
  readonly VITE_KAKAO_REST_KEY?: string
  readonly VITE_NAVER_CLIENT_ID?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
  readonly VITE_FIREBASE_EMULATOR_HOST?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
