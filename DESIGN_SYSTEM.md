# 전생여지도 디자인 시스템 (DESIGN_SYSTEM.md)

> 새 UI(이름·생년월일 입력 폼, 로딩, 결과 모달·카드, 음성 플레이어 등)를 기존 화면과 같은 톤으로 만들기 위한 기준 문서다.
> 2026-11-25 `feat/ai-story-supabase` 브랜치의 실제 코드(`src/index.css`, `index.html`, `src/components/*`)를 읽고 작성했다.
> **공식 기준(Single Source of Truth)은 실제 코드에 구현된 사용자 화면 색**이다: `#8E3524`(Primary 배경) · `#FBF8F1`(Primary 글자·표면) · `#1C1917`(본문) · `#D8CEBE`(테두리), 그리고 칠교 일러스트 배색(4.2).
> 6색 팔레트 이미지(`#A35139`, `#EEE9DF` 등)는 **Legacy / 관리자·쿠폰함 전용 참고값**이다(2.4). 새 사용자 화면에는 쓰지 않는다.

---

## 0. 먼저 알아 둘 사실

| 항목 | 실제 코드 상태 |
|---|---|
| Tailwind | **v4** (`@tailwindcss/vite`). `tailwind.config.*` 파일과 `@theme` 블록이 **없다**. 색은 대부분 `bg-[#8E3524]`처럼 **임의값(arbitrary value) 클래스**로 직접 쓴다. |
| CSS 변수 | `src/index.css` `:root`에 정의돼 있지만, 컴포넌트에서 실제로 쓰는 것은 `var(--coupon-primary)`(쿠폰함, 13곳)와 폰트 변수뿐이다. `--bg-hanji`, `--ink-primary` 같은 변수는 `html` 기본값에만 쓰인다. |
| 공식 Primary | 사용자 화면 전체의 Primary는 **`#8E3524` 배경 + `#FBF8F1` 글자**로 확정이다(`시작하기`, 로그인, 다음, 재생 버튼 등). |
| 6색 팔레트 | 관리자 화면(AdminDashboard·AdminOpsTools)과 쿠폰함(`--coupon-primary`)에서만 쓰는 **Legacy 참고값**이다. 사용자 화면에는 하단 탭 잠금 배지·탭 테두리·날짜 선택기 글자처럼 이미 들어간 몇 곳만 남아 있다(2.4). |
| 서체 | 명조(세리프) 서체는 **쓰지 않는다**. `.font-serif-kr`는 이름만 남은 호환 클래스이며 실제로는 고딕(Pretendard)이다. 붓글씨는 로고에만 쓴다. |
| 다크 모드 | 사용자 화면에는 **다크 모드가 없다**. 어두운 한지 배경(`.hanji-texture-dark`, `#15120E`)은 미디어월 전용이다. |
| 조각 일러스트 | 코드 안 이름은 **칠교(Tangram) SVG**(`TangramClueBoard.tsx`)다. 이 문서에서 말하는 '조각보'는 이 면 분할 일러스트를 가리킨다. |
| 2×2 교차점 장식 | 문자 `✦`가 아니라 **4잎 꽃매듭 SVG**(`CenterRosetteOrnament`)다. |

---

## 1. 브랜드 컨셉과 무드

- **핵심 컨셉**: 전통 한지의 온기와 조선 기록화·조각보 미학을, 모바일 웹 인터랙션으로 다시 풀어낸 디지털 문화유산 투어.
- **시각 키워드**: 한지 섬유 질감 · 수묵담채의 여백 · 단청과 천연염색 색감(주황빛 적토·쪽빛·황토) · 면 분할 기하 · 단아한 절제.
- **말투**: 사극체 안내 문구를 쓴다. 예: "어서 오시게, 전생을 찾으러 왔는가?", "전생 기록을 펼치는 중이옵니다…", "신원을 밝혀 주시게."
- **표현 원칙**
  - 장식은 **얇은 선(1px 안팎)과 낮은 불투명도**로만 쓴다. 굵은 그림자나 진한 그라데이션은 쓰지 않는다.
  - 화면의 주인공은 한지 바탕 위의 콘텐츠다. 소나무·산수·창살은 가장자리로 물러나 있다.
  - 모바일 우선으로 만든다(`max-w-md`/`max-w-lg` 한 열). 데스크톱에서만 2열·2×2로 넓힌다.

---

## 2. 컬러 시스템

### 2.1 공식 컬러 기준 (사용자 화면 — Single Source of Truth)

적용 범위: 랜딩, 로그인, 지도·조각 수집, 맞춤형 전생 입력·로딩·결과, 오디오 플레이어 등 **모든 사용자 화면**.

