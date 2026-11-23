# 문서 사실 검증 보고서 (DOCUMENT_FACT_CHECK)

대상 문서: `docs/PROJECT_PLAN.md`, `docs/FUNCTIONAL_SPEC.md` (원본은 수정하지 않고 보존)
산출물: `docs/PROJECT_PLAN_VERIFIED.md`, `docs/FUNCTIONAL_SPEC_VERIFIED.md`, `docs/PPT_FACT_SHEET.md`, 본 문서

---

## 1. 검증 기준점

| 항목 | 값 | 확인 방법 |
| --- | --- | --- |
| 검증 시점 | 2026-11-20 08:52 ~ 09:10 (Asia/Seoul, UTC+9) | 시스템 시각 |
| 애플리케이션 루트 | `C:\workspace\jeonju-yeojido` (모노레포 아님, `package.json` 1개) | 폴더 목록 |
| 브랜치 | `main` (`.git/HEAD` = `ref: refs/heads/main`) | `.git/HEAD` 파일 |
| HEAD 커밋 | `b9a5d020` — "fix: 최신 수정 사항 반영" (2026-11-20 07:15) | `.git/refs/heads/main`, `.git/logs/HEAD` |
| `origin/main` (로컬에 기록된 원격 추적 참조) | `b9a5d020` (HEAD와 동일, 07:15 push 기록) | `.git/refs/remotes/origin/main` |
| 미커밋 변경 | **`git status`는 실행하지 못함.** 파일 수정 시각 기준으로 `src/`, `docs/`, `vercel.json`, `package.json`에서 HEAD 커밋(07:15:11) 이후 수정된 파일은 없음. 그래서 "검증 대상 소스 = HEAD와 같을 가능성이 높음"으로만 판단 | 파일 mtime 비교 (내용 비교 아님) |
| Vercel Production URL | **미확보.** 대화에 URL이 없고, `.vercel/` 폴더가 없음(CLI 연결 흔적 없음). 내장 브라우저의 Vercel은 로그인되어 있지 않음. 검증 환경에서 `*.vercel.app` 접속이 차단됨 | 폴더 목록, 브라우저 확인, curl(403 proxy) |
| Production 배포 커밋/ID | **미확인** | 위와 같음 |

> **결론:** 이 보고서의 모든 "일치/오류" 판정은 **로컬 HEAD(`b9a5d020`) 소스와 그 로컬 빌드** 기준입니다. Production 배포본이 같은 커밋인지는 확인하지 못했습니다. Production 관련 판정은 모두 **미검증**입니다.

### 검증 수준 표기
- **[코드]** 소스·설정 파일을 직접 읽어 확인
- **[테스트]** 자동 테스트·타입 검사·빌드 명령을 재실행해 확인
- **[브라우저-로컬]** 로컬 빌드(`vite preview`)를 headless Chrome으로 조작해 확인 (Linux, Chrome headless, 390×844, 위치·카메라·실제 소리 미사용)
- **[Prod]** Production 배포본에서 확인 — **이번 검증에서는 해당 없음**

---

## 2. 근거 ID 목록

### 2.1 코드·설정 근거 (C)

