# 전생여지도 (前生輿地圖)
 
전주 관광 연계 **위치 기반 전생 체험 인터랙티브 웹앱**입니다. 전주의 역사·문화 거점 4곳을 QR로 인증하며 전생 조각을 모으고, 국립전주박물관 단계에서 나만의 전생 카드(이미지·음성·스토리)를 받습니다.
 
> 이 문서는 프로젝트 폴더의 실제 코드와 `src/config/features.ts` 플래그 설정을 기준으로 작성했습니다.
 
## 목차
1. [프로젝트 개요](#1-프로젝트-개요)
2. [핵심 사용자 플로우](#2-핵심-사용자-플로우-user-journey)
3. [전생 캐릭터 콘텐츠 및 에셋 구조](#3-전생-캐릭터-콘텐츠-및-에셋-구조)
4. [기술 스택 및 디렉토리 구조](#4-기술-스택-및-디렉토리-구조)
5. [실행 아키텍처 및 확장 플래그](#5-실행-아키텍처-및-확장-플래그-srcconfigfeaturests)
6. [로컬 설치 및 실행 방법](#6-로컬-설치-및-실행-방법)
---
 
## 1. 프로젝트 개요
 
- **서비스명**: 전생여지도 (前生輿地圖)
- **한 줄 소개**: 전주 관광 연계 위치 기반 전생 체험 인터랙티브 웹앱
- **기획 의도**: 전주의 역사·문화 거점을 직접 방문하게 하고, 방문 인증의 결과로 "나의 전생"이라는 이야기 보상을 주어 관광 동선과 체험 몰입을 함께 만든다.
- **핵심 사용자 경험**
  - **모바일 430px 우선 UI**: 결과 화면과 하단 내비게이션이 `max-w-[430px]` 기준으로 설계되어 있습니다.
  - **장소 인증**: 거점마다 비치된 공식 QR을 카메라 또는 QR 이미지 업로드로 인식해 방문을 인증합니다. QR은 `src/data/qrAllowlist.ts`의 정확히 일치하는 URL만 인정합니다.
  - **전생 카드·음성·스토리**: 고정된 10종 캐릭터 중 하나가 9:16 카드, 대표 대사 음성, 설정·대화·결과·인생 마무리 4단 스토리로 제공됩니다.
  - **보상**: 거점별 제휴 쿠폰(가상 바코드)과 미디어월 전시.
## 2. 핵심 사용자 플로우 (User Journey)
 
화면은 `src/App.tsx`의 `SceneId`(1~11)로 전환됩니다.
 
| Scene | 컴포넌트 | 설명 |
|---|---|---|
| 1 | `SceneStart` | 시작 화면. "시작하기" 후 `TutorialModal`(오늘 하루 숨기기 가능)을 거칩니다. |
| 2 | `SceneInputConsent` | 체험자 등록: 이름(선택, 16자), 생년월일, 동행 여부, 위치·카메라 안내 확인. |
| 3·4·5 | `HomeWorkspace` | 하나의 컴포넌트가 지도 / 내 조각 / 쿠폰 세 탭을 보여줍니다. |
| 6 | `SceneQrScan` | 거점 QR 스캔(카메라 자동 인식 + 사진 촬영·이미지 선택). |
| 7 | `SceneArriveVerify` | 방문 인증 확인 및 "조각 · 쿠폰 받기". |
| 8 | `SceneClueReveal` | 획득한 조각과 쿠폰 공개. |
| 9 | `SceneMuseumFace` | 국립전주박물관 단계: 얼굴 촬영·업로드 후 전생 확인. |
| 10 | `SceneResult` | 최종 전생 결과 화면. |
| 11 | `SceneMediaConsent` | 미디어월 전시 동의(Yes/No) 및 결과 팝업. |
| (라우트) | `MediaWallPage` (`/wall`), `AdminDashboardPage` (`/admin`) | 별도 경로 화면. |
 
### 2-1. 시작과 체험자 등록
`SceneStart`에서 시작하면 같은 탭에 진행 중인 기록이 있는지 확인해 `RestoreSessionModal`로 이어하기를 묻고, 없으면 `SceneInputConsent`로 이동합니다. 등록이 끝나면 지도 화면으로 들어갑니다.
 
### 2-2. 지도 탐색과 거점 QR 인증 — 조각 4개 수집
- `HomeWorkspace`의 지도는 **전통 여지도(기본)** 와 **네이버 지도** 보기를 전환할 수 있습니다. 네이버 지도는 `VITE_NAVER_MAP_CLIENT_ID`가 있을 때만 쓰입니다(`JeonjuNaverMap`).
- 조각을 모으는 거점은 **4곳**이며 거점마다 조각 종류가 정해져 있습니다(`src/data/jeonjuSpots.ts`).
| 순서 | 거점 | 조각 | 인증 반경(`verifyRadiusMeters`) |
|---|---|---|---|
| 1 | 완판본문화관 | 이야기(`story`) | 240m |
| 2 | 경기전 | 시대(`era`) | 220m |
| 3 | 남부시장 | 소지품(`item`) | 240m |
| 4 | 전라감영 | 신분(`status`) | 220m |
 
- 거점마다 QR 인증(`SceneQrScan`) → 방문 확인(`SceneArriveVerify`) → 조각·쿠폰 수령 순서로 진행됩니다. 같은 장소를 다시 인증하면 이미 완료된 것으로 처리됩니다.
- **내 조각** 탭은 칠교(탱그램) 2×2 판(`TangramClueBoard`)으로 4개 조각의 진행 상황을 보여줍니다.
### 2-3. 국립전주박물관 단계와 결과 화면
- 조각 4개를 모두 모아야 국립전주박물관 QR 인증과 촬영 단계(`SceneMuseumFace`)로 진행할 수 있습니다. 촬영·업로드한 사진은 `ENABLE_AI_GENERATION = false`인 현재 **이 기기 화면 밖으로 전송되지 않습니다**.
- 결과 화면 `SceneResult`(`max-w-[430px]`)는 다음으로 구성됩니다.
  - 9:16 전생 카드 이미지와 `{emoji} {title}` 제목
  - 오디오 플레이어(재생·일시정지·다시 듣기 + 대표 대사 박스)
  - 4단 스토리: **설정 / 대화 / 결과(직업·평판·업적) / 인생 마무리**
  - **다른 전생 확인하기**: 현재 캐릭터를 제외하고 새로 뽑습니다. 따라서 연속으로 같은 캐릭터가 나오지 않습니다.
  - 공유·저장, 미디어월 전시 선택, 쿠폰 링크
- **캐릭터 고정**: 뽑힌 캐릭터 id는 `sessionStorage`(`jeonsaeng:currentCharacterId`)에 저장되어 새로고침하거나 다른 탭에 다녀와도 유지됩니다. 직전 캐릭터 id는 `localStorage`(`jeonsaeng:lastCharacterId`)에 남아 새 체험을 시작할 때도 같은 캐릭터가 연속으로 나오지 않게 합니다.
### 2-4. 미디어월 동의 팝업, 쿠폰함, 하단 내비게이션
- **미디어월 전시 동의**(`SceneMediaConsent`): "나의 전생을 미디어월에 전시하시겠어요?"에서 Yes/No를 선택하면 중앙 팝업이 열립니다.
  - **Yes**: 등록 완료 안내와 `[박물관 미디어월 보기]`, `[동의 철회]` 버튼
  - **No**: 비공개 설정 안내(결과와 쿠폰은 유지)와 `[혜택 쿠폰함 확인하기]` 버튼
  - 팝업은 `← 이전으로 돌아가기`, `X`, 바깥 영역 클릭으로 닫히며, 이미 선택한 값을 다시 누르면 같은 팝업이 다시 열립니다.
- **미디어월**(`/wall`, `MediaWallPage`): 동의한 전시 목록과 예시 작품 3건을 보여줍니다.
- **쿠폰함**(쿠폰 탭): 거점별 제휴 쿠폰과 CODE128 바코드 모달(`CouponBarcodeModal`). 로컬 모드의 쿠폰은 모두 **시연용 가상 바코드**이며 실제 매장에서는 사용할 수 없다는 안내가 표시됩니다.
- **하단 3탭 내비게이션**(`BottomNav`: `지도` / `내 조각` / `쿠폰`):
  - 지도·QR 스캔·방문 인증·조각 확인·박물관 촬영·결과·미디어월 동의 화면에서 보입니다.
  - **시작·개인정보 입력·미디어월 페이지(`/wall`)·관리자 페이지에서는 보이지 않습니다.**
  - 어느 화면에서든 탭을 누르면 즉시 해당 탭(Scene 3/4/5)으로 이동하고, 진행 상태를 저장합니다.
## 3. 전생 캐릭터 콘텐츠 및 에셋 구조
 
- 데이터: `src/data/characters.ts`의 `CHARACTERS` 배열(10종)
- 에셋: `public/characters/NN.webp`(9:16 이미지), `public/characters/NN.mp3`(대표 대사 음성) — `NN`은 `01`~`10`
- 각 캐릭터는 `Character` 타입으로 아래 필드를 가집니다.
| 필드 | 설명 |
|---|---|
| `id` | `'01'`~`'10'` (에셋 파일 번호와 동일) |
| `emoji`, `title` | 결과 제목 `{emoji} {title}` |
| `imageUrl`, `audioUrl` | `/characters/NN.webp`, `/characters/NN.mp3` |
| `quote` | 대표 대사(음성 파일과 같은 문장) |
| `setting` | [설정] 본문 |
| `dialogue` | [대화] 본문. `화자: "대사"` 줄은 화자 강조, `( … )` 줄은 지문으로 렌더링 |
| `result` | `{ job, reputation, achievement }` (직업·평판·업적) |
| `ending` | [인생 마무리] 본문 |
 
| 번호 | 이모지 | 전생 |
|---|---|---|
| 01 | 📜 | 몰래 상단 차린 막내딸 |
| 02 | 🍚 | 수라간 반항아 숙수 |
| 03 | 🎨 | 도화서 사고뭉치 화원 |
| 04 | 📚 | 과거 낙방 9수생 |
| 05 | 🧺 | 수다쟁이 보부상 |
| 06 | 🚨 | 오지랖 포도청 포졸 |
| 07 | 🐎 | 마패를 숨긴 암행어사 |
| 08 | 🌧️ | 빗속의 어진 수문장 |
| 09 | 🪵 | 마지막 글자를 새긴 목판 각수 |
| 10 | 🎭 | 관객보다 추임새가 큰 소리꾼 |
 
주요 헬퍼: `pickRandomCharacter(excludeId)`, `getCharacterById`, `parseDialogue`, `characterToStory`(캐릭터 → `PastLifeStory` 변환), `getOrPickCurrentCharacter` / `pickAnotherCharacter` / `clearCurrentCharacter`(sessionStorage 고정 관리).
 
## 4. 기술 스택 및 디렉토리 구조
 
### 기술 스택 (`package.json` 기준)
- **프론트엔드**: React 19, TypeScript, Vite 8
- **스타일링**: Tailwind CSS 4(`@tailwindcss/vite`), 아이콘 `lucide-react`, 애니메이션 `motion`
- **QR·바코드**: `jsqr`(QR 디코딩), `qrcode`, `jsbarcode`(CODE128)
- **상태 관리**: 별도 상태 라이브러리 없이 React state + 브라우저 저장소
  - `sessionStorage`: 체험 세션(생년월일 포함), 고정 캐릭터 id
  - `localStorage`: 미디어월 전시 목록, 직전 캐릭터 id, 튜토리얼 숨김 기한
  - 저장소를 쓸 수 없는 환경에서는 메모리로 대체됩니다.
- **서버(확장 경로용)**: Express 4, `node:sqlite`, `@google/genai`
- **패키지 매니저**: Bun (`bun.lock`)
### 디렉토리 구조
```
jeonju-yeojido/
├─ public/
│  ├─ characters/            # 01~10 .webp(이미지) / .mp3(음성)
│  └─ assets/                # 시작 화면 캐릭터 등 정적 에셋
├─ src/
│  ├─ App.tsx                # 장면(Scene 1~11)·라우트(/, /wall, /admin) 전환, 진행 저장
│  ├─ config/features.ts     # 실행 방식 플래그
│  ├─ data/
│  │  ├─ characters.ts       # 전생 캐릭터 10종 + 고정/랜덤 헬퍼
│  │  ├─ jeonjuSpots.ts      # 거점 5곳, 쿠폰, 굿즈, 미디어월 예시 데이터
│  │  ├─ qrAllowlist.ts      # 공식 QR URL 허용 목록과 검증
│  │  ├─ spotImages.ts       # 거점 이미지 매핑
│  │  └─ defaultPastLifeStory.ts  # 서버 경로용 기본 스토리
│  ├─ components/
│  │  ├─ Scene*.tsx          # 장면별 화면 (Start, InputConsent, QrScan, ArriveVerify,
│  │  │                      #   ClueReveal, MuseumFace, Result, MediaConsent)
│  │  ├─ HomeWorkspace.tsx   # 지도 / 내 조각 / 쿠폰 탭
│  │  ├─ BottomNav.tsx       # 공통 하단 3탭 내비게이션
│  │  ├─ JeonjuNaverMap.tsx  # 네이버 지도 연동
│  │  ├─ TangramClueBoard.tsx, CompleteSealStamp.tsx  # 내 조각 보드·완료 도장
│  │  ├─ CouponBarcodeModal.tsx, TutorialModal.tsx, RestoreSessionModal.tsx, RecoveryCodeModal.tsx
│  │  ├─ MediaWallPage.tsx, AdminDashboardPage.tsx    # /wall, /admin
│  │  └─ LoginModal.tsx      # 로그인 UI (현재 화면에 연결되어 있지 않음)
│  ├─ utils/
│  │  ├─ localApi.ts         # 서버 없이 /api/* 를 브라우저에서 처리 (로컬 모드 핵심)
│  │  ├─ pastLifeEngine.ts   # 세션·조각·방문 인증 규칙 (서버와 공용 순수 함수)
│  │  ├─ couponBarcode.ts    # 쿠폰 바코드 생성·검증
│  │  ├─ portraitPainter.ts  # 캔버스 전통 초상화(서버 경로 폴백)
│  │  ├─ geminiGenerator.ts, portraitFiles.ts    # Gemini 생성·초상 파일 저장 (확장용)
│  │  ├─ serverStore.ts, authCrypto.ts, couponServerCrypto.ts  # 서버(SQLite)용
│  │  ├─ authHandlers.ts     # 로그인 스텁 (LoginModal용)
│  │  └─ storage.ts, tutorialStorage.ts, hahoeMeshDance.ts
│  └─ types/jeonju.ts        # 세션·조각·쿠폰·결과 타입
├─ server.ts                 # Express 서버 (개발 시 Vite 미들웨어 포함)
├─ supabase/proposals/       # Supabase 스키마 제안서 (미적용)
├─ .env.example, vite.config.ts, tsconfig.json, package.json
```
 
## 5. 실행 아키텍처 및 확장 플래그 (`src/config/features.ts`)
 
```ts
export const USE_LOCAL_BACKEND = true;
export const ENABLE_AI_GENERATION = false;
```
 
### 5-1. 로컬 단독 실행 모드 (`USE_LOCAL_BACKEND = true`) — 현재 구조
- 화면 코드의 모든 `/api/*` 호출은 `apiFetch`(`src/utils/localApi.ts`)를 거치며, 플래그가 `true`이면 **서버·DB 없이 브라우저가 직접 응답**합니다. 검증 규칙은 서버와 같은 순수 함수(`pastLifeEngine`, `qrAllowlist`)를 재사용합니다.
- 처리하는 기능: 체험자 등록, 진행 저장(PUT)·조회, QR 인증(`verify-qr`, `verify-spot`), 조각·쿠폰 수령(`claim`), 쿠폰 사용, 전생 결과 생성(`past-life/generate`), 미디어월 동의·목록.
- 결과 생성은 `getOrPickCurrentCharacter()`로 고정된 캐릭터를 그대로 사용합니다(`generationSource: 'curated-demo'`).
- **제약 사항**
  - 체험 기록은 `sessionStorage`에 있어 **탭을 닫으면 사라집니다**. 미디어월 전시 목록만 `localStorage`라 같은 브라우저에서 유지됩니다.
  - 복구 코드 불러오기는 지원하지 않습니다(`/api/auth/recover`는 404).
  - 관리자 통계(`/api/admin/*`)는 사용할 수 없습니다(503).
  - 미디어월은 **같은 브라우저**에 저장된 전시만 보입니다(다른 기기와 공유되지 않음).
  - 진행하려면 실제 QR 인식(카메라 또는 QR 이미지 업로드)이 필요합니다. 별도의 시연·우회 모드는 없습니다.
  - 쿠폰은 가상 바코드이며 실제 매장에서 사용할 수 없습니다.
  - 박물관 단계의 위치 확인(GPS)은 브라우저 위치 권한을 사용하며, 박물관 QR로 이미 인증한 경우 생략됩니다.
### 5-2. 추후 확장 대비 구조 (`ENABLE_AI_GENERATION = false`)
- **Gemini 생성**: `src/utils/geminiGenerator.ts`와 `server.ts`의 생성 로직은 삭제하지 않고 보존되어 있습니다. 플래그가 `false`이면 API 키가 있어도 Gemini를 호출하지 않고, 사진도 서버로 전송하지 않습니다.
- **다시 켜는 방법(서버 경로)**: `USE_LOCAL_BACKEND = false`로 바꿔 `/api/*`를 `server.ts`가 처리하게 하고, `ENABLE_AI_GENERATION = true`로 바꾼 뒤 `.env`에 `GEMINI_API_KEY`를 설정합니다. 서버 경로는 SQLite(`node:sqlite`, `.data/`)에 기록을 저장합니다. 이 서버 경로는 현재 로컬 모드와 별도로 유지되는 코드이며, 로컬 모드 전환 이후 끝까지 다시 검증하지는 않았습니다.
- **Supabase**: 현재 연동되어 있지 않습니다. `supabase/proposals/0001_jeonsaeng_schema.sql`은 스키마 **제안서**이고, `LoginModal.tsx`와 `authHandlers.ts`(스텁, `TODO(auth)` 지점)는 인증을 붙일 때 교체할 확장 지점입니다. 둘 다 현재 앱 화면에 연결되어 있지 않습니다.
## 6. 로컬 설치 및 실행 방법
 
**사전 준비**: [Bun](https://bun.sh)과 Node.js(`node:sqlite` 사용을 위해 최신 LTS 이상 권장)
 
```bash
# 1) 의존성 설치
bun install
 
# 2) (선택) 환경 변수 — 로컬 모드는 필수 값이 없습니다
cp .env.example .env
#   네이버 지도를 쓰려면 VITE_NAVER_MAP_CLIENT_ID 설정
 
# 3) 개발 서버 실행 (package.json의 "dev" = tsx server.ts → Express + Vite 미들웨어)
bun run dev          # 기본 http://localhost:3000 (포트 변경: PORT=4000)
```
 
- 서버 없이 Vite 개발 서버만 쓰려면 `bunx vite`도 가능합니다(로컬 모드이므로 동작).
- 카메라·위치 권한은 보안 컨텍스트(`localhost` 또는 HTTPS)에서만 동작하므로, 휴대폰으로 확인하려면 HTTPS 주소(터널 등)를 사용하세요.
```bash
# 타입 검사
bun run lint         # tsc --noEmit
 
# 단위 테스트 (package.json에 test 스크립트는 없음)
bunx tsx --test src/utils/*.test.ts
 
# 프로덕션 빌드 / 미리보기
bun run build        # vite build → dist/
bun run preview
```
 
### 알려진 상태
- `bun run lint` 시 쿠폰 서버 저장소(`serverStore.ts`)의 `redeemDemoCoupon`/`redeemCouponByIssueCode` 관련 **기존 타입 오류 12건**(`server.ts` 2건, `couponBarcode.test.ts` 10건)이 있으며, 같은 원인으로 쿠폰 테스트 1건이 실패합니다. 로컬 모드 화면 동작과는 무관합니다.
 