| 시맨틱 역할 | Hex | Tailwind 예시 | 대표 사용처 |
|---|---|---|---|
| **Primary Action (배경)** | **`#8E3524`** | `bg-[#8E3524]` | 시작하기·로그인·다음·재생 버튼, 진행 바, 선택된 날짜 |
| **Primary On (글자)** | **`#FBF8F1`** | `text-[#FBF8F1]` | Primary 버튼 위 글자 |
| Primary Hover | `#762A1C` | `hover:bg-[#762A1C]` | Primary 버튼 hover |
| Accent (인주·낙관) | `#9A3412` | `text-[#9A3412]`, `border-[#9A3412]` | 활성 탭, 포커스 링, 조각 값 테두리, 체크박스 |
| **Text Primary** | **`#1C1917`** / `#26201B` | `text-[#1C1917]` | 본문·헤딩 (`#26201B`는 모달·결과 화면 헤딩) |
| Text Secondary | `#5C5349` / `#57534E` | `text-[#5C5349]` | 보조 설명, 시간 표시 |
| Text Muted | `#78716C` | `text-[#78716C]` | 한자 부제, 힌트, `자세히 보기` (`#FBF8F1` 위 4.52:1, 작은 글자 하한선) |
| Text Body (카드 안) | `#44403C` | `text-[#44403C]` | "입니다" 같은 서술 |
| Text Spot Label | `#6E5940` | `text-[#6E5940]` | 거점 라벨 |
| Background (한지) | `#FAF5E8` | `.hanji-texture` | 전체 페이지 바탕 |
| **Surface (밝은 카드)** | **`#FBF8F1`** / `#FBF8F2` | `bg-[#FBF8F1]` | 모달, 헤더, 하단 탭, 입력 배경 |
| Surface (흰 카드) | `#FFFFFF` | `bg-white` | 입력 폼 카드, 결과 '설정' 카드, 음성 플레이어 |
| Surface Subtle | `#F3ECE0` / `#F5EFE6` | `bg-[#F3ECE0]` | 입력칸 배경, hover 바탕, 인용 박스 |
| **Border Default** | **`#D8CEBE`** | `border-[#D8CEBE]` | 카드·모달·헤더 테두리, 진행 바 트랙 |
| Border Input | `#D6CBB9` / `#D6CEBE` | `border-[#D6CBB9]` | 입력칸, 날짜 선택 select |
| Border Hairline | `#E5DDD0` | `border-[#E5DDD0]` | 폼 카드, 구분선(`hr`) |
| Status Error | `#B91C1C` | `text-[#B91C1C]` | 폼 오류 문구 |
| Status Warning | 배경 `#FFF8EC` + 테두리 `#E3C9A8` + 글자 `#7A2E1F` | — | AI 생성 실패 안내 |
| Status Success | `#14532D`, `#16A34A` | — | 방문 인증 완료 등 |
| Overlay | `#26201B` 45% | `bg-[#26201B]/45 backdrop-blur-sm` | 모달 뒤 배경 |
| Dark Section | `#292524` + 글자 `#F5EFE6` | — | 결과 '인생 마무리' 카드 |

주요 조합의 대비(직접 계산): `#FBF8F1`/`#8E3524` 7.37:1 · `#1C1917`/`#FBF8F1` 16.49:1 · `#5C5349`/`#FBF8F1` 7.10:1 · `#9A3412`/`#FFFDF8` 7.19:1 · `#78716C`/`#FBF8F1` 4.52:1.

### 2.2 칠교 일러스트 배색 (공식 기준)

그림(일러스트)과 장식용 포인트 색이다. 비율과 쓰임은 4.2에 있다.

| 계열 | 대표 Hex | 용도 |
|---|---|---|
| 쪽빛 | `#344B68` (주), `#2B3E57`, `#2E425D`, `#425D80` | 일러스트 주조색, 쪽빛 배지 포인트 |
| 적토 | `#A94731` (주), `#B54E35`, `#B64E36` | 일러스트 주조색, 적토 배지 포인트 |
| 황토 | `#D98F2E`, `#DF9632`, `#E19C3A` | 획득 조각·작은 포인트 |
| 녹 | `#53684B`, `#54694B` | 기존 일러스트 안에서만 |
| 먹갈색 | `#4B3E35`, `#4C4037`, `#363433` | 기둥·윤곽 |
| 미색 줄눈 | `#F8F1E1` (seam), `#EFE0C4`, `#DFCEAC` | 조각 사이 이음선, 밝은 면 |

### 2.3 새 UI 색 규칙

1. 새 사용자 화면 UI는 **2.1과 2.2의 값만** 쓴다.
2. 버튼·링크·포커스 같은 상호작용 색은 2.1에서만 고른다. 칠교 배색(2.2)은 배지 포인트와 그림에만 쓴다.
3. 칠교 배색을 글자색으로 쓸 때는 대비를 확인한다. 쪽빛 `#344B68`(`#FBF8F1` 위 8.42:1)과 적토 `#A94731`(5.45:1)은 글자로 쓸 수 있다. 황토·녹은 글자로 쓰지 않는다.
4. 라이트 조합만 쓴다. 다크 바탕은 결과의 '인생 마무리' 카드(`#292524`)와 미디어월에만 있다.

### 2.4 Legacy / 관리자·쿠폰함 전용 참고값 (6색 팔레트)

> **새 사용자 화면 UI에 쓰지 않는다.** 관리자 화면과 쿠폰함을 손볼 때만 참고한다.

| 이름 | Hex | 팔레트 표기 대비 | 현재 사용처 |
|---|---|---|---|
| Palladian | `#EEE9DF` | 17.36:1 (검정 대비) | 관리자 배경, 하단 탭 잠금 배지 글자 |
| Oatmeal | `#C9C1B1` | 11.75:1 (검정 대비) | 관리자 구분선, 하단 탭 상단 테두리 |
| Truffle Trouble | `#A35139` | 5.54:1 (흰색 대비) | 쿠폰함 `--coupon-primary`, 하단 탭 잠금 배지, 관리자 강조 |
| Burning Flame | `#FFB162` | 11.72:1 (검정 대비) | 관리자 일부 |
| Blue Fantastic | `#2C3B4D` | 11.41:1 (흰색 대비) | 관리자 글자·표면 |
| Abyssal Anchorfish Blue | `#1B2632` | 15.33:1 (흰색 대비) | 관리자 글자, 날짜 선택기 글자 |