| ID | 근거 (파일:줄 · 이름) | 확인 내용 |
| --- | --- | --- |
| C01 | `src/config/features.ts:9,10,17` | `USE_LOCAL_BACKEND = true`, `ENABLE_AI_GENERATION = false`, `ENABLE_QUICK_COMPLETE_BUTTON = true` |
| C02 | `src/components/SceneStart.tsx:162,171-176` | `시작하기` → `LoginModal` 열기 → 로그인 성공 시 `onStart()` |
| C03 | `src/App.tsx:183 handleStartClick`, `:157 checkExistingAuthOrGoToInput` | 로그인 성공 후 `shouldShowTutorial`이 참이면 튜토리얼을, 아니면 기존 세션 확인 후 복원 모달 또는 입력 화면(Scene 2) |
| C04 | `src/components/TutorialModal.tsx:62,104,137,209-212` | Esc·배경 클릭·X·`확인하고 시작하기` 모두 `onCloseWithoutHide` → 숨김 저장 없이 진행 |
| C05 | `src/components/TutorialModal.tsx:94 handleToggleHideToday` | "오늘은 다시 이 창을 보지 않음"을 누르는 즉시 숨김 저장(`hideTutorialForToday`, 다음 로컬 자정까지) 후 바로 진행. 체크만 하고 머무를 수 없음 |
| C06 | `src/App.tsx:53-58 readRouteFromLocation`, `:574-576` | URL 라우트 `/`, `/wall`, `/admin`. `/wall`은 `MediaWallVideo`만 렌더 |
| C07 | `src/App.tsx` 장면 렌더 분기(`scene === 1…11`), `withNav(node, tab, withHeader)` | 상단 배너: 3/4/5(`HomeWorkspace` 내부), 10, 굿즈·결제. 하단 탭: 3~11과 굿즈·결제. 1·2에는 둘 다 없음 |
| C08 | `src/App.tsx:73` `useState<SpotId>('wanpanbon')`, `:240`, `src/utils/pastLifeEngine.ts:472 getResumeNavigationState` | 새 체험의 기본 선택 거점은 완판본문화관. 복원 시에는 진행 상태에 따라 다른 거점(박물관 등) 선택 |
| C09 | `src/data/jeonjuSpots.ts:6-101` | 거점 5곳의 순서·좌표·반경·지도 위치 (아래 3.1 표) |
| C10 | `src/data/qrAllowlist.ts:9-13,60 validateSpotQrCode` | QR 값은 `https://m.site.naver.com/…` 공개 단축 URL 5개. 앞뒤 공백만 제거하고 대소문자까지 정확히 일치해야 함 |
| C11 | `src/App.tsx:282 handleQrVerified` → `src/utils/localApi.ts:337 handleVerifyQr` | **QR만 맞으면 그 자리에서 조각+쿠폰이 지급되고 지도(Scene 3)로 복귀.** GPS 검사 없음. 도착 인증(7)·조각 공개(8) 화면은 이 기본 경로에 없음 |
| C12 | `src/utils/localApi.ts:391 handleClaim`, `src/components/SceneArriveVerify.tsx:81,163` | 도착 인증 화면(7)의 보조 경로: QR 값이 없을 때만 GPS 반경 검사(`verifySpotLocation`) |
| C13 | `src/utils/localApi.ts:350-357` | 박물관 QR은 조각 4개 미만이면 400 거절, 중복은 409 |
| C14 | `src/utils/localApi.ts:424 handleCompleteAllStamps` | skip은 `ENABLE_QUICK_COMPLETE_BUTTON`이 참일 때 4개 거점 조각·쿠폰을 한 번에 지급 |
| C15 | `src/utils/localApi.ts:639 apiFetch`, `:585 routeLocal` | `/api/*`는 네트워크로 나가지 않고 브라우저 안의 함수가 `Response` 객체를 만들어 반환 |
| C16 | `src/utils/localApi.ts:454 handleGenerate`, `:495 generationSource: 'curated-demo'` | "생성" API는 정적 JSON 캐릭터를 골라 결과 객체를 조립. 외부 AI 호출 없음 |
| C17 | `src/utils/pastLifeEngine.ts:157-164 determinePastLifeArchetype` | 원형(5종) = FNV 해시(`생년월일|첫 방문 거점|세션ID 앞 8자`) % 5 |
| C18 | `src/data/characters.ts:91 pickRandomCharacter`, `:185 getOrPickCurrentCharacter` | 표시 캐릭터 = `Math.random`으로 JSON 항목 중 선택(직전 id 제외, 후보가 없으면 전체). 탭 세션 동안 고정. **원형과 무관** |
| C19 | `src/data/charactersData.json` | 항목 1개(id `10`, 이미지 `/characters/10.jpg`, 음성 `/characters/10.mp3`) |
| C20 | `public/characters/` | jpg 11개(`01~11`, 1080×1920), mp3 10개(`01~10`). JSON이 참조하는 것은 `10.jpg`, `10.mp3`뿐 |
| C21 | `src/data/coupons.ts:19,122 pickCouponTemplate`, `src/utils/localApi.ts:110 assignRandomCoupons`, `:133 withCouponBarcodes` | 4개 카테고리 × 3종 = 12종 템플릿. 보유하지 않은 템플릿이 남은 카테고리 중 균등 선택 → 그 안에서 미보유 우선 선택. 조건 문구에 "제휴 예정 모델(시연용 가상 쿠폰)". `-DEMO-` 바코드 번호 |
| C22 | `src/components/CouponBarcodeModal.tsx:92` | `JsBarcode` `format: 'CODE128'` |
| C23 | `src/utils/localApi.ts:441 handleCouponUse` | 사용 처리: 잠금이면 409, 이미 사용이면 409, 아니면 `used=true` (브라우저 세션에만 기록) |
| C24 | `src/data/goods.ts` | 굿즈 14종, 가격 11,000~49,000원 |
| C25 | `src/components/GoodsCheckoutPage.tsx:22-31,93` | 수량 1~10, 수령 2종, 결제수단 4종, `setTimeout 1600ms` 후 완료 화면. 네트워크 호출·저장 없음. 완료 화면에 "시연용 결제입니다. 실제 결제·청구는 이루어지지 않았습니다." |
| C26 | `src/App.tsx:538 stampCount`, `:583 closeGoodsToResult` | 잠금 기준 = 박물관 제외 4개 거점 방문 인증 수. 결제 X·완료 → 결과가 있으면 결과(10), 없으면 지도 |
| C27 | `src/data/adminDummyStats.ts:2-16`, `src/utils/localApi.ts:206 getAdminLiveSnapshot` | 대시보드는 하드코딩된 가상 수치(기준 1,240명)에 **현재 탭의 sessionStorage 체험 기록 1건**을 더함 |
| C28 | `src/utils/authHandlers.ts:138 hashPassword` | 비밀번호 = `SHA-256("jeonju-yeojido:{id}:{pw}")`(솔트·반복 없음). `crypto.subtle`이 없으면 `djb2` 해시로 폴백. 저장 위치는 localStorage `jeonju_auth_users` |
| C29 | `src/utils/authHandlers.ts:97` | 기본 계정 `jeonju` / `1234` 자동 생성(`main.tsx`의 `ensureDefaultAccount`). 로그인 모달에는 이 계정 안내 문구가 없음 |
| C30 | `src/utils/authHandlers.ts:235,283,299` | Google: `VITE_GOOGLE_CLIENT_ID`가 있을 때만 GIS 버튼. 받은 ID 토큰을 **서명 검증 없이** base64 디코드해 이름·이메일·사진만 sessionStorage에 저장 |
| C31 | `src/utils/authHandlers.ts:32,316,336` | 카카오·네이버: 실제 OAuth 없이 "Kakao/Naver 체험자"로 저장(로컬 모드에서만 허용). 게스트: 인증 없음 |
| C32 | `src/components/SceneInputConsent.tsx:40` | 로그인 결과는 입력 화면 이름칸의 초기값으로만 쓰임. 체험 세션·권한과 연결되지 않음 |
| C33 | `src/utils/localApi.ts:57-58`, `characters.ts:68,160`, `authHandlers.ts:37,94`, `tutorialStorage.ts:7` | 저장 키 7개 (아래 3.3 표) |
| C34 | `src/utils/localApi.ts:532 handleWallConsent`, `:558 entry` | 전시 동의 시 localStorage에 `WallEntry`(id, sessionId, visitorAlias=입력 이름 앞 6자, title, hanjaTitle, era, oneLineSummary, characterId, portraitDataUrl=이미지 경로, publishedAt, isDemoSeed) 저장. 철회 시 해당 sessionId 항목 삭제. 최대 50건 |
| C35 | `src/components/MediaWallPage.tsx` (import 없음) | 전시 목록을 보여 주던 갤러리 컴포넌트는 **어디에서도 import되지 않음**. 저장된 전시 목록을 화면에 표시하는 곳이 현재 없음 |
| C36 | `src/components/MediaWallVideo.tsx:5,82,168` | 고정 파일 `/videos/mediawall.mp4` 재생. `controls` 표시. 소리 켠 재생이 `NotAllowedError`면 음소거로 재생. **사용자 결과를 영상에 넣는 코드 없음** |
| C37 | `src/App.tsx:567 closeMediaWall` | 닫기: `/wall`이면 `/`로, 체험 중(scene≠1)이면 지도 탭으로 |
| C38 | `src/components/SceneQrScan.tsx:195,268,371-394` | 카메라 프레임·이미지 파일을 canvas에서 `jsQR`로 디코드. object URL은 해제. 저장·전송 코드 없음 |
| C39 | `src/components/SceneArriveVerify.tsx:204,395` | 보조 경로의 "현장 사진" 입력은 파일을 읽지 않고 `spotPhotoCaptured=true` 플래그만 남김 |
| C40 | `server.ts:64-75,769,1062`, `src/utils/serverStore.ts` (`node:sqlite`) | 서버 경로: Express + `.data/jeonsaeng.db`(SQLite 파일) + Gemini(`ENABLE_AI_GENERATION`일 때). 상시 실행 Node 서버와 쓰기 가능한 디스크가 필요 |
| C41 | `server.ts` 라우트 목록 | 서버에는 `complete-all-stamps` 엔드포인트가 없음 (로컬 API에만 존재) |
| C42 | `supabase/proposals/0001_jeonsaeng_schema.sql`, `authHandlers.ts:176,209,324` | Supabase는 제안 SQL과 주석뿐. 클라이언트·의존성 없음 |
| C43 | `vercel.json` | `framework: vite`, `bun install --frozen-lockfile`, `bun run build`, `dist`, 확장자 없는 경로(단 `/api/` 제외)만 `/index.html`로 rewrite |
| C44 | `package.json`, `bun.lock` | 선언: react ^19.0.1, vite ^8.3.0, typescript ^7.0.2, tailwindcss ^4.3.3. lock 해석: react 19.3.1, vite 8.3.8, typescript 7.0.2, tailwindcss 4.3.5, express 4.22.3 |
| C45 | `index.html:2,15-16`, `src/index.css:3-8,16-17,39` | `lang="ko"`, Pretendard(jsDelivr CDN)·Noto Sans KR(Google Fonts) 로드, 로고 SangSangRock(jsDelivr), 루트 글자 `clamp(14px, calc(13px + 0.25vw), 16px)` |
| C46 | `src/components/AdminDashboardPage.tsx:64,564` | 로컬 모드에서 `/admin`은 인증 없이 열림. 쿠폰 교환 도구는 서버 모드에서만 표시 |
| C47 | `src/components/SceneMuseumFace.tsx:42-60` | 박물관 QR 인증이 있으면 GPS 생략, 없으면 브라우저 GPS로 300m 반경 확인 |
| C48 | `src/components/KoreanDatePicker.tsx:59`, `SceneInputConsent.tsx:176,332` | 달력 최소 1910-01-01(입력 화면에서 전달), 최대 기기 로컬 오늘 |
| C49 | `src/components/HomeWorkspace.tsx:549` | "어느 장소부터 방문하셔도 자유롭게" 안내. 방문 순서 검사 코드 없음(C11) |
| C50 | `src/components/JeonjuNaverMap.tsx` (import 없음) | 네이버 지도 컴포넌트 미사용 |

