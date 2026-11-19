/**
 * 전생 캐릭터 10종 데이터.
 * - 이미지: public/characters/NN.webp (9:16), 음성: public/characters/NN.mp3
 * - dialogue / setting / ending 은 줄바꿈(\n)을 그대로 유지한다.
 *   dialogue 에서 `화자: "대사"` 는 화자 강조, `( ... )` 한 줄은 지문으로 렌더링된다.
 */

import type { PastLifeStory } from '../types/jeonju';

export interface CharacterResult {
  job: string;
  reputation: string;
  achievement: string;
}

export interface Character {
  id: string;
  emoji: string;
  title: string;
  imageUrl: string;
  audioUrl: string;
  /** 대표 대사 (음성 파일과 동일한 문장) */
  quote: string;
  setting: string;
  dialogue: string;
  result: CharacterResult;
  ending: string;
}

export const CHARACTERS: Character[] = [
  {
    id: '01',
    emoji: '📜',
    title: '몰래 상단 차린 막내딸',
    imageUrl: '/characters/01.webp',
    audioUrl: '/characters/01.mp3',
    quote: '어머니, 그 댁 재산이 얼마나 되옵니까? 인수합병을 검토 중이옵니다.',
    setting: `대감댁 막내딸. 수놓기 시간에 몰래 주판을 튕겼어요.`,
    dialogue: `어머니: "혼처가 들어왔다."
나: "어머니, 그 댁 재산이 얼마나 되옵니까?"
어머니: "…그건 왜?"
나: "인수합병을 검토 중이옵니다."
(어머니, 그 자리에서 혼절하심)`,
    result: {
      job: `한양 최대 비단 상단 '숨은 큰손'`,
      reputation: `"그 댁 따님은 시집을 안 가고 회사를 가셨대."`,
      achievement: `조선 최초 여성 CEO (공식 기록엔 남편 이름으로 남음)`,
    },
    ending: `장부를 정리하다 "흑자로구나…" 하고 미소 지으며 눈을 감음.
유산은 엄청났는데, 상속 서류가 전부 암호로 되어 있었다.`,
  },
  {
    id: '02',
    emoji: '🍚',
    title: '수라간 반항아 숙수',
    imageUrl: '/characters/02.webp',
    audioUrl: '/characters/02.mp3',
    quote: '퓨전 신선로이옵니다. 김치를 넣었사옵니다.',
    setting: `궁궐 수라간 막내 숙수예요. 정해진 레시피대로는 절대 안 만들어요.`,
    dialogue: `상궁: "전하 수라에 무엇을 올렸느냐?"
나: "퓨전 신선로이옵니다."
상궁: "…퓨…뭐?"
나: "김치를 넣었사옵니다."
(상궁마마, 국자를 떨어뜨리심)`,
    result: {
      job: `수라간 출입 금지 → 궐 밖 국밥집 사장`,
      reputation: `궁에서는 역적, 장터에서는 맛집`,
      achievement: `임금님이 몰래 미행해서 사 먹은 유일한 국밥`,
    },
    ending: `마지막 국밥을 끓이며 "간이… 딱 맞구나" 하고 숟가락을 내려놓음.
비법 육수 레시피는 끝내 아무도 몰랐다.`,
  },
  {
    id: '03',
    emoji: '🎨',
    title: '도화서 사고뭉치 화원',
    imageUrl: '/characters/03.webp',
    audioUrl: '/characters/03.mp3',
    quote: '조금 귀엽게 그렸사옵니다. 눈이 얼굴의 절반이옵니다.',
    setting: `어릴 때부터 그림 하나는 기가 막히게 잘 그렸어요.
문제는 사람을 있는 그대로 그리는 법이 없었다는 것.
점이 있는 사람은 점을 세 배로, 코가 큰 사람은 코를 다섯 배로 그렸어요.
그 재능을 인정받아 도화서에 들어갔지만, 어느 날 왕의 초상화를 그리게 되면서 인생이 완전히 바뀌었습니다.
왕의 눈을 얼굴의 절반 크기로 그려버렸거든요.`,
    dialogue: `왕: "이것이 정녕 과인의 얼굴이란 말이냐?"
나: "그러하옵니다, 전하."
왕: "어찌하여 눈이 얼굴의 절반이더냐?"
나: "조금 귀엽게 그렸사옵니다. 눈이 얼굴의 절반이옵니다."
왕: "……."
(그날 도화서에 기나긴 침묵이 흘렀다.)`,
    result: {
      job: `도화서 화원 → 장터의 인기 초상화가`,
      reputation: `"닮지는 않았는데, 이상하게 나 같아."`,
      achievement: `지나가는 사람의 특징을 단번에 잡아내는 그림으로 전국적인 인기를 얻음. 특히 아이들이 자신의 그림을 받기 위해 줄을 섰다.`,
    },
    ending: `말년에는 자신을 그리겠다며 거울 앞에 앉았습니다.
한참 그림을 그리던 그는 완성된 초상화를 보고 한마디를 남겼어요.
"이 사람은… 좀 잘생겼구나."
그림에는 실제보다 훨씬 젊고 잘생긴 자신이 있었습니다.
그것이 그의 마지막 작품이었어요.`,
  },
  {
    id: '04',
    emoji: '📚',
    title: '과거 낙방 9수생',
    imageUrl: '/characters/04.webp',
    audioUrl: '/characters/04.mp3',
    quote: '제 족보로 공부한 놈들이 다 붙었사옵니다.',
    setting: `어릴 때부터 책과 함께 살았어요.
과거시험에 합격해 집안을 일으키겠다는 꿈도 있었습니다.
그런데 이상하게 시험만 보면 아는 문제를 틀렸어요.
첫 번째 낙방.
두 번째 낙방.
세 번째 낙방.
그렇게 아홉 번째까지 떨어졌습니다.
하지만 그에게는 놀라운 재능이 하나 있었어요.
남에게 가르쳐주면 그 사람이 반드시 합격한다는 것이었습니다.`,
    dialogue: `친구: "자네, 이번에도 떨어졌다지?"
나: "그렇다네."
친구: "그런데 자네에게 배운 김 서방은 장원급제했다더군."
나: "알고 있네."
친구: "억울하지도 않은가?"
나: "제 족보로 공부한 놈들이 다 붙었사옵니다."
친구: "……그럼 자네가 가장 잘 아는 것 아닌가?"
나: "시험장만 들어가면 모르는 사람이 되네."
(그날도 제자들은 합격 축하 잔치를 벌였다.)`,
    result: {
      job: `만년 과거 응시생 → 전국에서 찾아오는 과거시험 전문 스승`,
      reputation: `"본인은 못 붙는데 제자는 무조건 붙여."`,
      achievement: `평생 수많은 제자를 가르쳐 관직에 진출시킴. 제자들 사이에서는 그의 필기 노트가 합격을 부르는 부적처럼 여겨졌다.`,
    },
    ending: `열 번째 시험을 앞둔 날, 제자들이 찾아와 마지막으로 가르침을 청했습니다.
그는 시험 준비를 멈추고 밤새 제자들을 가르쳤어요.
결국 자신의 마지막 시험에는 응시하지 못했습니다.
세월이 흘러 그의 제자들이 모여 스승을 기리는 비석을 세웠습니다.
비석에는 이렇게 적혀 있었어요.
"과거에는 끝내 급제하지 못하였으나, 수많은 급제자를 길러낸 사람."
그의 책상 위에는 마지막까지 풀지 못한 시험 문제가 남아 있었습니다.`,
  },
  {
    id: '05',
    emoji: '🧺',
    title: '수다쟁이 보부상',
    imageUrl: '/characters/05.webp',
    audioUrl: '/characters/05.mp3',
    quote: '빗은 두 푼, 이야기는 공짜이옵니다.',
    setting: `어깨에는 보따리, 입에는 끝없는 이야기를 달고 다녔어요.
비녀 하나를 팔면서 세 마을의 소문을 알려주고, 빗 하나를 팔면서 장터에서 있었던 싸움까지 설명했습니다.
손님들은 물건을 사러 왔다가 이야기를 듣느라 해가 지도록 집에 돌아가지 못했어요.
그런데 이상하게도 그의 물건은 항상 가장 먼저 팔렸습니다.`,
    dialogue: `손님: "이 빗은 얼마요?"
나: "두 푼이옵니다."
손님: "그리 비싸지는 않구려."
나: "빗은 두 푼, 이야기는 공짜이옵니다."
손님: "그럼 이야기는 무슨 이야기요?"
나: "그 이야기를 하자면 먼저 옆 마을 최 서방의 혼례부터 말씀드려야 하는데……."
(세 시간이 지나도 빗을 건네지 않았다.)`,
    result: {
      job: `전국의 떠도는 보부상 → 장터의 살아 있는 소식통`,
      reputation: `"저 사람 입만 열면 장날이 끝나."`,
      achievement: `전국의 마을과 장터를 오가며 사람들의 소식을 전함. 오랫동안 헤어졌던 가족을 다시 만나게 해주고, 먼 지역의 소식을 가장 먼저 알려주는 사람이 되었다.`,
    },
    ending: `마지막 장날에도 그는 평소처럼 보따리를 펼쳤습니다.
물건은 몇 개 남지 않았고, 그의 목소리도 예전 같지 않았어요.
그래도 손님이 다가오자 마지막 힘을 내 외쳤습니다.
"자, 마지막 떨이요!"
그날 그는 가진 물건을 모두 팔았습니다.
그가 떠난 뒤 사람들은 장터 한편에 작은 자리를 남겨두었어요.
누군가 그 자리에 앉아 이야기를 시작하면 다른 상인들이 말했습니다.
"이야기값은 받지 마시오. 그 양반도 공짜였으니까."`,
  },
  {
    id: '06',
    emoji: '🚨',
    title: '오지랖 포도청 포졸',
    imageUrl: '/characters/06.webp',
    audioUrl: '/characters/06.mp3',
    quote: '도둑은 못 잡았지만 김씨네 부부를 화해시켰사옵니다.',
    setting: `포도청에 들어가면서 다짐했어요.
반드시 큰 도둑을 잡아 이름을 날리겠다고요.
그런데 순찰을 나갈 때마다 이상한 일이 생겼습니다.
도둑을 잡으러 가다가 길 잃은 아이를 집에 데려다주고, 수상한 소리를 쫓다가 부부싸움을 말렸어요.
범인을 발견해도 배가 고프다고 하면 국밥부터 먹였습니다.
동료들은 답답해했지만 마을 사람들은 그를 누구보다 좋아했습니다.`,
    dialogue: `상관: "오늘은 도둑을 잡았느냐?"
나: "아직이옵니다."
상관: "그럼 하루 종일 무엇을 하였느냐?"
나: "김씨네 부부가 크게 다투고 있었사온데……."
상관: "설마 또?"
나: "도둑은 못 잡았지만 김씨네 부부를 화해시켰사옵니다."
상관: "……자네는 포졸인가, 중매쟁이인가?"
(그날도 체포 기록은 비어 있었다.)`,
    result: {
      job: `포도청 포졸 → 마을 사람들이 가장 믿는 해결사`,
      reputation: `"도둑보다 동네 사정을 더 잘 아는 포졸."`,
      achievement: `이웃 간의 다툼을 수없이 해결하고, 갈 곳 없는 아이들과 어려운 사람들을 도왔다. 나중에는 소문난 도둑들조차 그를 만나면 먼저 인사를 건넸다.`,
    },
    ending: `그가 세상을 떠난 날, 포도청에서는 조촐한 장례를 예상했습니다.
하지만 장례 행렬은 마을 끝까지 이어졌어요.
상인, 농부, 아이들, 부부싸움을 했던 김씨 부부까지 모두 찾아왔습니다.
그리고 행렬 끝에는 낯익은 얼굴들이 서 있었습니다.
그가 평생 잡으려 했던 도둑들이었어요.
동료 포졸이 놀라 물었습니다.
"자네들은 왜 왔는가?"
도둑 하나가 대답했습니다.
"우리 같은 놈들도 사람으로 대해준 분이었으니까요."
그는 끝내 큰 도둑을 잡지 못했습니다.
하지만 마을 사람들은 그를 가장 훌륭한 포졸로 기억했습니다.`,
  },
  {
    id: '07',
    emoji: '🐎',
    title: '마패를 숨긴 암행어사',
    imageUrl: '/characters/07.webp',
    audioUrl: '/characters/07.mp3',
    quote: '그 말씀을 기다렸습니다. 암행어사 출두요!',
    setting: `허름한 갓과 낡은 도포를 입고 조선의 여러 고을을 떠돌았어요.
사람들은 그를 가난한 선비라고 생각했습니다.
하지만 그의 품속에는 임금이 내린 마패가 숨겨져 있었어요.
그는 백성들의 이야기를 듣기 위해 일부러 가장 낮은 자리에서 잠을 자고, 시장에서 허드렛일을 하며 고을의 사정을 살폈습니다.
어느 날, 백성들에게 부당한 세금을 거두던 탐관오리가 그의 앞에 나타났습니다.`,
    dialogue: `수령: "어디서 굴러온 선비가 감히 관아의 일에 참견하느냐!"
나: "백성들이 굶주리고 있습니다."
수령: "내가 이 고을의 법이다!"
나: "그 말씀을 기다렸습니다. 암행어사 출두요!"
(그가 품속에서 마패를 꺼내 들었다.)
수령: "……."
(조금 전까지 호통치던 수령이 그대로 주저앉았다.)`,
    result: {
      job: `암행어사`,
      reputation: `"어느 날 나타나 어느 날 사라지는 선비."`,
      achievement: `여러 고을의 부정부패를 밝혀내고 억울한 누명을 쓴 백성들을 구제함. 정체를 드러내는 순간보다 백성의 목소리를 듣는 시간을 더 중요하게 여겼다.`,
    },
    ending: `말년에는 벼슬을 내려놓고 작은 마을에서 조용히 살았습니다.
아무도 그가 한때 암행어사였다는 사실을 알지 못했어요.
어느 날 한 아이가 물었습니다.
"할아버지께서는 젊었을 때 무엇을 하셨습니까?"
그는 잠시 웃으며 대답했습니다.
"사람들이 하는 이야기를 들었단다."
아이는 고개를 갸웃거렸습니다.
그가 세상을 떠난 뒤, 오래된 상자에서 낡은 마패 하나가 발견되었습니다.
그제야 마을 사람들은 깨달았습니다.
평생 자신의 이야기를 들어주던 노인이 누구였는지.`,
  },
  {
    id: '08',
    emoji: '🌧️',
    title: '빗속의 어진 수문장',
    imageUrl: '/characters/08.webp',
    audioUrl: '/characters/08.mp3',
    quote: '누가 오지 않아야 오늘 밤이 무사했던 것이지.',
    setting: `전주의 경기전에서 임금의 어진을 지키는 수문장이었어요.
그는 매일 같은 시간에 문을 열고, 같은 자리에서 밤을 지켰습니다.
누군가는 그를 보고 세상에서 가장 지루한 일을 한다고 말했습니다.
싸울 적도 없고, 특별한 사건도 없었으니까요.
그러던 어느 날 밤, 전주에 거센 비바람이 몰아쳤습니다.
사람들은 모두 몸을 피했지만 그는 어진이 모셔진 건물 앞을 떠나지 않았어요.`,
    dialogue: `동료: "비가 이렇게 쏟아지는데 아직도 여기 서 있는가?"
나: "내 자리는 이곳이네."
동료: "오늘 밤 누가 오겠는가. 아무도 오지 않을 걸세."
나: "누가 오지 않아야 오늘 밤이 무사했던 것이지."
동료: "……."
나: "자네는 처마 아래로 들어가게. 나는 조금 더 지키겠네."
(그날 밤, 수문장의 어깨에는 빗물이 쉴 새 없이 흘러내렸다.)`,
    result: {
      job: `경기전 수문장`,
      reputation: `"그가 서 있으면 그 문은 안심해도 된다."`,
      achievement: `오랜 세월 경기전을 지키며 수많은 밤을 무사히 보냄. 거센 폭풍우가 몰아친 날에도 자신의 자리를 지켜 어진을 보호하는 데 힘썼다.`,
    },
    ending: `늙어서 더는 창을 들 수 없게 된 날, 그는 마지막으로 경기전의 문을 바라보았습니다.
젊은 수문장이 그에게 물었습니다.
"선배께서는 평생 이곳을 지키셨는데, 가장 기억에 남는 날이 언제입니까?"
그는 잠시 생각하다 대답했어요.
"아무 일도 없었던 날이지."
그날 밤, 그는 평온하게 눈을 감았습니다.
평생 수많은 문을 열고 닫았지만, 정작 자신의 이름을 남기려 하지는 않았어요.
다만 그가 서 있던 자리는 다음 수문장에게 이어졌습니다.`,
  },
  {
    id: '09',
    emoji: '🪵',
    title: '마지막 글자를 새긴 목판 각수',
    imageUrl: '/characters/09.webp',
    audioUrl: '/characters/09.mp3',
    quote: '백 년 뒤의 누군가도 그 글자를 읽을 것이 아니냐.',
    setting: `전주의 작은 공방에서 평생 글자를 새겼어요.
나무판에 글자를 거꾸로 새기는 일이었습니다.
한 글자라도 잘못 파면 처음부터 다시 해야 했고, 손끝의 작은 실수 하나가 책 한 권의 운명을 바꿀 수도 있었어요.
다른 사람들은 세월이 흘러 더 편한 일을 찾았지만 그는 평생 같은 자리에 앉아 글자를 새겼습니다.
어느 날 어린 제자가 물었습니다.
그렇게 힘들게 만든 책을 백 년 뒤에도 누군가 읽겠느냐고요.`,
    dialogue: `제자: "스승님, 오늘은 몇 글자나 새기셨습니까?"
나: "백여 글자쯤 되겠구나."
제자: "하루 종일 겨우 그만큼이옵니까?"
나: "한 글자라도 틀리면 안 되는 일이니라."
제자: "그런데 누가 이 책을 그리 오래 읽겠습니까?"
나: "백 년 뒤의 누군가도 그 글자를 읽을 것이 아니냐."
(제자는 그제야 스승의 손끝에 난 수많은 상처를 바라보았다.)`,
    result: {
      job: `전주의 목판 각수`,
      reputation: `"저 사람이 새긴 글자는 백 년이 지나도 반듯할 것이야."`,
      achievement: `평생 수많은 책을 만들기 위한 목판을 새김. 어린 제자들에게 기술을 전수하고, 사라질 수도 있었던 이야기와 지식을 다음 세대에 전하는 데 기여했다.`,
    },
    ending: `마지막 겨울, 그는 오래된 공방에 앉아 책 한 권의 마지막 목판을 완성하고 있었습니다.
손이 떨려 칼을 제대로 잡기 어려웠지만 작업을 멈추지 않았어요.
마지막 글자를 새긴 뒤 그는 제자를 불렀습니다.
"이제 이 글자는 네가 지켜라."
제자가 목판을 받아 들자 그는 조용히 미소 지었습니다.
그가 세상을 떠난 뒤에도 공방에서는 책을 찍어냈습니다.
세월이 흘러 그의 이름은 잊혔지만, 그가 새긴 글자는 누군가의 손에서 계속 읽혔습니다.
그가 남긴 것은 이름이 아니라 문장이었습니다.`,
  },
  {
    id: '10',
    emoji: '🎭',
    title: '관객보다 추임새가 큰 소리꾼',
    imageUrl: '/characters/10.webp',
    audioUrl: '/characters/10.mp3',
    quote: '오늘은 여러분이 대신 한 대목 불러주시겠소?',
    setting: `전주의 장터에서 소리를 하며 살아갔어요.
그는 누구보다 목소리가 컸습니다.
어찌나 흥이 많았는지 자신이 소리를 하다가도 스스로 "얼씨구!"를 외쳤어요.
관객이 조용하면 혼자서 추임새를 넣고, 관객이 졸면 이름을 불러 깨웠습니다.
처음에는 사람들이 시끄럽다고 했지만, 어느새 장날이면 그의 소리를 기다리게 되었습니다.`,
    dialogue: `관객: "소리꾼 양반, 오늘도 혼자 북 치고 장구 칠 셈이오?"
나: "아니지요! 오늘은 여러분 차례이옵니다!"
관객: "우리가 무슨 소리를 안다고 그러시오?"
나: "오늘은 여러분이 대신 한 대목 불러주시겠소?"
관객: "에이, 우리가 어떻게……."
나: "좋소! 내가 먼저 시작하리다. 얼씨구!"
관객들: "절씨구!"
(그날 장터에서는 소리꾼보다 관객의 목소리가 더 크게 울려 퍼졌다.)`,
    result: {
      job: `전주 장터의 소리꾼`,
      reputation: `"저 양반 공연은 구경만 하고 올 수가 없어."`,
      achievement: `평생 수많은 사람에게 소리를 가르치고, 누구나 함께 추임새를 넣으며 즐길 수 있는 공연을 만들었다. 그의 공연에서는 신분이나 나이보다 함께 어울리는 흥이 더 중요했다.`,
    },
    ending: `마지막 공연 날, 그는 예전처럼 큰 목소리를 낼 수 없었습니다.
노쇠한 몸으로 무대에 오른 그는 관객들을 바라보며 미소 지었어요.
그리고 마지막 한 대목을 시작했습니다.
하지만 중간에서 목소리가 멈췄습니다.
잠시 정적이 흐른 뒤, 객석 어딘가에서 누군가 다음 소절을 불렀습니다.
다른 사람들도 하나둘 따라 부르기 시작했어요.
마침내 장터에 모인 모든 사람이 그의 노래를 이어 불렀습니다.
그는 말없이 웃으며 마지막 추임새를 넣었습니다.
"얼씨구……."
그날 공연의 마지막 노래는 소리꾼이 아닌 관객들이 완성했습니다.`,
  },
];