- 팔레트에 적힌 대비는 6색끼리가 아니라 밝은 색은 검정, 어두운 색은 흰색과 비교한 값이다.
- 사용자 화면에 이미 들어가 있는 Legacy 값(하단 탭 테두리 `#C9C1B1`, 잠금 배지 `#A35139`/`#EEE9DF`, 날짜 선택기 글자 `#1B2632`)은 **현재 구현 그대로 두되**, 새 UI에서 따라 쓰지 않는다. 바꿀지는 따로 정한다.
- 쿠폰함은 계속 `var(--coupon-primary)`(`#A35139`)를 쓴다.

### 2.5 시맨틱 토큰 (선택 사항, 아직 코드에 없음)

임의값 클래스를 줄이고 싶을 때 `src/index.css`에 아래처럼 `@theme`을 추가할 수 있다. **현재 코드에는 없다.** 추가하면 `bg-brand-primary`처럼 쓸 수 있다.

```css
@theme {
  --color-brand-primary: #8E3524;
  --color-brand-on-primary: #FBF8F1;
  --color-brand-primary-hover: #762A1C;
  --color-brand-seal: #9A3412;
  --color-ink: #1C1917;
  --color-ink-secondary: #5C5349;
  --color-ink-muted: #78716C;
  --color-hanji: #FAF5E8;
  --color-hanji-surface: #FBF8F1;
  --color-hanji-subtle: #F3ECE0;
  --color-line: #D8CEBE;
  --color-line-input: #D6CBB9;
  --color-chilgyo-indigo: #344B68;
  --color-chilgyo-terracotta: #A94731;
  --color-chilgyo-ochre: #D98F2E;
}
```

---

## 3. 타이포그래피

### 3.1 서체 (실제 코드)

| 변수·클래스 | 실제 서체 | 불러오는 곳 | 용도 |
|---|---|---|---|
| `--font-ui` (기본, `html`/`body`) | `'Pretendard Variable', 'Pretendard', 'Noto Sans KR', system-ui, …` | `index.html` (Pretendard CDN, Noto Sans KR Google Fonts) | 모든 화면 |
| `.font-logo` / `--font-logo` | `'SangSangRock'` (붓글씨) | `index.css` `@font-face` (jsDelivr) | **로고 `전생여지도`에만** |
| `.font-serif-kr` | `--font-ui`와 같음 (고딕) | — | 호환용 이름. 헤딩에 습관적으로 붙어 있음 |
| `.font-mono-tabular` | `--font-ui` + `tabular-nums` | — | 숫자(시간·도장 수·바코드) |

- 루트 글자 크기는 `clamp(14px, calc(13px + 0.25vw), 16px)`로 화면 너비에 따라 바뀐다.
- `body`에는 `word-break: keep-all`이 걸려 있다. 한국어 단어가 중간에서 끊기지 않으므로 새 컴포넌트에서 따로 지정하지 않는다.

### 3.2 위계 (실제 클래스)

| 단계 | 예시 문구 | 실제 클래스 |
|---|---|---|
| 브랜드 타이틀 | `전생여지도` | `font-logo text-[clamp(1.25rem,3.5vw,1.875rem)] font-bold tracking-tight text-[#1C1917]` |
| 한자 부제 | `前生輿地圖` | `text-xs tracking-widest text-[#78716C]` |
| 훅 문구 | "어서 오시게, 전생을 찾으러 왔는가?" | `font-serif-kr text-xl sm:text-2xl font-semibold text-[#1C1917] leading-relaxed` |
| 조각 질문 헤딩 | `당신의 시대는` | `font-serif-kr text-[21px] sm:text-[26px] font-bold text-[#1C1917] leading-tight`. 밑에 붓 하이라이트 `h-2.5 rounded-full bg-[#E8D7B9]/85`를 깐다 |
| 결과 타이틀 | `📚 과거 낙방 9수생` | `font-serif-kr text-[clamp(1.25rem,3.5vw,1.875rem)] font-bold text-[#26201B] leading-snug` |
| 모달 제목 | 로그인 모달 | `font-serif-kr text-[clamp(1rem,2.4vw,1.25rem)] font-bold text-[#26201B]` |
| 폼 라벨 | `이름`, `생년월일` | `block font-serif-kr text-lg font-bold text-[#1C1917]` |
| 섹션 카드 제목 | `📜 설정` | `font-serif-kr text-base font-bold text-[#26201B]` |
| 조각 값 | `감영 관리 (監營 官吏)` | `font-serif-kr text-sm sm:text-base font-bold text-[#9A3412]` |
| 거점 라벨 | `경기전` | `text-xs sm:text-sm font-semibold text-[#6E5940]` + `MapPin w-3.5 h-3.5 text-[#7A6348]` |
| 서술 보조 | `입니다` | `text-sm sm:text-base text-[#44403C]` |
| 텍스트 링크 | `자세히 보기` | `text-xs text-[#78716C] underline underline-offset-2` |
| 상단 유틸 | `미디어월`, `운영 현황` | `text-xs text-[#78716C] hover:text-[#9A3412]` |
| 힌트·캡션 | 입력 도움말 | `text-xs text-[#78716C]` |
| 메타(11px) | 시간, 배지 | `text-[11px] text-[#5C5349]` |

