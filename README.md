# 늘봄 · 시니어 맞춤형 통합 복지 웹 플랫폼 (Frontend)

React + Vite + TypeScript + Tailwind CSS v4 + Zustand + React Query 기반 반응형(Mobile-first) 웹입니다.
팀 작업 규칙은 [CONTRIBUTING.md](CONTRIBUTING.md)를 참고하세요.

## 실행

```bash
npm install
npm run dev        # 개발 서버 http://localhost:5173
npm run build      # 타입 검사 + 프로덕션 빌드 (dist/)
npm run preview    # 빌드 결과 미리보기
npm run format     # Prettier 로 코드 포맷
npm run lint       # oxlint
```

`.env.example`을 `.env`로 복사해 키를 넣으면 실제 카카오맵과 소셜 로그인이 동작합니다.
키가 없으면 자체 간이 지도와 데모 로그인으로 동작합니다.

## 화면 구성

| 경로 | 화면 | 폴더 | 기획서 기능 |
| --- | --- | --- | --- |
| `/login` | 간편 로그인 | `features/auth` | 카카오·네이버 소셜 로그인 |
| `/` | 메인 대시보드 | `features/dashboard` | 기상 확인, 오늘의 약, 추천 공고, 긴급 도움 |
| `/my` | 내 정보 | `features/dashboard` | 프로필·보호자 정보, 글자 크기 |
| `/care` | 안부·복약 관리 | `features/care` | 복약 체크, 미확인 시 보호자·복지사 알림 |
| `/jobs` | 일자리·프로그램 | `features/jobs` | 음성 검색, 필터 칩, 신청 내역 |
| `/jobs/:id/apply` | 원클릭 지원서 | `features/jobs` | 프로필 기반 자동 완성 |
| `/map` | 복지 시설 지도 | `features/map` | Geolocation, 반경 필터, 커스텀 마커 |
| `/policies` | 맞춤 복지 혜택 | `features/policies` | 거주지·연령·소득 필터링 |

## 백엔드 연동

- `.env`에 `VITE_USE_MOCK=false`와 `VITE_API_BASE_URL`을 넣으면 각 기능의 `api/*.ts`가 실제 API를 호출합니다.
- 기대하는 엔드포인트: `GET /jobs`, `GET /jobs/:id`, `POST /applications`, `GET /facilities`, `GET /policies`
- 카카오톡·SMS 알림 발송은 백엔드에서 처리해야 합니다. 현재는 `features/care/hooks/useCareWatcher.ts`가 발송 요청을 기록하고 웹 푸시만 직접 띄웁니다.
- 소셜 로그인 콜백 `/auth/{provider}/callback`의 토큰 교환은 백엔드에서 처리합니다.

## 배포

`vercel.json`에 SPA 라우팅 설정이 포함되어 있어 Vercel에 그대로 배포할 수 있습니다.