### 2.2 실행 근거 (R)

| ID | 명령·환경 | 결과 |
| --- | --- | --- |
| R01 | `bun run lint` (= `tsc --noEmit`), Linux, Node 22.23.5, bun 1.4.4, HEAD 소스 | **오류 12건**: `server.ts` 2건(690, 1049 TS2339), `src/utils/couponBarcode.test.ts` 10건 |
| R02 | `bun test` | **45건 중 41 통과, 4 실패**: live HMAC 쿠폰 1건, `characters` 3건(10종 데이터, 직전 비반복, 캐릭터 고정 — 데이터 1종이라 실패) |
| R03 | `bun install --frozen-lockfile` → `bun run build` | 성공(1789 modules). `dist` 26MB, `dist/videos/mediawall.mp4`·`characters`·`goods`·`places` 포함. 번들 500KB 초과 경고 |
| R04 | `vite preview`(로컬 dist) + headless Chrome 흐름 테스트 (2026-11-20 09:02) | ① `시작하기` → 로그인 모달 ② 로그인 후 튜토리얼 ③ Esc → 입력 화면, 숨김 키 저장 안 됨 ④ 입력 후 지도, "장소 1 선택됨" ⑤ 기념품 잠금 팝업 ⑥ skip → 4/4 ⑦ 박물관 QR 이미지 → 결과 화면(소리꾼) ⑦b `다른 전생 확인하기` 후에도 같은 이미지(`10.jpg`) ⑧ 전시 Yes → localStorage에 `WallEntry` 11개 필드, alias "전주여행자테"(이름 앞 6자) ⑨ 영상 `controls=true` ⑨b 닫기 → 지도 ⑩ 저장 키: local 3개, session 3개 ⑪ 굿즈 14개, 결제 완료 화면 문구 확인 ⑫ `/admin` "가상 누적 데이터(기준 1,240명)… +1 합산" ⑬ `/wall` 영상 |
| R05 | R04 실행 중 네트워크 요청 수집 | 외부 요청은 폰트 3건(jsDelivr Pretendard·SangSangRock, Google Fonts)과 QR 이미지 blob뿐. **`/api/` 네트워크 요청 0건** |
| R06 | `vite preview` 응답 확인 (로컬, Vercel 아님) | `/videos/mediawall.mp4` 200 `video/mp4` 실제 MP4, Range 요청 206. `/wall`·`/admin` 200 HTML |
| R07 | `vercel.json` rewrite 정규식을 10개 경로에 대입(Node) | `/`, `/wall`, `/admin` → index.html 대상. `.mp4`·`.jpg`·`/api/…` → 대상 아님 |
| R08 | `ffprobe`/`ffmpeg` (이번 세션 06:0x, 파일 mtime 이후 변경 없음) | `mediawall.mp4`: H.264 High 1920×1080 yuv420p + AAC-LC 44.1kHz 2ch, 25.03초, `moov`가 `mdat` 앞, 전체 디코딩 오류 없음, 평균 -25.4dB |
| R09 | headless Chrome에서 영상 재생 상태 (이번 세션 06:0x) | 버튼으로 열면 `muted=false`로 재생·오디오 디코딩 증가. `/wall` 직접 진입 시 자동재생 차단 → 음소거 재생. **스피커로 소리를 듣는 확인은 하지 않음** |

---

## 3. 핵심 사실 표

### 3.1 거점 상수 (C09)

