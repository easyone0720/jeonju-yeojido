# 0단계 보존 기준 (Baseline)

- 기준 소스: `main` (1단계 `refactor/past-life-service` 병합 상태, 2026-11-24 확인)
- 목적: 이후 변경이 보존 대상(캐릭터·상품·자산·지도·쿠폰·잠금·결과 저장·전시 동의)을 건드리지 않았는지 자동으로 확인
- 이 단계에서 바꾼 것: 테스트와 기준 자료 **추가만**. 앱 코드·상품/캐릭터 데이터·원본 자산·패키지는 변경하지 않음
- 기준 자료에는 실제 사용자 입력·생년월일을 넣지 않았다. 테스트가 등록 API 를 부를 때 쓰는 생년월일은 실행 중에만 만드는 가짜 값(`syntheticBirthDate`)이다.

## 실행

```bash
bun test tests/preservation   # 보존 테스트만 (19건)
bun test                      # 전체 (기존 54건 + 보존 19건)
bun run lint                  # 타입 검사 (tsc --noEmit)
```

## 구성

| 파일 | 검사 내용 |
| --- | --- |
| `tests/preservation/characters.preservation.test.ts` | 캐릭터 ID 01~10, JSON 키·자료형, 이미지·음성 경로와 파일 존재, 로더 순서. **이야기 문장은 고정하지 않음** |
| `tests/preservation/goods.preservation.test.ts` | 결과 화면 기존 추천(원형 5종 × `[원형 상품, goods_hanji_print]`)의 ID·순서·표시 필드, 스토어 14종의 ID·이름·가격·이미지 경로·순서 |
| `tests/preservation/assets.preservation.test.ts` | 보호 대상 43개 파일 해시. 검사기의 실패 감지는 OS 임시 폴더 복사본에서만 확인(원본 무변경) |
| `tests/preservation/behavior.preservation.test.ts` | 거점·QR·조각 종류·쿠폰 템플릿 기준값, 방문 → 조각·쿠폰 지급·중복/오류 QR·박물관 조건·잠금 조건(도장 수), 결과 저장·재조회, 전시 동의 후 다른 전생으로 바꿔도 공개 항목 유지, 철회 시 삭제 |
| `tests/preservation/helpers.ts` | 브라우저 저장소 대역, 해시 검사기, 가짜 생년월일 |
| `tests/preservation/fixtures/*.json` | 기준값 (아래) |

### 추천 검사의 기준 입력
결과 화면 추천은 `localApi.ts` `handleGenerate` 가 `[archetype.goods, HANJI_PRINT_GOODS]` 로 만든다.
테스트는 **결과의 원형 id → 추천 목록** 대응만 확인한다. 어떤 원형이 뽑히는지(현재 생년월일·첫 방문지·세션 id 해시)는
검사하지 않는다 — 판정 방식은 다음 단계에서 바뀔 예정이므로 보존 조건으로 만들지 않았다.
원형 5종을 모두 만나기 위해 서로 다른 가짜 생년월일로 기존 흐름을 여러 번 실행한다(최대 300회).

## 보호 대상 자산 (`fixtures/assets.manifest.json`, 43개)

| 그룹 | 개수 | 포함 이유 |
| --- | --- | --- |
| character-portrait | 11 | `public/characters/01~11.jpg`. 결과 화면·전시·결과 카드 초상. 11.jpg 는 현재 미사용이지만 원본 보존 대상 |
| character-voice | 10 | `public/characters/01~10.mp3`. 캐릭터 대표 대사 음성(`quote` 와 일치) |
| goods-image | 14 | `public/goods/01~14.jpg`. 기념품 스토어·결제 화면 상품 이미지 |
| map-and-places | 7 | `src/assets/images/jeonju_traditional_map_*.jpg`(지도 배경, `spotImages.ts` 가 import), `public/places/*.jpg` 6장(거점 상세·튜토리얼 사진) |
| media-wall-video | 1 | `public/videos/mediawall.mp4` |

