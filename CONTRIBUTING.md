# 팀 작업 가이드

## 폴더 규칙

기능(feature) 단위로 폴더를 나누고, 한 사람이 한 기능 폴더를 맡습니다.
같은 파일을 동시에 고치는 일이 줄어 충돌이 적습니다.

```
src/
  app/        앱 진입점: App(라우트), providers
  features/
    auth/       로그인, 소셜 OAuth, 사용자 프로필 스토어
    dashboard/  홈 대시보드, 내 정보
    care/       안부·복약, 보호자 알림
    jobs/       일자리·프로그램, 원클릭 지원서
    map/        복지 시설 지도
    policies/   맞춤 정책
      pages/       라우트에 연결되는 화면
      components/  이 기능에서만 쓰는 컴포넌트
      api/         API 호출(xxx.ts), React Query 훅(queries.ts), Mock 데이터(mock.ts)
      store/       Zustand 스토어
      lib/         순수 함수(판정 로직 등)
      types.ts     이 기능의 타입
  shared/     두 곳 이상에서 쓰는 것만 둡니다.
    ui/         BigButton, VoiceInputBox, InfoCard 등 디자인 시스템
    layout/     헤더, 하단 탭바
    hooks/      음성 인식, 현재 시각
    api/        공통 fetch 클라이언트, Mock 도우미
    store/      전역 설정 스토어
    types.ts    공통 타입
```

### 지켜야 할 것

- 다른 기능 폴더를 가져다 쓸 때는 `@/features/jobs/...` 처럼 절대 경로로 씁니다.
- 한 기능에서만 쓰는 코드는 그 기능 폴더 안에 둡니다. 두 곳 이상에서 쓰게 되면 `shared/`로 옮깁니다.
- 상대 경로는 같은 폴더 안 파일끼리만 씁니다. 예: `./mock`, `../types`
- 새 공통 UI 컴포넌트는 `shared/ui`에 만들고 `index.ts`에서 내보냅니다.

## 시니어 친화 UI 규칙

- 글자는 기본 16px 이상, 터치 영역은 48px 이상으로 합니다.
- 색만으로 상태를 구분하지 않고 글자나 아이콘을 함께 씁니다.
- 아이콘만 있는 버튼에는 반드시 `aria-label`을 붙입니다.
- 로딩, 에러, 빈 결과 화면을 항상 함께 만듭니다. `shared/ui/Feedback.tsx`를 사용하세요.

## Mock과 실제 API

- 기본은 Mock 데이터입니다. `.env`에서 `VITE_USE_MOCK=false`로 바꾸면 실제 API를 호출합니다.
- 각 기능의 `api/xxx.ts`에는 Mock 분기와 실제 호출이 함께 있습니다.
- 백엔드와 응답 형태를 맞출 때는 해당 기능의 `types.ts`를 기준으로 합니다.

## 브랜치와 커밋

- 브랜치: `main` 은 배포용입니다. 작업은 `feat/기능-내용`, `fix/내용` 브랜치에서 하고 Pull Request로 합칩니다.
  - 예: `feat/care-sos-button`, `fix/map-marker-overlap`
- 커밋 메시지는 `종류: 내용` 형식입니다. 종류는 `feat`, `fix`, `style`, `refactor`, `docs`, `chore`를 씁니다.
  - 예: `feat: 복약 체크 편집 모드 추가`
- PR 전에 아래 세 가지를 통과시킵니다.

```bash
npm run format   # 코드 포맷 통일
npm run lint     # 린트
npm run build    # 타입 검사 + 빌드
```

## 개발 환경

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev
```

PowerShell에서 `npm` 실행이 막히면 `npm.cmd run dev`를 사용하거나
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`를 한 번 실행하세요.