| 순서 | id | 이름 | 좌표 | 반경 | 지도(%) | 조각 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | wanpanbon | 완판본문화관 | 35.8117, 127.1566 | 240m | 80/68 | 이야기 |
| 2 | gyeonggijeon | 경기전 | 35.8154, 127.1497 | 220m | 56/54 | 시대 |
| 3 | nambu_market | 남부시장 | 35.8126, 127.1462 | 240m | 40/74 | 소지품 |
| 4 | jeollagamyeong | 전라감영 | 35.8165, 127.1436 | 220m | 46/33 | 신분 |
| 5 | jeonju_museum | 국립전주박물관 | 35.8012, 127.0894 | 300m | 24/18 | 없음(4개 완료 후 결과) |

### 3.2 인증 경로 정리 (C11·C12·C13·C47)

| 경로 | 필수 조건 | GPS |
| --- | --- | --- |
| 기본: 지도 → `QR 스캔` → QR 일치 | QR 값이 해당 거점 허용 값과 정확히 일치 | **검사 안 함** |
| 보조: 도착 인증 화면(Scene 7) | QR 값이 있으면 QR만, 없으면 GPS 반경 | QR 없을 때만 |
| 박물관 결과 | 조각 4개 + (박물관 QR 인증 **또는** GPS 300m) | QR 있으면 생략 |
| 시연 skip | `ENABLE_QUICK_COMPLETE_BUTTON = true` | 없음 |

모든 검사는 **브라우저 안의 JavaScript**에서 실행됩니다(C15, R05). 서버 검증이 아닙니다.

### 3.3 브라우저 저장 키 (C33, R04⑩)

| 키 | 저장소 | 내용 |
| --- | --- | --- |
| `jeonsaeng:v2:local:session:experience` | sessionStorage | 체험 세션 전체(이름, 생년월일, 동행, 권한 확인, 방문 순서, 조각, 쿠폰·바코드 번호, 결과, 전시 동의 상태 등 23개 필드) |
| `jeonsaeng:local:auth` | sessionStorage | 로그인 방식, 표시 이름, ID(비밀번호 아님), Google이면 이메일·사진 URL |
| `jeonsaeng:v2:currentCharacterId` | sessionStorage | 이번 체험 고정 캐릭터 id |
| `jeonju_auth_users` | localStorage | 로컬 계정 목록(id, 이름, 비밀번호 해시) |
| `jeonsaeng:v2:local:wall` | localStorage | 전시 목록(`WallEntry`, 최대 50) — **입력 이름 앞 6자와 sessionId 포함** |
| `jeonsaeng:v2:lastCharacterId` | localStorage | 직전 캐릭터 id |
| `jeonsaeng_tutorial_hide_until_v1` | localStorage | 튜토리얼 숨김 만료 시각 |

sessionStorage는 브라우저 탭(정확히는 최상위 browsing context) 단위입니다. 탭을 닫으면 보통 사라지지만, 브라우저의 "닫은 탭 다시 열기"나 세션 복원으로 되살아날 수 있습니다. 같은 사이트를 **새 탭**으로 열면 공유되지 않습니다. 이 수명은 브라우저 동작에 따른 일반 사실이며, 이번 검증에서 직접 시험하지는 않았습니다.

---

## 4. 주장별 검증표

판정: 일치 / 오류 / 조건부 / 미검증 / 계획·시연
문서 약어: **PP** = PROJECT_PLAN.md, **FS** = FUNCTIONAL_SPEC.md

### A. 기준·이력

| ID | 문서·절 | 기존 주장 | 판정 | 검증 수준 | 실제 확인 내용 | 근거 | 수정 문구 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A01 | PP 머리말 | 완판본 기본 선택·한국어 달력 등은 "아직 커밋되지 않은 작업" | 오류(과거 정보) | [코드] | 05:56~07:15 커밋 12건에 반영됨. HEAD `b9a5d020` | V(1장), `.git/logs/HEAD` | "모든 내용은 커밋 `b9a5d020` 기준" |
| A02 | PP 부록 | 최근 커밋 10건 목록과 "이후 작업은 미커밋" | 오류(과거 정보) | [코드] | 목록은 05:43 이전 상태. 현재 최신 12건은 1장 이후 커밋 | `.git/logs/HEAD` | 부록을 현재 이력으로 교체하고 옛 목록은 삭제(이유: 현재 상태를 오해하게 함) |
| A03 | FS 4-2 | 타입 오류 12건, 기존 테스트 실패는 선행 이슈 | 일치(재실행) | [테스트] | 오류 12건, 테스트 45 중 4 실패 | R01, R02 | 명령·시각과 함께 기록 |
| A04 | FS 4-7 | 결과 화면은 타입 검사만, 브라우저 점검은 다른 화면에서 수행 | 오류(과거 정보) | [브라우저-로컬] | 이번에 결과 화면까지 로컬 브라우저로 확인 | R04⑦ | "로컬 빌드에서 결과 화면 진입 확인. 모바일 실기기·Production은 미검증" |
| A05 | PP 4.3 | 320/375/768/1280px 자동 점검 완료 | 미검증(재실행 안 함) | — | 이전 세션에 수행한 기록만 있고, 현재 HEAD로 재실행하지 않음 | — | "이전 버전에서 점검한 기록이 있으나 현재 커밋으로 재검증하지 않음" |

### B. 화면과 사용자 여정

