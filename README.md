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
| `/care` | 안부·복약 관리 | `features/care` | 복약 체크, 미확인 시 보호자·복지사 알림, 보호자 연결 코드 |
| `/guardian` | 보호자 화면 | `features/care` | 가족 코드로 어르신의 오늘 기상·복약·알림을 실시간 확인 (로그인 불필요) |
| `/jobs` | 일자리·프로그램 | `features/jobs` | 음성 검색, 필터 칩, 신청 내역 |
| `/jobs/:id/apply` | 원클릭 지원서 | `features/jobs` | 프로필 기반 자동 완성 |
| `/map` | 복지 시설 지도 | `features/map` | Geolocation, 반경 필터, 커스텀 마커 |
| `/policies` | 맞춤 복지 혜택 | `features/policies` | 거주지·연령·소득 필터링 |

## 서버 저장과 보호자 화면 (Firebase)

안부·복약 기록은 Firebase(Firestore)에 저장되어 보호자가 다른 기기에서 실시간으로 확인합니다.

1. [Firebase 콘솔](https://console.firebase.google.com)에서 프로젝트를 만들고 **웹 앱**을 추가합니다.
2. **Firestore Database**를 만들고, **Authentication > 익명** 로그인을 켭니다.
3. Firestore **규칙** 탭에 저장소의 `firestore.rules` 내용을 붙여 넣고 게시합니다.
4. 팀 프로젝트(`neulbom-c7096`) 설정값은 `src/shared/api/firebase.ts`에 들어 있어 `.env` 없이 바로 동작합니다. 다른 프로젝트를 쓸 때만 `.env`의 `VITE_FIREBASE_*`에 값을 넣습니다.

사용 방법: 어르신 기기의 `안부·복약` 화면에 6자리 **보호자 연결 코드**가 나옵니다. 보호자는 `/guardian`에서 이 코드를 입력합니다.
`.env`에 `VITE_FIREBASE_DISABLED=true`를 넣으면 서버 없이 이 기기(브라우저)에만 저장하고, 보호자 화면은 "서버 연결이 설정되지 않았어요"를 보여 줍니다.

데이터 구조: `families/{코드}`(이름·약 목록·알림 기준), `families/{코드}/days/{날짜}`(기상·복용 기록), `families/{코드}/alerts/{id}`(알림 기록)

한계: 미확인 알림 판단은 어르신 기기에서 앱이 열려 있을 때 이루어집니다. 보호자 화면이 꺼져 있을 때도 휴대폰으로 알림을 보내려면 FCM(Firebase Cloud Messaging)과 서버 함수가 추가로 필요합니다.

## 백엔드 연동

- `.env`에 `VITE_USE_MOCK=false`와 `VITE_API_BASE_URL`을 넣으면 각 기능의 `api/*.ts`가 실제 API를 호출합니다.
- 기대하는 엔드포인트: `GET /jobs`, `GET /jobs/:id`, `POST /applications`, `GET /facilities`, `GET /policies`
- 카카오톡·SMS 알림 발송은 백엔드에서 처리해야 합니다. 현재는 `features/care/hooks/useCareWatcher.ts`가 발송 요청을 기록하고 웹 푸시만 직접 띄웁니다.
- 소셜 로그인 콜백 `/auth/{provider}/callback`의 토큰 교환은 백엔드에서 처리합니다.

## PWA (홈 화면 설치)

- `vite-plugin-pwa`가 빌드 때 매니페스트와 서비스 워커(`sw.js`)를 만듭니다. 설정은 `vite.config.ts`에 있습니다.
- 안드로이드 크롬에서는 앱 설치 배너가 뜨고, 아이폰 사파리에서는 "공유 → 홈 화면에 추가" 안내가 뜹니다. (`shared/ui/InstallBanner.tsx`)
- 서비스 워커는 HTTPS(또는 localhost)에서만 동작합니다. 개발 서버(`npm run dev`)에서는 꺼져 있으므로 `npm run build && npm run preview`로 확인하세요.
- 아이콘은 `public/icon.svg`가 원본이고, `pwa-*.png`는 여기서 뽑은 이미지입니다. 마스커블 원본은 `scripts/icon-maskable.svg`입니다.
- 서버 푸시(복약 알림)는 백엔드가 준비된 뒤 서비스 워커에 `push` 이벤트 처리를 추가해야 합니다. 아직 구현 전입니다.

## 배포

`vercel.json`에 SPA 라우팅 설정이 포함되어 있어 Vercel에 그대로 배포할 수 있습니다.