---

## 4. 전통 그래픽과 일러스트 규칙

### 4.1 배경과 프레임 (실제 구현)

| 요소 | 구현 위치 | 규칙 |
|---|---|---|
| 한지 질감 | `.hanji-texture` (`index.css`) | 바탕 `#FAF5E8`. `::before`에 한지 이미지 2장(`/assets/aistudio/image_39db9218.png`, `image_52689d27.png`)과 방사형 그라데이션을 `multiply`로 겹친다. `position: fixed`라 스크롤해도 바탕은 움직이지 않는다. **새 화면 최상위에 이 클래스를 붙인다.** |
| 이중 테두리 프레임 | `SceneStartBackdrop` | 바깥 `border border-[#B7A282]/75`, 안쪽 `inset-1.5 border border-[#C9B698]/55`. 1px 두 줄 |
| 모서리 창살 | `SceneStartBackdrop` (`text-[#9C8362]/75`), `TangramClueBoard` `CornerLatticeOrnament` (`text-[#C7B693]/85`) | 완자살 귀틀 SVG, `w-7~w-10`, stroke 1.35. 네 모서리는 `-scale-x-100`/`-scale-y-100`으로 뒤집어 재사용 |
| 수묵 소나무 | `SceneStartBackdrop` 좌상단 | 먹색 `#5D554B`~`#7D7469` 가지와 솔잎 다발. `mix-blend-multiply opacity-85~90`, 불투명도 0.42~0.82로 층을 나눈다 |
| 산수·정자 | `SceneStartBackdrop` 하단 | `h-44 sm:h-60 lg:h-72`, `mix-blend-multiply opacity-90`. 정자는 opacity 0.72 |
| 노리개 | `InteractiveNorigae` 우상단 | `w-16 sm:w-20 lg:w-24`. 분홍 `#F0B7B3`, 적 `#B54935`·`#C85360`, 녹 `#7D9B76`. 끌어서 흔들 수 있다 |
| 2×2 교차 장식 | `CenterRosetteOrnament` | `w-10 h-10 rounded-full bg-[#F9F3E4]` 원 안에 4잎 꽃매듭(stroke `#B79D6B`, fill `#EFE4CA`). **데스크톱(`md:`)에서만** 보인다 |
| 칸 배경 풍경 | `QuadrantScenery` | `opacity-35`, 선 `#8E7757`·`#8C785B`, 면 `#B6A488`·`#EFE5CE`. 구름·성곽·궁궐 실루엣 |

### 4.2 조각보(면 분할) 일러스트

실제 구현은 `TangramClueBoard.tsx`의 `TangramFigure`다.

- **기법**
  - `viewBox="0 0 260 200"`의 `polygon`과 `rect` 면으로만 구성한다. 곡선은 쓰지 않는다.
  - 면 사이 이음선은 `seam = '#F8F1E1'`, `strokeWidth 2.1~2.2`, `strokeLinejoin="round"`. 한지색 줄눈이 조각을 나누는 효과다.
  - 전체에 `drop-shadow-xs`만 쓴다.
- **실제 배색 비율** (조각 면 62개 기준으로 직접 셈)

| 색 계열 | 대표 Hex | 비율 | 비고 |
|---|---|---|---|
| 쪽빛 | `#344B68`, `#2B3E57`, `#2E425D`, `#425D80` | 약 29% | 주조색 |
| 적토 | `#A94731`, `#B54E35`, `#B64E36` | 약 26% | 주조색 |
| 황토 | `#D98F2E`, `#DF9632`, `#E19C3A` | 약 15% | 포인트 |
| 녹 | `#53684B`, `#54694B` | 약 13% | 기존 일러스트에만 |
| 먹갈색 | `#4B3E35`, `#4C4037`, `#363433` | 약 13% | 윤곽·기둥 |
| 미색 | `#EFE0C4`, `#DFCEAC`, `#F8F1E1` | 약 5% | 밝은 면·줄눈 |

- **잠긴 상태**
  - 핵심 조각을 `fill="#FBF5E8"`, `stroke="#9D8160"`, `strokeDasharray="4 3"`으로 그리고 가운데에 `?`(`#6E5940`, 21px, 700)를 둔다.
  - 획득하면 그 조각을 황토 `#D97706`으로 채운다.
- **새 일러스트(소지품 등) 규칙**
  - 위 표의 비율을 따른다. 쪽빛과 적토를 주조로 하고, 황토는 포인트로만 쓴다.
  - 새 녹색 계열은 추가하지 않는다.

### 4.3 AI 맞춤 전생 초상화를 기존 UI에 넣는 규칙

현재 결과 화면의 캐릭터 이미지 틀(`SceneResult.tsx`)을 그대로 쓴다.

```tsx
<div className="relative w-full max-w-[270px] sm:max-w-[310px] aspect-[9/16] mx-auto rounded-2xl overflow-hidden border border-[#D8CEBE] bg-[#F3ECE0] shadow-md">
  <img className="w-full h-full object-contain object-center block" … />
</div>
```