| ID | 문서·절 | 기존 주장 | 판정 | 검증 수준 | 실제 확인 내용 | 근거 | 수정 문구 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | FS 1.2 흐름도 | 시작 → 튜토리얼 → 로그인 | **오류** | [코드][브라우저-로컬] | 실제 순서: 시작하기 → **로그인** → 튜토리얼(오늘 숨김이 아니면) → (기존 세션 있으면 복원 팝업) → 입력 | C02, C03, R04①② | 흐름도 수정 |
| B02 | FS F-01 ② | 로그인 → 튜토리얼 | 일치 | [코드][브라우저-로컬] | 위와 같음 | C03 | — |
| B03 | FS F-01 ④ | 튜토리얼에서 `확인하고 시작하기`로 이동 | 조건부(불완전) | [코드][브라우저-로컬] | Esc·배경·X·확인 버튼 모두 숨김 저장 없이 진행. "오늘은 다시 보지 않음"은 누르는 즉시 저장 후 진행 | C04, C05, R04③ | 네 가지 닫기 동작과 체크 즉시 진행을 명시 |
| B04 | FS F-01 ② | 기본 데모 계정, "모달에 안내문구 표시" | **오류** | [코드] | 로그인 모달에 `jeonju/1234` 안내 문구 없음 | C29 | "계정은 자동 생성되지만 화면에 안내되지 않음" |
| B05 | FS 1.1 표 | 장면 1~11과 컴포넌트, 배너·탭 표시 범위 | 일치 | [코드] | 배너: 3/4/5·10·굿즈·결제. 탭: 3~11·굿즈·결제 | C07 | — |
| B06 | FS F-03 / PP 2.1 | 첫 진입·`↻` 후 기본 선택은 완판본문화관 | 조건부 | [코드][브라우저-로컬] | 새 체험은 완판본(R04④). `↻`는 시작 화면으로만 이동하고 기록을 유지. 다시 들어가면 복원 규칙에 따라 다른 거점이 선택될 수 있음 | C08 | "새 체험을 시작하면 완판본문화관이 기본 선택" |
| B07 | PP 2.1 | 방문 순서 강제 없음 | 일치 | [코드] | 순서 검사 없음 | C11, C49 | — |
| B08 | FS F-07 | 결제 `X`·완료 → 결과가 있으면 결과, 없으면 지도. 스토어 `X` → 항상 지도 | 일치 | [코드] | — | C26 | — |
| B09 | FS F-05 | 미디어월 닫기 → 체험 중이면 지도, 시작 화면이면 시작 화면, `/wall`이면 `/` | 일치 | [코드][브라우저-로컬] | 결과·전시 화면에서 열어도 닫으면 지도로 감 | C37, R04⑨b | "결과 화면에서 열었어도 지도 탭으로 돌아감" 추가 |
| B10 | FS F-01 ⑥ | 새 체험 시작 시 고정 캐릭터 해제 | 미검증 | — | `clearCurrentCharacter` 호출 위치를 이번에 전수 확인하지 않음 | C18 | 단정 문구 삭제 |

### C. QR·위치 인증

| ID | 문서·절 | 기존 주장 | 판정 | 검증 수준 | 실제 확인 내용 | 근거 | 수정 문구 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| C-01 | FS F-03 | QR 성공 → 도착 인증 → 조각·쿠폰 수령 → 조각 공개 → 지도 | **오류** | [코드][브라우저-로컬] | QR 성공 즉시 조각·쿠폰 지급 후 지도로 복귀(완료 배너). 도착 인증·조각 공개는 별도 보조 경로 | C11, C12 | 기본 경로와 보조 경로를 분리해 서술 |
| C-02 | PP 1.2, FS F-03 | "QR·위치 인증으로 조각을 모은다" | 조건부 | [코드] | 기본 경로는 QR만. GPS는 QR 없이 도착 인증 화면을 쓸 때와 박물관 QR이 없을 때만 | 3.2 표 | "QR 인증(기본) 또는 위치 반경 확인(보조)" |
| C-03 | PP 2.1, FS F-03 | "박물관 QR은 서버 로직 단계에서 거절" | **오류(표현)** | [코드] | 서버가 아니라 브라우저 안의 로컬 API 함수가 거절 | C13, C15 | "앱 내부 검증 로직(브라우저)에서 거절" |
| C-04 | FS F-03 | 거점 좌표·반경·핀 위치 | 일치 | [코드] | 3.1 표 | C09 | — |
| C-05 | FS F-03 | QR 비교 규칙: 공백만 제거, 정확히 일치 | 일치 | [코드] | — | C10 | 단, 허용 값이 소스에 공개된 단축 URL이라 **현장 방문 증명이 아님**을 추가 |
| C-06 | FS F-03 | skip 시연 버튼, `false`로 바꾸면 버튼과 API 모두 꺼짐 | 일치(로컬 소스) / Prod 미검증 | [코드][브라우저-로컬] | HEAD에서 `true`. Production에서 보이는지는 미확인 | C01, C14, R04⑥ | "현재 커밋에서는 켜져 있음" |

### D. 결과 도출·캐릭터

| ID | 문서·절 | 기존 주장 | 판정 | 검증 수준 | 실제 확인 내용 | 근거 | 수정 문구 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| D01 | PP 0, FS 4-1 | `charactersData.json` 1종(10번) | 일치(재확인) | [코드][테스트] | 1개. 테스트 3건 실패 원인 | C19, R02 | — |
| D02 | PP 0 | 이미지 11장, 음성 10개, JSON은 1종만 사용 | 일치 | [코드] | 사용 중 파일은 `10.jpg`, `10.mp3` | C20 | — |
| D03 | features.ts 주석을 인용한 표현 | "고정 10종 캐릭터" | **오류(코드 주석)** | [코드] | 실제 1종 | C01 주석, C19 | 문서에서 "10종" 표현 금지 |
| D04 | PP 2.2 | 조각 값은 생년월일·방문 순서·세션 ID로 정해지는 원형에서 | 조건부(부정확) | [코드] | 쓰이는 것은 생년월일, **첫 방문 거점**(방문 순서 전체 아님), 세션 ID 앞 8자. 해시 결과로 5종 중 하나 | C17 | 정확한 입력 3가지 명시 |
| D05 | PP 2.2, FS F-05 | 결과 캐릭터는 직전 것을 피해 무작위, 체험 동안 고정 | 조건부 | [코드][브라우저-로컬] | 로직은 맞지만 현재 1종이라 항상 같은 캐릭터. `다른 전생 확인하기`도 같은 캐릭터 | C18, R04⑦b | 1종 상태 명시 |
| D06 | (발표 위험) | "개인화된 전생 결과" | 조건부 | [코드] | 생년월일 등으로 정해지는 것은 **조각 텍스트와 추천 굿즈(원형)**. 결과 화면의 주인공·이미지·음성·스토리는 무작위 캐릭터이며 원형과 연결되지 않음. 그래서 조각은 "암행어사"인데 결과는 "소리꾼"일 수 있음 | C16, C17, C18 | "조각은 입력값 기반, 최종 캐릭터는 무작위" |
| D07 | FS F-05 | "자동으로 `/api/past-life/generate`를 호출해 결과를 만든다" | 조건부(오해 소지) | [코드] | 이름은 generate지만 외부 AI 없이 정적 JSON을 골라 조립. `generationSource: 'curated-demo'` | C16 | "생성"이 아니라 "결과 조립(정적 콘텐츠)" |
| D08 | PP 5.2 | `ENABLE_AI_GENERATION`을 켜면 실시간 초상·스토리 합성 경로를 다시 사용 | **오류(과장)** | [코드] | 이 플래그는 `server.ts` 안에서만 읽힘. 현재 로컬 모드와 Vercel 정적 배포에서는 서버가 실행되지 않으므로 플래그만 켜도 효과 없음. 서버 실행·Gemini 키·저장소가 추가로 필요 | C40, C43 | "서버 경로가 보존되어 있으나 별도 서버 구축 없이는 동작하지 않음" |
| D09 | FS F-05 | 결과 화면 버튼·섹션 구성 | 일치 | [코드][브라우저-로컬] | — | R04⑦ | — |

