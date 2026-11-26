/**
 * 테스트 환경 격리 — bun 은 .env 를 자동으로 읽는다. 개발자 로컬 .env 의 값(VITE_PAST_LIFE_MODE=api 등)이
 * "빌드 기본값" 테스트를 깨뜨리지 않도록, 모듈이 로드되기 전에 테스트 기준값으로 고정한다.
 * (api 모드가 필요한 테스트는 스스로 값을 지정한다)
 */
process.env.VITE_PAST_LIFE_MODE = 'mock';