const LAST_CHARACTER_KEY = 'jeonsaeng:lastCharacterId';

function readLastCharacterId(): string | null {
  try {
    return window.localStorage.getItem(LAST_CHARACTER_KEY);
  } catch {
    return null;
  }
}

function writeLastCharacterId(id: string): void {
  try {
    window.localStorage.setItem(LAST_CHARACTER_KEY, id);
  } catch {
    // 저장소를 쓸 수 없는 환경에서는 중복 방지가 현재 화면 안에서만 동작한다
  }
}

/**
 * 직전 캐릭터(excludeId)를 제외하고 무작위로 하나 뽑는다.
 * excludeId 를 생략하면 마지막으로 뽑힌 캐릭터(localStorage)를 제외한다.
 * 뽑힌 캐릭터 id 는 다음 뽑기를 위해 저장된다.
 */
export function pickRandomCharacter(
  excludeId: string | null = readLastCharacterId(),
  random: () => number = Math.random,
): Character {
  const pool = CHARACTERS.filter((c) => c.id !== excludeId);
  const candidates = pool.length > 0 ? pool : CHARACTERS;
  const picked = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
  writeLastCharacterId(picked.id);
  return picked;
}

export type DialogueRow =
  | { kind: 'line'; speaker: string; text: string }
  | { kind: 'stage'; text: string };