### E. 쿠폰·굿즈·통계

| ID | 문서·절 | 기존 주장 | 판정 | 검증 수준 | 실제 확인 내용 | 근거 | 수정 문구 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | PP 2.3, FS F-06 | 4×3=12종, 카테고리 균등 후 템플릿, 중복 회피 | 일치 | [코드] | "미보유 템플릿이 남은 카테고리 중 균등" | C21 | 세부 규칙 보완 |
| E02 | FS F-06 | CODE128, `JSYJ-DEMO-…` | 일치 | [코드] | — | C21, C22 | — |
| E03 | PP 2.3 | "제휴 예정 모델" | 일치 | [코드] | 조건 문구에 "시연용 가상 쿠폰" | C21 | 발표에서는 "실제 제휴 아님" 명시 |
| E04 | FS F-06 | 쿠폰 사용 처리 | 일치(브라우저 기록) | [코드] | 사용 상태는 현재 탭 세션에만 기록. 매장 POS 연동 없음 | C23 | 저장 범위 명시 |
| E05 | PP 2.3, FS F-07 | 굿즈 14종, 가격 원화, 시연 결제 | 일치 | [코드][브라우저-로컬] | 11,000~49,000원, 수량 1~10, 결제·주문 저장 없음 | C24, C25, R04⑪ | — |
| E06 | FS F-07 | 현장 수령용 교환권 바코드 발급 | 계획·시연 | [코드] | 화면에 보이는 시연용 바코드. 저장·검증 시스템 없음 | C25 | "시연용 교환권 화면" |
| E07 | PP 2.3, FS F-08 | 대시보드 = 가상 누적 + 내 체험 기록 합산 | 조건부 | [코드][브라우저-로컬] | 합산 대상은 **같은 탭의 sessionStorage 체험 1건**. 다른 기기·다른 탭·다른 사용자 집계 아님 | C27, R04⑫ | "같은 브라우저 탭의 시연 기록 1건만 더함" |
| E08 | FS F-08 | "실시간 합산" | **오류(오해 소지)** | [코드] | 전체 사용자 실시간 집계가 아님 | C27 | "실시간" 표현 삭제 |
| E09 | adminDummyStats 수치 | 박물관 유입 3%→34.2% 등 | 계획·시연 | [코드] | 하드코딩 가상 수치. 실측 아님 | C27 | 발표에서 성과로 사용 금지 |

### F. 인증·저장·개인정보

| ID | 문서·절 | 기존 주장 | 판정 | 검증 수준 | 실제 확인 내용 | 근거 | 수정 문구 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F01 | PP 3.2 | "비밀번호 해시는 `authCrypto.ts`" | **오류** | [코드] | 해시는 `authHandlers.ts`의 `hashPassword`(SHA-256, 솔트 없음, djb2 폴백). `authCrypto.ts`는 서버용 복구코드·토큰 함수 | C28 | 파일 정정 + 보안 수준 명시 |
| F02 | FS F-01 | "로컬 회원가입(비밀번호는 해시 저장)" | 조건부 | [코드] | 해시 저장은 맞음. 그러나 브라우저 안에서만 비교하는 시연용 계정이며 보안 인증 체계가 아님 | C28 | "시연용 로컬 계정" |
| F03 | FS F-01 | Google 실제 로그인, JWT에서 이름·이메일 읽음 | 조건부 | [코드] | `VITE_GOOGLE_CLIENT_ID`가 빌드에 들어갔을 때만. 토큰 서명 검증 없음. 서비스 권한과 연결되지 않음(입력 화면 이름 초기값으로만 사용) | C30, C32 | 조건과 한계 명시 |
| F04 | FS F-01 예외 | Google 401 `invalid_client`의 원인은 승인된 원본 미등록 | **미검증** | — | 실제 오류 로그·Cloud Console 설정을 확인한 적 없음. `invalid_client`는 클라이언트 ID 오타·삭제·유형 불일치 등 다른 원인도 가능 | — | 원인 단정 삭제, 점검 항목으로 변경 |
| F05 | FS F-01 | 카카오·네이버 로컬 모드 체험 계정 | 일치 | [코드] | 실제 OAuth 없음 | C31 | "실제 연동 없음(체험 계정)" |
| F06 | FS 3.3, PP 3.2 | 저장 키·저장소 구분 | 일치 | [코드][브라우저-로컬] | 7개 키 | C33, R04⑩ | — |
| F07 | localApi 주석·PP 3.2 | "localStorage에는 개인정보를 두지 않는다" | **오류** | [코드][브라우저-로컬] | 전시 동의 시 입력 이름 앞 6자가 localStorage에 남음. 계정 목록(id·이름)도 localStorage | C34, R04⑧ | 정정 |
| F08 | FS F-05 | "별칭·직업·대표 대사만 전시 목록에 저장" | **오류** | [코드][브라우저-로컬] | 11개 필드(sessionId, era, characterId, 이미지 경로, 시각 등 포함) | C34, R04⑧ | 필드 전체 기재 |
| F09 | PP 3.2 | "탭을 닫으면 삭제" | 조건부 | — | 일반적으로 맞지만 탭 복원 등 예외 가능. 직접 시험 안 함 | 3.3 | "보통 탭을 닫으면 사라짐(브라우저 복원 시 예외 가능)" |
| F10 | FS 머리말 | 카메라는 QR 인식 전용, 얼굴·사진 저장 안 함 | 일치(로컬 코드 기준) | [코드] | QR 프레임은 메모리에서 디코드만. 보조 경로의 현장 사진은 파일을 읽지 않고 플래그만 저장 | C38, C39, R05 | 보조 경로 사진 입력 존재 명시 |
| F11 | (발표 위험) | 서버로 전송되는 개인정보 | 일치(로컬 빌드) / Prod 미검증 | [브라우저-로컬] | `/api/` 네트워크 요청 0건. 외부 요청은 폰트 CDN뿐(이 요청에는 일반 브라우저 정보·IP가 포함됨) | R05 | "서비스 자체 서버로 보내는 데이터 없음(현재 모드)" |