- **비율**: 9:16 세로 고정. 이미지가 틀을 꽉 채우지 못하면 `object-contain`으로 두고, 남는 여백은 `bg-[#F3ECE0]`이 한지처럼 채운다. 잘라 내지 않는다.
- **생성 지시 기준**
  - 바탕은 미색 한지(`#FBF8F1`~`#F3ECE0`) 계열로 요청한다.
  - 기존 캐릭터 그림처럼 수묵담채 질감, 차분한 채도를 따른다.
  - 순백(#FFFFFF) 스튜디오 배경, 형광·네온, 사진풍 고대비 조명은 피한다.
- **테두리**: `border-[#D8CEBE]` 1px + `rounded-2xl`. 금박 프레임이나 두꺼운 테두리를 새로 만들지 않는다. 더 장식하고 싶다면 위 4.1의 모서리 창살을 `absolute`로 얹는 정도까지만 한다.
- **그림자**: `shadow-md`가 이 화면의 최대치다. 그 위로 쌓지 않는다.
- **로딩 중 자리**
  - 같은 틀 안을 `bg-[#F3ECE0]`로 비워 두고, 가운데에 `Loader2`(`text-[#8E3524] animate-spin`)와 사극체 문구를 둔다.
  - 스켈레톤을 쓴다면 `animate-pulse bg-[#E9E1D3]` 정도로 옅게 한다.

---

## 5. 핵심 컴포넌트 스펙

### 5.1 Primary Button (실제: `시작하기`, 로그인, 다음)

```tsx
<button className="w-full min-h-[52px] px-6 py-3.5 rounded-xl bg-[#8E3524] text-[#FBF8F1] font-semibold text-base hover:bg-[#762A1C] active:scale-[0.99] shadow-sm disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
  시작하기
</button>
```

- 높이 52px, 둥글기 `rounded-xl`(12px), 그림자는 `shadow-sm`까지만.
- `hover-scale` 클래스(데스크톱에서 hover 시 1.1배 확대)는 `시작하기`와 로그인 모달 제출 버튼에만 붙어 있다. 다른 버튼에는 붙이지 않는다.
- **로딩 상태**: `disabled` + `Loader2 w-4 h-4 animate-spin` + 문구 교체(예: `새 이야기를 쓰는 중…`). 실제 예는 `SceneResult` '다른 이야기 만들기' 버튼.
- 보조 크기(결과 하단): `min-h-[48px] px-5 py-3 text-sm`.
- 알약형 작은 버튼(재시도 등): `min-h-[40px] rounded-full bg-[#8E3524] hover:bg-[#762A1C] px-4 text-xs font-semibold text-white`.

### 5.2 Secondary / Outlined Button

```tsx
// 강조 외곽선 (다른 이야기 만들기)
"w-full min-h-[52px] px-6 py-3.5 rounded-xl border-2 border-[#8E3524] text-[#8E3524] bg-white font-semibold text-base hover:bg-[#8E3524]/5"
// 차분한 보조 (취소·다시 하기)
"w-full min-h-[48px] px-5 py-3 rounded-xl border border-[#C4B8A3] bg-[#FBF8F1] hover:bg-[#F3ECE0] text-sm font-semibold text-[#26201B]"
// 텍스트 버튼 (기록 복구 등)
"min-h-[40px] px-2 text-sm font-medium text-[#5C5349] hover:text-[#8E3524] underline underline-offset-4"
```

### 5.3 Outlined Info Card

**조각 결과판** (`TangramClueBoard`)

```tsx
<div className="relative rounded-2xl border border-[#D4C7AE] bg-[#FBF6EA]/95 shadow-sm overflow-hidden">
  {/* 안쪽 머리카락 테두리 */}
  <div className="pointer-events-none absolute inset-2 rounded-xl border border-[#E5DAC2]/80" />
  {/* 네 모서리 창살 + 중앙 꽃매듭 */}
</div>
```

**조각 값 칩** ("감영 관리 (監營 官吏)" 박스)

```tsx
<span className="inline-block px-3 py-1.5 rounded-xl border border-[#9A3412]/45 bg-[#FFFDF8]/95 font-serif-kr text-sm sm:text-base font-bold text-[#9A3412] shadow-2xs">…</span>
```

**일반 섹션 카드** (결과 화면 `SectionCard`)

```tsx
<section className="text-left rounded-2xl border border-[#D8CEBE] bg-white p-5 space-y-3 shadow-xs">
  <h3 className="font-serif-kr text-base font-bold text-[#26201B]">📜 설정</h3>
</section>
```

카드 변형 (실제 결과 화면):

| 변형 | 클래스 |
|---|---|
| 흰 카드 | `bg-white` |
| 한지 카드 | `bg-[#FBF8F1]` |
| 대화 상자(점선) | `rounded-xl border border-dashed border-[#C7B596] bg-white/70 px-4 py-4` |
| 두루마리 결과판 | 바깥 `rounded-2xl p-1.5 bg-[#EBDDBE] border border-[#C7B596]`, 안쪽 `rounded-xl border border-[#B89B6A]/60 bg-[#F8F0DC] px-5 py-5` |
| 어두운 마무리 카드 | `rounded-2xl bg-[#292524] text-[#F5EFE6] p-6 shadow-md` |
| 입력 폼 카드 | `bg-white border border-[#E5DDD0] rounded-2xl p-6 sm:p-8 shadow-sm` |

- **규칙**: 테두리는 항상 1px. 둥글기는 컨테이너 `rounded-2xl`(16px), 안쪽 요소 `rounded-xl`(12px). 그림자는 `shadow-2xs`~`shadow-sm`. 모달만 `shadow-xl`/`shadow-2xl`을 쓴다.

### 5.4 Location / Category Badge

**거점 라벨 (실제)**: 테두리 없이 핀 아이콘과 글자만 쓴다.

```tsx
<div className="flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#6E5940]">
  <MapPin className="w-3.5 h-3.5 shrink-0 text-[#7A6348]" /> <span>경기전</span>
</div>
```

**라벨 칩 (실제, 결과판 `직업`·`평판`·`업적`)**

```tsx
<dt className="inline-block rounded bg-[#8E3524] px-2 py-0.5 text-[11px] font-bold tracking-widest text-white">직업</dt>
```

**신규 배지 제안** (아직 코드에 없음. 공식 컬러 2.1·2.2만 사용)

```tsx
// 전생 유형 (story_categories.name) — 칠교 쪽빛 외곽선, 한지 표면
<span className="inline-flex items-center gap-1 rounded-full border border-[#344B68]/45 bg-[#FBF8F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#344B68]">개척형</span>

// 12간지 (zodiac_name) — 칠교 적토 점 + 기본 테두리, 본문색 글자
<span className="inline-flex items-center gap-1.5 rounded-full border border-[#D8CEBE] bg-[#FBF8F1] px-2.5 py-0.5 text-[11px] font-semibold text-[#1C1917]">
  <span className="w-1.5 h-1.5 rounded-full bg-[#A94731]" aria-hidden="true" />말
</span>

// 강조형 (결과 화면 상단 등 한 곳에만) — Primary 채움
<span className="inline-flex items-center rounded-full bg-[#8E3524] px-2.5 py-0.5 text-[11px] font-semibold text-[#FBF8F1]">개척형</span>
```

- 한 화면에서 채움형(`bg-[#8E3524]`)은 하나만 쓴다. 나머지는 외곽선형으로 둔다.
- 배지 글자는 DB의 `story_categories.name`, `zodiac_name` 값을 그대로 표시한다. 코드나 이름을 화면에서 새로 만들지 않는다.
- 띠 배지에는 이름만 쓴다. "○○띠라서 ~한 성격" 같은 해설은 배지에도 본문에도 넣지 않는다(서비스 원칙).
- 잠금 배지 (실제, 하단 탭, Legacy 값 유지): `w-3.5 h-3.5 rounded-full bg-[#A35139] text-[#EEE9DF]` + `Lock w-2 h-2`. 새 배지에 이 색을 따라 쓰지 않는다.

### 5.5 Grid & Divider System

| 요소 | 실제 클래스 |
|---|---|
| 2×2 조각판 | `grid grid-cols-1 md:grid-cols-2`. 칸 사이 `border-[#DFD4BC]`(세로 `md:border-r`, 가로 `border-b`). 칸 크기 `min-h-[196px] sm:min-h-[248px] px-5 py-6 sm:px-7 sm:py-7`, hover `bg-[#F5ECD7]/65` |
| 상단 체험 헤더 | `sticky top-0 z-30 border-b border-[#D8CEBE] bg-[#FBF8F1]/95 backdrop-blur-md`, 안쪽 `max-w-5xl px-4 sm:px-6 min-h-14` |
| 시작 화면 유틸 내비 | `px-4 sm:px-6 pt-3 flex justify-end gap-4 text-xs text-[#78716C]`, 각 항목 `min-h-[36px]` |
| 하단 탭 바 | `fixed bottom-0 z-40 border-t border-[#C9C1B1] bg-[#FBF8F2]/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom)]`, `grid grid-cols-4 min-h-[58px]` |
| 탭 상태 | 활성 `border-t-2 border-[#9A3412] text-[#9A3412] font-bold`, 비활성 `border-transparent text-[#57534E] font-medium hover:text-[#1C1917]` |
| 구분선 | `hr border-[#E5DDD0]`, 또는 `flex-1 h-px bg-[#E5DDD0]`(가운데 글자 있는 구분선) |
| 모달 오버레이 | `fixed inset-0 z-50 bg-[#26201B]/45 backdrop-blur-sm` |
| 모달 본체 | `w-[calc(100vw-2rem)] max-w-[430px] rounded-2xl border border-[#D8CEBE] ring-1 ring-inset ring-[#E6DEC8] bg-[#FBF8F1] p-6 shadow-2xl space-y-5` |
| 모달 닫기 | `absolute top-3 right-3 w-9 h-9 rounded-full text-[#5C5349] hover:bg-[#F5EFE6]` + `X w-5 h-5` |
| z-index | 헤더 30 · 하단 탭 40 · 모달·팝오버 50 |

### 5.6 음성 플레이어 (실제 `VoicePlayer`. 새 플레이어도 이 모양을 따른다)

```tsx
<div className="rounded-2xl border border-[#D8CEBE] bg-white p-4 space-y-3 text-left">
  <div className="flex items-center gap-3">
    {/* 재생/일시정지 */}
    <button className="w-12 h-12 shrink-0 rounded-full bg-[#8E3524] hover:bg-[#762A1C] text-white flex items-center justify-center" aria-label="재생">
      <Play className="w-5 h-5 translate-x-px" />  {/* 재생 중에는 <Pause className="w-5 h-5" /> */}
    </button>
    <div className="flex-1 min-w-0 space-y-1.5">
      {/* 진행 바 */}
      <div className="h-1.5 rounded-full bg-[#D8CEBE] overflow-hidden" role="progressbar" aria-label="재생 진행률">
        <div className="h-full bg-[#8E3524] transition-[width] duration-150" style={{ width: `${progress}%` }} />
      </div>
      <div className="flex justify-between text-[11px] text-[#5C5349] font-mono-tabular"><span>0:00</span><span>0:05</span></div>
    </div>
    {/* 다시 듣기 */}
    <button className="min-h-[44px] shrink-0 inline-flex items-center gap-1 rounded-full border border-[#D6CBB9] px-3 text-xs font-semibold text-[#5C5349] hover:bg-[#F5EFE6]">
      <RotateCcw className="w-3.5 h-3.5" /> 다시 듣기
    </button>
  </div>
  {/* 대사 인용 */}
  <blockquote className="rounded-xl bg-[#F5EFE6] border-l-4 border-[#8E3524] px-4 py-3">
    <p className="flex items-start gap-2 font-serif-kr text-sm font-semibold text-[#26201B] leading-relaxed">
      <Volume2 className="w-4 h-4 mt-0.5 shrink-0 text-[#8E3524]" /> <span>“대사”</span>
    </p>
  </blockquote>
</div>
```

- 아이콘은 `lucide-react`를 쓴다(Play, Pause, RotateCcw, Volume2, Loader2, MapPin, Lock, X 등).
- 재생 버튼은 48px 원형, 진행 바는 6px(`h-1.5`) 두께다. 웨이브폼이나 네온 이퀄라이저는 쓰지 않는다.

### 5.7 입력 폼 (실제 `SceneInputConsent`, `LoginModal`, `KoreanDatePicker`)

```tsx
// 라벨
<label className="block font-serif-kr text-lg font-bold text-[#1C1917]">이름</label>
// 텍스트 입력 (체험 입력 화면)
<input className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border border-[#D6CEBE] bg-[#FBF8F2] text-base text-[#1C1917] focus:border-[#9A3412] focus:bg-white transition-colors" />
// 텍스트 입력 (로그인 모달 INPUT_CLASS)
"w-full min-h-[48px] px-4 py-3 rounded-xl border border-[#D6CBB9] bg-[#F3ECE0] text-base text-[#26201B] placeholder:text-[#A8A29E] focus:outline-none focus:border-[#8E3524] focus:ring-2 focus:ring-[#8E3524]/20 disabled:opacity-60"
// 도움말
<p className="text-xs text-[#78716C]">…</p>
// 오류
<p role="alert" className="text-xs text-[#B91C1C] leading-relaxed">…</p>
```

- **생년월일**: 기존 `KoreanDatePicker`를 다시 쓴다. 새 달력을 만들지 않는다.
  - 팝오버: `rounded-2xl border border-[#D8CEBE] ring-1 ring-inset ring-[#E6DEC8] bg-[#FBF8F1] p-3 shadow-xl`
  - 연·월 select: `rounded-lg border border-[#D6CBB9] bg-[#F3ECE0] text-sm font-semibold text-[#1B2632]`
  - 날짜 칸: `w-9 h-9 rounded-full`. 선택일 `#8E3524` 배경 + `#FBF8F1`, 일요일 글자 `#8E3524`, 오늘 `1px solid #1B2632`.
- **체크 항목**: `CheckSquare`(`#9A3412`) / `Square`(`#78716C`) + `min-h-[44px] rounded-xl hover:bg-[#FBF8F2]` 행.
- **탭 전환(세그먼트)**: 바탕 `rounded-xl bg-[#F0EAE0] p-1`. 활성 `bg-[#8E3524] text-[#FBF8F1] shadow-sm`, 비활성 `text-[#5C5349] hover:bg-[#F5EFE6]`.
- **포커스**: 전역 `:focus-visible { outline: 2px solid #9A3412; outline-offset: 2px }`가 이미 있다. 새 컴포넌트에서 `outline-none`만 주고 대체 표시를 빼먹지 않는다.

### 5.8 로딩·상태 안내 (실제 `SceneResult` `AiStoryStatus`)

```tsx
// 진행 중
<p role="status" aria-live="polite" className="rounded-xl border border-[#D8CEBE] bg-[#FBF8F1] px-4 py-3 text-sm text-[#5C5349] inline-flex items-center gap-2 w-full">
  <Loader2 className="w-4 h-4 animate-spin text-[#8E3524]" /> 새 이야기를 쓰는 중이옵니다… 잠시만 기다려 주세요.
</p>
// 실패·대체 안내
<div role="alert" className="rounded-xl border border-[#E3C9A8] bg-[#FFF8EC] px-4 py-3 space-y-2 text-left">
  <p className="text-sm font-semibold text-[#7A2E1F]">새 이야기를 만들지 못했습니다. …</p>
  <p className="text-xs text-[#5C5349]">오류 설명</p>
</div>
```

### 5.9 공통 치수

| 항목 | 값 |
|---|---|
| 최소 터치 영역 | 44px (`min-h-[44px]`). 주요 버튼 52px, 입력칸 48px |
| 둥글기 | 컨테이너 16px(`rounded-2xl`) · 버튼·입력·칩 12px(`rounded-xl`) · 작은 라벨 4px(`rounded`) · 원형 아이콘 `rounded-full` |
| 테두리 | 1px 기본. 외곽선 버튼만 2px, 인용 박스 왼쪽 4px |
| 화면 폭 | 체험 단일 열 `max-w-md sm:max-w-lg`, 헤더·탭 `max-w-5xl`, 모달 `max-w-[430px]` |
| 최소 폭 | 320px (`html`, `body`, `#root`) |
| 안전 영역 | `.safe-pb`, `.safe-pt`, `pb-[env(safe-area-inset-bottom)]` |
| 애니메이션 | `.fade-up`(0.8s, 첫 화면), `.animate-scroll-unfurl`(620ms, 두루마리 펼침), `.animate-seal-slam`(420ms, 완료 낙관). 모두 `prefers-reduced-motion`에서 꺼진다 |

---

## 6. 금지 사항 (Anti-patterns)

1. **원색·네온 금지**
   - `#FF0000`, `#00FF00`, 형광 핑크·청록, Tailwind 기본 `blue-500`·`purple-*` 같은 차가운 원색을 쓰지 않는다.
   - 예외는 소셜 로그인 버튼의 브랜드색(카카오 `#FEE500`, 네이버 `#03C75A`)뿐이다.
2. **두꺼운 그림자 금지**
   - 일반 카드는 `shadow-sm`까지만 쓴다. 모달만 `shadow-xl`/`shadow-2xl`을 쓴다.
   - 입체감은 1px 선, 안쪽 머리카락 테두리, 한지 질감으로 낸다.
3. **진한 그라데이션 배경 금지**: 두 가지 원색을 섞는 화면 배경을 쓰지 않는다. 그라데이션은 달항아리 유약처럼 미색 안에서의 아주 작은 명도 변화만 허용한다.
4. **순백·순흑 바탕 금지**
   - 페이지 바탕은 `.hanji-texture`를 쓴다.
   - 흰색(`bg-white`)은 카드 안쪽 표면에만 쓴다.
   - 글자에 `#000000`을 쓰지 않는다(`#1C1917`/`#26201B` 사용).
5. **명조·손글씨 서체 남용 금지**
   - 붓글씨(`font-logo`)는 로고에만 쓴다.
   - 새 웹폰트를 추가하지 않는다.
6. **테두리 두께 금지**: 2px 이상 테두리는 외곽선 버튼과 활성 탭 상단선에만 쓴다.
7. **Legacy 6색을 새 사용자 화면에 쓰지 않는다**: `#A35139`, `#EEE9DF`, `#C9C1B1`, `#FFB162`, `#2C3B4D`, `#1B2632`는 관리자 화면·쿠폰함 전용이다(2.4). 특히 Primary를 `#A35139`로 바꾸지 않는다.
8. **장식이 콘텐츠를 덮는 것 금지**
   - 소나무·산수·창살·풍경은 `pointer-events-none`, 낮은 불투명도로 둔다.
   - 소나무·산수는 `mix-blend-multiply`로 겹친다.
9. **12간지 성격 해설 금지**: 배지·카드·로딩 문구에 "○○띠라서 ~한 성격", 운세·길흉 표현을 넣지 않는다.
10. **기존 자산 변형 금지**: 캐릭터 이미지·음성, 상품 이미지를 다시 칠하거나 잘라 쓰지 않는다. 틀은 4.3 규칙을 따른다.
11. **새 색을 임의로 만들지 않는다**: 이 문서 2.1(공식 컬러)과 2.2(칠교 배색)에 없는 색이 필요하면 먼저 문서에 추가하고 쓴다.

---

## 7. 새 UI를 만들 때 체크리스트

- [ ] 최상위에 `hanji-texture`(또는 기존 화면 셸)를 썼는가
- [ ] 주요 버튼이 `bg-[#8E3524] text-[#FBF8F1] rounded-xl min-h-[52px]`인가
- [ ] Legacy 6색(`#A35139`, `#EEE9DF` 등)이 섞여 들어가지 않았는가
- [ ] 카드가 `rounded-2xl border border-[#D8CEBE]` + `shadow-xs` 이하인가
- [ ] 헤딩이 `font-serif-kr font-bold`(실제 고딕)이고 로고 서체를 쓰지 않았는가
- [ ] 글자 대비가 4.5:1 이상인가(작은 글자는 `#78716C`가 하한)
- [ ] 로딩·실패 안내가 5.8 형식이고 `role="status"`/`role="alert"`가 있는가
- [ ] 터치 영역이 44px 이상이고 `:focus-visible`이 보이는가
- [ ] `prefers-reduced-motion`에서 움직임이 멈추는가
- [ ] 375px와 1280px에서 확인했는가

---

## 부록: 근거 파일

- `src/index.css`: 폰트 변수, `:root` 색 변수, `.hanji-texture`, 애니메이션, 포커스 스타일
- `index.html`: Pretendard·Noto Sans KR 로드, `body` 기본 클래스, `theme-color #FBF8F2`
- `src/components/SceneStart.tsx`, `SceneStartBackdrop.tsx`, `InteractiveNorigae.tsx`: 시작 화면
- `src/components/TangramClueBoard.tsx`: 2×2 조각판, 칠교 일러스트, 창살·꽃매듭 장식
- `src/components/SceneResult.tsx`: 결과 카드, 음성 플레이어, 로딩·실패 안내
- `src/components/SceneInputConsent.tsx`, `LoginModal.tsx`, `KoreanDatePicker.tsx`: 입력 폼, 모달, 날짜 선택
- `src/components/TopExperienceHeader.tsx`, `BottomNav.tsx`: 상단 헤더, 하단 탭
- 첨부 이미지 3장(시작 화면, 조각 결과판, 키 컬러 팔레트)