/** dialogue 문자열을 화면 렌더링용 행으로 분해한다. `( ... )` 는 지문, `화자: 대사` 는 대사. */
export function parseDialogue(dialogue: string): DialogueRow[] {
  return dialogue
    .split('\n')
    .map((raw) => raw.trim())
    .filter((raw) => raw.length > 0)
    .map((raw): DialogueRow => {
      if (raw.startsWith('(') && raw.endsWith(')')) {
        return { kind: 'stage', text: raw };
      }
      const idx = raw.indexOf(':');
      if (idx > 0 && idx <= 8) {
        return { kind: 'line', speaker: raw.slice(0, idx).trim(), text: raw.slice(idx + 1).trim() };
      }
      return { kind: 'line', speaker: '', text: raw };
    });
}

/** 캐릭터 → 결과 카드 저장(canvas) 등이 읽는 PastLifeStory 형태 */
export function characterToStory(c: Character): PastLifeStory {
  return {
    jobTitle: c.title,
    setting: c.setting,
    dialogue: parseDialogue(c.dialogue).map((row) =>
      row.kind === 'stage'
        ? { speaker: '', text: row.text.replace(/^\(|\)$/g, '') }
        : { speaker: row.speaker, text: row.text },
    ),
    outcome: { job: c.result.job, reputation: c.result.reputation, achievement: c.result.achievement },
    ending: c.ending,
  };
}