### G. 미디어월

| ID | 문서·절 | 기존 주장 | 판정 | 검증 수준 | 실제 확인 내용 | 근거 | 수정 문구 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G01 | PP 1.2 | "동의하면 전생 결과를 박물관 미디어월 전시 목록에 올린다" | **오류(과장)** | [코드] | 같은 브라우저의 localStorage에만 저장. 이 목록을 표시하는 화면도 현재 없음. 영상은 고정 파일 | C34, C35, C36 | "전시 동의 의사를 브라우저에 기록(실제 송출 없음)" |
| G02 | PP 5.1 | "체험 결과를 전시 콘텐츠로 연결" | 계획·시연 | [코드] | 현재 구현 아님 | C35, C36 | 기대 효과(계획)로 분리 |
| G03 | FS 4-5 | `MediaWallPage.tsx`는 영상 오버레이를 감싸는 래퍼 | **오류** | [코드] | 어디서도 import되지 않는 옛 갤러리 코드 | C35 | "미사용 코드" |
| G04 | FS F-05 | 진입 경로 4곳 + `/wall`이 같은 영상 | 일치 | [코드][브라우저-로컬] | — | C06, C36, R04⑨⑬ | — |
| G05 | FS F-05 | 소리 먼저 시도, 막히면 음소거, 좌하단 토글 | 일치(현재 코드) | [코드][브라우저-로컬] | 추가로 브라우저 기본 `controls` 표시 | C36, R04⑨, R09 | `controls` 추가 |
| G06 | FS F-05 | "H.264여야 모든 브라우저에서 재생된다" | **오류(과잉 일반화)** | [코드] R08 | 파일은 H.264 High + AAC-LC MP4. 주요 최신 브라우저에서 널리 지원되는 조합이지만, 대상 브라우저·OS 전체를 시험하지 않음 | R08, R09 | "널리 지원되는 H.264/AAC MP4로 인코딩됨. 검증 범위는 Chrome(로컬)" |
| G07 | 사용자 정보 | Chrome에서 소리 확인 | 미검증(기록 부족) | — | 브라우저 버전·URL·파일 기준이 기록되지 않음 | — | 발표 확정 문장에서 제외 |

### H. 아키텍처·배포

| ID | 문서·절 | 기존 주장 | 판정 | 검증 수준 | 실제 확인 내용 | 근거 | 수정 문구 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| H01 | PP 0, 3.2 | 서버·DB 없이 브라우저에서 처리 | 일치 | [코드][브라우저-로컬] | `/api/*`는 브라우저 내부 함수 | C15, R05 | "`/api/*`는 네트워크 API가 아니라 앱 내부 인터페이스" |
| H02 | PP 3.2, 5.2 | `USE_LOCAL_BACKEND=false`로 바꾸면 실제 Express `/api/*` 호출 / 실서비스 백엔드 전환 | **오류(과장)** | [코드] | 호출 대상은 바뀌지만, Vercel 정적 배포에는 Express가 없고 `/api/`는 rewrite 제외라 404. 서버는 SQLite 파일 DB·상시 Node 실행 필요. skip API는 서버에 없음 | C40, C41, C43 | "별도 서버 호스팅·DB·키 설정·API 보완이 선행돼야 함" |
| H03 | PP 5.2 | "보존된 Express·Supabase 경로로 전환" | **오류** | [코드] | Supabase는 제안 SQL·주석뿐, 연동 코드 없음 | C42 | "Supabase는 설계 초안만 존재" |
| H04 | PP 3.1 | 기술 스택 | 일치 | [코드] | 선언 버전과 lock 해석 버전 구분 | C44 | 해석 버전 병기 |
| H05 | PP 3.1 | 실행 명령 | 조건부 | [코드] | `dev`=`tsx server.ts`(Express+Vite 미들웨어), `build`=`vite build`, `lint`=`tsc --noEmit`, 테스트 스크립트는 없음(`bun test`로 실행) | `package.json` | 정정 |
| H06 | (신규) | Vercel 배포 완료 | 미검증 | — | URL·배포 커밋 미확보 | 1장 | Production 사실은 별도 확인 후 기재 |
| H07 | (신규) | Vercel 설정 | 일치(파일) | [코드] | 정적 Vite 출력 + SPA rewrite. 서버리스 함수·DB 연결 없음 | C43, R07 | — |
| H08 | PP 3.3 | `/wall`, `/admin` 직접 접속 | 일치(로컬 preview) / Prod 미검증 | [브라우저-로컬] | — | R06 | — |
| H09 | PP 4.3 | 서체 Pretendard·Noto Sans KR, 로고 붓글씨 | 일치 | [코드][브라우저-로컬] | 외부 CDN 3곳에서 로드(오프라인·차단 환경이면 시스템 서체로 대체) | C45, R05 | CDN 의존 명시 |
| H10 | PP 4.1 | 팔레트 일부 미통일 | 일치 | [코드] | — | — | — |

---

## 5. 중대한 오류 요약

1. **흐름도 순서 오류**: 튜토리얼 → 로그인이 아니라 로그인 → 튜토리얼 (B01)
2. **QR 인증 경로 오류**: QR 성공 즉시 지급, GPS 없음. 도착 인증·조각 공개는 기본 경로가 아님 (C-01, C-02)
3. **서버 검증 표현 오류**: 모든 검증은 브라우저 내부 (C-03, H01)
4. **개인화 과장**: 최종 캐릭터는 무작위 1종. 생년월일은 조각 텍스트에만 영향 (D04~D06)
5. **AI·서버 전환 과장**: 플래그만으로 AI·백엔드가 동작하지 않음. Supabase 연동 없음 (D08, H02, H03)
6. **미디어월 전시 과장**: 전시 목록은 브라우저 localStorage에만 있고 어디에도 표시되지 않음. 영상은 고정 파일 (G01~G03)
7. **저장 필드·개인정보 문구 오류**: 전시 항목 11개 필드, 이름 일부가 localStorage에 남음 (F07, F08)
8. **비밀번호 해시 위치·수준 오류**: `authHandlers.ts`의 솔트 없는 SHA-256, 시연용 (F01, F02)
9. **커밋 이력·미커밋 서술**이 과거 정보 (A01, A02)

