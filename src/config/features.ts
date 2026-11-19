/**
 * 실행 방식 스위치 (클라이언트·서버 공용, 순수 상수 — 환경변수 불필요).
 *
 * - USE_LOCAL_BACKEND: true 이면 브라우저가 Express/DB/Supabase 없이 로컬 구현(`src/utils/localApi.ts`)으로
 *   등록·QR 인증·조각 수령·쿠폰·결과·미디어월을 처리한다. false 로 바꾸면 기존처럼 `/api/*` 서버를 호출한다.
 * - ENABLE_AI_GENERATION: Gemini 스토리/이미지 생성. false 이면 호출·비용·지연이 없고 고정 10종 캐릭터만 쓴다.
 *   (geminiGenerator.ts 와 서버 생성 로직은 삭제하지 않고 보존 — true 로 바꾸면 서버 경로에서 다시 동작)
 */
export const USE_LOCAL_BACKEND = true;
export const ENABLE_AI_GENERATION = false;

/**
 * [시연·검수용] 지도 화면의 `[스탬프 4개 완료로 이동]` 빠른 이동 버튼.
 * 4개 거점 QR 인증을 건너뛰고 조각·쿠폰 발급과 박물관 단계를 한 번에 확인한다.
 * TODO: 최종 시연 영상 녹화·배포 전에 false 로 바꾸면 버튼(HomeWorkspace)과 로컬 API 가 모두 꺼진다.
 */
export const ENABLE_QUICK_COMPLETE_BUTTON = true;