export function getCharacterById(id: string | null | undefined): Character | null {
  return CHARACTERS.find((c) => c.id === id) ?? null;
}

// --- 현재 체험의 캐릭터 고정 (새로고침해도 유지) -------------------------------------------
const CURRENT_CHARACTER_KEY = 'jeonsaeng:currentCharacterId';

function readCurrentCharacterId(): string | null {
  try {
    return window.sessionStorage.getItem(CURRENT_CHARACTER_KEY);
  } catch {
    return null;
  }
}

function writeCurrentCharacterId(id: string | null): void {
  try {
    if (id) window.sessionStorage.setItem(CURRENT_CHARACTER_KEY, id);
    else window.sessionStorage.removeItem(CURRENT_CHARACTER_KEY);
  } catch {
    // sessionStorage 를 쓸 수 없으면 이 화면 안에서만 유지된다
  }
}

/** 이번 체험에서 이미 뽑힌 캐릭터가 있으면 그대로, 없으면 (직전 캐릭터 제외) 새로 뽑아 고정한다. */
export function getOrPickCurrentCharacter(): Character {
  const existing = getCharacterById(readCurrentCharacterId());
  if (existing) return existing;
  const picked = pickRandomCharacter();
  writeCurrentCharacterId(picked.id);
  return picked;
}

/** '다른 전생 확인하기' 전용: 현재 캐릭터를 제외하고 새로 뽑아 고정한다. */
export function pickAnotherCharacter(currentId: string): Character {
  const picked = pickRandomCharacter(currentId);
  writeCurrentCharacterId(picked.id);
  return picked;
}

/** 새 체험 시작·기록 삭제 시 고정된 캐릭터를 해제한다 (직전 캐릭터 id 는 localStorage 에 남아 연속 중복을 막는다). */
export function clearCurrentCharacter(): void {
  writeCurrentCharacterId(null);
}