## 6. 두 문서 사이의 모순

| 항목 | PROJECT_PLAN | FUNCTIONAL_SPEC | 실제 |
| --- | --- | --- | --- |
| 진입 순서 | (부록 커밋 메시지) 로그인 → 튜토리얼 | 흐름도: 튜토리얼 → 로그인 / 본문: 로그인 → 튜토리얼 | 로그인 → 튜토리얼 |
| 미커밋 여부 | 일부 작업 미커밋 | 언급 없음 | HEAD에 모두 커밋됨 |
| MediaWallPage | 언급 없음 | 영상 래퍼 | 미사용 코드 |

## 7. 미검증 항목 (발표 확정 문장에서 제외)

1. Production URL, 배포 커밋, Production에서의 화면·영상·라우팅·헤더·콘솔 오류
2. Production에서 skip 버튼 노출 여부, `VITE_GOOGLE_CLIENT_ID` 설정 여부
3. 실제 기기(모바일)의 카메라 QR 인식, GPS 반경 판정, iOS Safari 동작
4. 실제 스피커로 들리는 영상·캐릭터 음성
5. Google `invalid_client` 오류의 실제 원인
6. 현재 커밋 기준 320/375/768/1280px 반응형 재점검
7. sessionStorage의 탭 복원 시 동작
8. 새 체험 시작 시 캐릭터 고정 해제 시점(B10)
9. 서버 모드(`server.ts`)의 실제 실행 결과 — 이번에 실행하지 않음

## 8. 발견된 버그·위험 (제품 코드는 수정하지 않음)

| ID | 내용 | 영향 | 근거 |
| --- | --- | --- | --- |
| BUG-01 | QR 허용 값이 소스에 공개된 단축 URL이고 기본 경로에 GPS가 없음 → QR 이미지만 있으면 원격으로 스탬프 획득 가능 | 현장 방문 증명으로 쓸 수 없음 | C10, C11 |
| BUG-02 | `ENABLE_QUICK_COMPLETE_BUTTON = true`가 HEAD에 있음 → 이 커밋으로 배포하면 공개 사이트에 skip 버튼 노출 | 누구나 4곳 완료 처리 | C01, C14 |
| BUG-03 | 비밀번호 해시가 솔트 없는 SHA-256(폴백 djb2), 기본 계정 `1234` | 같은 기기 접근자에게 노출 시 추측 가능. 보안 인증으로 사용 불가 | C28, C29 |
| BUG-04 | Google ID 토큰을 서명 검증 없이 디코드 | 표시 이름 위조 가능(현재 권한과 연결되지 않아 영향은 표시에 한정) | C30 |
| BUG-05 | 전시 목록에 이름 일부·sessionId가 localStorage에 무기한 저장되고, 사용하는 화면은 없음 | 공용 기기에서 다음 사용자에게 남음 | C34, C35 |
| BUG-06 | 캐릭터 1종이라 `다른 전생 확인하기`가 같은 결과를 보여 줌 | 기능이 동작하지 않는 것처럼 보임 | C19, R04⑦b |
| BUG-07 | 조각(원형)과 최종 캐릭터가 서로 연결되지 않음 | 조각 "암행어사" ↔ 결과 "소리꾼" 같은 불일치 가능 | C17, C18 |
| BUG-08 | 대시보드 합산은 같은 탭의 sessionStorage만 읽음 → `/admin`을 새 탭으로 열면 +0 | 시연 중 합산이 안 되는 것처럼 보일 수 있음(코드 기준 추론, 새 탭 실험은 안 함) | C27 |
| BUG-09 | 서버 경로에 `complete-all-stamps`가 없어 `USE_LOCAL_BACKEND=false`면 skip이 404 | 서버 전환 시 기능 차이 | C41 |
| BUG-10 | 타입 오류 12건, 테스트 4건 실패 | 빌드에는 영향 없음(Vercel 빌드는 `vite build`만 실행) | R01, R02 |
| BUG-11 | `features.ts` 주석의 "고정 10종 캐릭터"가 실제(1종)와 다름 | 문서·발표 오기 유발 | C01, C19 |
| BUG-12 | `MediaWallVideo`에 브라우저 기본 `controls`와 자체 소리 버튼이 함께 있음 | 소리 버튼이 두 곳 | C36 |

## 9. 실행한 명령과 결과
2.2의 R01~R09 참조. 실행 환경: Anthropic 클라우드 Linux 작업공간, 기기에서 HEAD 소스 파일을 복사해 실행(기기 자체에서 실행하지 않음). Production 대상 명령은 실행하지 못함(접속 차단).

## 10. 수정 전후 핵심 차이

| 주제 | 수정 전 | 수정 후 |
| --- | --- | --- |
| 진입 순서 | 흐름도: 튜토리얼 → 로그인 | 로그인 → 튜토리얼(오늘 숨김이면 생략) → 입력 |
| 스탬프 인증 | QR·위치 인증, 서버에서 거절 | QR(기본) 또는 GPS(보조), 모두 브라우저 내부 검증. 현장 증명 아님 |
| 결과 | 생년월일·방문 순서로 개인화 | 조각 텍스트만 입력값 기반, 최종 캐릭터는 무작위(현재 1종) |
| AI | 플래그를 켜면 다시 사용 | 서버 구축 없이는 불가 |
| 미디어월 | 결과를 전시 목록에 올림 | 동의 의사를 브라우저에 기록. 송출·표시 없음 |
| 저장 | localStorage에 개인정보 없음 | 전시 동의 시 이름 앞 6자 등 저장 |
| 대시보드 | 실시간 합산 | 가상 수치 + 같은 탭 기록 1건 |
| 커밋 | 일부 미커밋, 최근 10건 | HEAD `b9a5d020`, 2026-11-20 12건 |
| 배포 | 언급 없음 | Vercel 정적 배포 설정(파일 기준). Production 실물은 미검증 |

### 원문에서 삭제·이동한 내용과 이유
- PP 부록의 옛 커밋 10건과 "미커밋" 문단: 현재 상태와 달라 오해를 유발하므로 VERIFIED 문서에서 현재 이력으로 교체. 원문은 원본 파일에 그대로 보존.
- FS 4-7("결과 화면은 타입 검사까지만"): 이번 재검증으로 대체.
- FS의 Google `invalid_client` 원인 단정: 근거가 없어 "점검 항목"으로 이동.
