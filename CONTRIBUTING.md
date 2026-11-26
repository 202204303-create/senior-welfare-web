# 팀 작업 가이드

## 폴더 규칙

기능(feature) 단위로 폴더를 나누고, 한 사람이 한 기능 폴더를 맡습니다.
같은 파일을 동시에 고치는 일이 줄어 충돌이 적습니다.

```
src/
  app/        앱 진입점: App(라우트), providers
  features/
    auth/       로그인(시연용 계정), 사용자 역할 스토어
    care/       안부·복약, 보호자 화면, Firebase 동기화, 알림
    dashboard/  어르신 홈, 내 정보
    worker/     복지사 화면
      pages/       라우트에 연결되는 화면
      components/  이 기능에서만 쓰는 컴포넌트
      api/         Firestore 읽기·쓰기(xxx.ts)
      hooks/       이 기능의 훅
      store/       Zustand 스토어
      lib/         순수 함수(판정 로직 등)
      types.ts     이 기능의 타입
  shared/     두 곳 이상에서 쓰는 것만 둡니다.
    ui/         BigButton, InfoCard 등 디자인 시스템
    layout/     헤더, 하단 탭바
    hooks/      현재 시각, 설치 안내
    api/        Firebase 연결, 푸시 알림 등록
    lib/        알림 표시, 음성 안내 등
    store/      전역 설정·알림 스토어
    types.ts    공통 타입
api/          Vercel 서버 함수와 시험 (notify, notify-checkin, check)
docs/         설계 문서 (role-interfaces.md)
```

### 지켜야 할 것

- 다른 기능 폴더를 가져다 쓸 때는 `@/features/care/...` 처럼 절대 경로로 씁니다.
- 한 기능에서만 쓰는 코드는 그 기능 폴더 안에 둡니다. 두 곳 이상에서 쓰게 되면 `shared/`로 옮깁니다.
- 상대 경로는 같은 폴더 안 파일끼리만 씁니다. 예: `./mock`, `../types`
- 새 공통 UI 컴포넌트는 `shared/ui`에 만들고 `index.ts`에서 내보냅니다.

## 시니어 친화 UI 규칙

어르신 화면 기준입니다. 보호자·복지사 화면도 같은 공통 UI를 쓰고, 정보가 많은 복지사 화면은 데스크톱에서도 읽기 편하게 만듭니다.

- 글자는 기본 16px 이상, 터치 영역은 48px 이상으로 합니다.
- 색만으로 상태를 구분하지 않고 글자나 아이콘을 함께 씁니다.
- 아이콘만 있는 버튼에는 반드시 `aria-label`을 붙입니다.
- 로딩, 에러, 빈 결과 화면을 항상 함께 만듭니다. `shared/ui/Feedback.tsx`를 사용하세요.

## 서버와 데이터

- 데이터는 Firebase(Firestore)에 저장합니다. 구조는 `README.md` 의 "데이터 구조"와 `src/features/care/api/family.ts` 맨 위 설명을 기준으로 합니다.
- 서버 함수(`api/`)는 휴대폰 알림을 보내는 일처럼 **비밀 키가 필요한 일**만 맡습니다. 화면이 직접 할 수 있는 일은 화면에서 합니다.
- 서버 코드를 바꾸면 `npm run test:api` 로 시험하고, 새 규칙에는 시험을 함께 추가합니다. (`api/_lib/fakeFirestore.ts` 가짜 저장소 사용)
- 서버 키(`FIREBASE_SERVICE_ACCOUNT`, `CRON_SECRET`)는 Vercel·GitHub 비밀값에만 두고 코드·채팅·문서에 올리지 않습니다.
- `firestore.rules` 는 파일을 고쳐도 **자동으로 적용되지 않습니다.** Firebase 콘솔 → Firestore → 규칙에 붙여 넣고 게시해야 하니, 규칙을 바꾸는 PR은 적용 순서를 PR 본문에 적습니다.
- 시연용 계정(`features/auth/lib/demoAccounts.ts`)의 비밀번호는 실제 비밀번호로 쓰지 않습니다.

## 브랜치와 커밋

- **`main` 은 보호되어 있습니다.** 직접 푸시할 수 없고 PR 로만 합칩니다. 팀원의 PR 은 저장소 주인(`.github/CODEOWNERS`)이 **승인(Approve)해야 합칠 수 있고**, 승인 뒤에 새 커밋을 올리면 다시 승인이 필요합니다.

- 브랜치: `main` 은 배포용입니다. 작업은 `feat/기능-내용`, `fix/내용` 브랜치에서 하고 Pull Request로 합칩니다.
  - 예: `feat/care-sos-button`, `fix/guardian-header-wrap`
- 커밋 메시지는 `종류: 내용` 형식입니다. 종류는 `feat`, `fix`, `style`, `refactor`, `docs`, `chore`를 씁니다.
  - 예: `feat: 복약 체크 편집 모드 추가`
- PR 전에 아래를 통과시킵니다. (서버 코드를 바꿨다면 마지막 줄도)

```bash
npm run format     # 코드 포맷 통일 (src 폴더만 대상)
npm run lint       # 린트
npm run build      # 타입 검사 + 빌드
npm run test:api   # 서버 시험
```

- `npm run format` 은 `src` 만 고칩니다. `api/` 나 다른 사람의 파일에 서식 도구를 직접 돌려 **내용 변경 없이 줄바꿈만 바뀌는 일**이 없게 하세요.
- PR 을 올릴 때 `README.md` 의 작업 기록 표에 한 줄을 추가합니다. (작성 방법은 README 4번 항목)

## 개발 환경

```bash
npm install
cp .env.example .env   # Windows: copy .env.example .env
npm run dev
```

PowerShell에서 `npm` 실행이 막히면 `npm.cmd run dev`를 사용하거나
`Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`를 한 번 실행하세요.
