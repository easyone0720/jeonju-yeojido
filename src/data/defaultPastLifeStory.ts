import type { PastLifeResult, PastLifeStory } from '../types/jeonju.ts';

/**
 * Gemini 호출이 불가능(키 미설정·오류·시간 초과)할 때와, story 필드가 없는 이전 기록에 쓰는 기본 샘플.
 * 결과 화면의 4개 섹션 구조(전생 설정 / 그날의 대화 / 전생 결과 / 인생 마무리)와 동일하다.
 */
export const DEFAULT_PAST_LIFE_STORY: PastLifeStory = {
  jobTitle: '몰락 직전 양반가 주막 사장',
  setting:
    '조선 후기 대사헌 집안의 막내아들. 형들은 전원 과거 급제했어요.\n당신은 사서삼경보다 장터 시세표가 더 재밌는 사람이에요.',
  dialogue: [
    { speaker: '아버지', text: '스물다섯이다. 과거는?' },
    { speaker: '나', text: '아버님, 저는 조선 경제에 이바지하고 싶사옵니다.' },
    { speaker: '아버지', text: '…그래서?' },
    { speaker: '나', text: '주막을 차리겠사옵니다.' },
    { speaker: '', text: '아버지, 그날 처음 뒷목을 잡으심' },
  ],
  outcome: {
    job: '몰락 직전 양반가 주막 사장',
    reputation: '족보에서 지우고 싶은 이름 1위',
    achievement: '조선 최초 프랜차이즈 주막을 꿈꾸다 가산 탕진',
  },
  ending:
    "마지막 남은 주막에서 '내일은 2호점…'을 중얼거리다 평온하게 눈을 감음.\n장례식엔 빚쟁이가 형님들보다 많이 왔다.",
};

export const DEFAULT_ONE_LINE_SUMMARY = '족보에서 지우고 싶은 이름 1위, 조선 최초 프랜차이즈 주막을 꿈꾼 사람';

/** 결과에 story가 없으면(이전 기록 등) 기본 샘플을 돌려준다. */
export function getResultStory(result: Pick<PastLifeResult, 'story'>): PastLifeStory {
  return result.story ?? DEFAULT_PAST_LIFE_STORY;
}

/** 스토리를 한 덩어리 텍스트로 합친다 (기존 biography 필드·공유 문구 호환용). */
export function storyToBiography(story: PastLifeStory): string {
  return `${story.setting.replace(/\n+/g, ' ')} ${story.ending.replace(/\n+/g, ' ')}`.trim();
}