제외(이번 기준에 넣지 않음): `src/assets/images` 의 나머지 11장(현재 코드에서 import 되지 않음),
`public/assets/` 장식 이미지·PDF(보존 요청 범위 밖). 필요하면 다음 단계에서 추가한다.

## 기존 실패 (이번 작업과 무관, 그대로 둠)

| 구분 | 내용 | 0단계 전 | 0단계 후 |
| --- | --- | --- | --- |
| 타입 검사 | `server.ts:690`, `server.ts:1049` TS2339 / `src/utils/couponBarcode.test.ts` 110·114·123·128·147·152·162·166 TS2339, 110·147 TS7006 — 총 12건 | 12건 | 12건 (목록 동일) |
| 테스트 | `live HMAC coupon barcode detects tampering and serverStore enforces atomic single redemption` — `TypeError: undefined is not an object (evaluating 'db.saveSession(demoClaimed).coupons')` | 실패 | 실패 (변화 없음) |

삭제·skip·완화하지 않았다.

## 화면 기준 (`screenshots/`)

로컬 빌드(`vite build` → `vite preview`)를 headless Chrome 으로 열어 촬영. 캐릭터·쿠폰 추첨이 매번 달라지지 않도록
촬영 스크립트에서만 `Math.random` 을 고정 시드로 바꿨다(앱 코드 변경 없음). 로그인은 기본 데모 계정, 도장은 시연용 skip 으로 채웠다.

| 화면 | 375px | 1280px |
| --- | --- | --- |
| 지도(첫 진입, 완판본 선택) | `01-map_375.png` | `01-map_1280.png` |
| 기념품 잠금 팝업(도장 0/4) | `02-goods-locked_375.png` | `02-goods-locked_1280.png` |
| 쿠폰함(4/4, 전체 페이지) | `03-coupons_375.png` | `03-coupons_1280.png` |
| 기념품 스토어 열림(전체 페이지) | `04-goods-unlocked_375.png` | `04-goods-unlocked_1280.png` |
| 주문·결제(첫 상품) | `05-checkout_375.png` | `05-checkout_1280.png` |
| 결과 화면 ‘맞춤 전생 굿즈’ 블록 | `06-result-goods_375.png` | `06-result-goods_1280.png` |

주의: 촬영 환경은 Linux 서버의 headless Chrome 이다. 외부 웹폰트 접속이 막혀 있어 시스템 한글 서체로 그려졌을 수 있으므로,
**같은 환경에서 다시 찍어 비교하는 용도**로만 쓴다. 사용자 PC 의 실제 렌더링과 픽셀 비교하지 않는다.

## 이 단계에서 확인하지 못한 것

| 항목 | 이유 | 후속 검증 방법 |
| --- | --- | --- |
| 기념품 잠금 오버레이의 화면 연결(`App.tsx` `goodsLocked`) | 계산식은 테스트에서 같은 식으로 확인했지만 App 컴포넌트를 렌더링하는 테스트 구조가 없음 | 스크린샷 02·04 비교, 또는 다음 단계에서 화면 테스트 도구 도입 여부 결정 |
| 새로고침 후 복원 팝업(`RestoreSessionModal`) 흐름 | 화면 흐름이라 단위 테스트로 못 다룸 | 브라우저 흐름 스크립트(같은 탭 새로고침 → 복원 → 결과 화면) |
| 상품 카드 레이아웃의 픽셀 수준 보존 | 기준 스크린샷만 확보, 자동 비교 도구 없음 | 같은 환경 재촬영 후 이미지 비교(차이 비율 기준은 별도 결정) |
| 실제 모바일 기기·사용자 PC 렌더링 | 촬영 환경이 서버 headless Chrome | 사용자 PC 에서 같은 6개 화면 수동 촬영 |
| 서버 모드(`server.ts`, `USE_LOCAL_BACKEND=false`) 동작 | 현재 비활성 경로 | 서버 모드 사용 결정 시 별도 검증 |
