/**
 * 전생여지도 기념품 굿즈 14종.
 * - 이미지: public/goods/NN.jpg (16:9, 1280x720)
 * - 가격은 원화(KRW) 정수. 화면 표시는 `formatWon()` 을 쓴다.
 */

export interface GoodsItem {
  id: string;
  name: string;
  desc: string;
  price: number;
  imageUrl: string;
}

export const GOODS: GoodsItem[] = [
  {
    id: '01',
    name: '전생여지도 목각인형 키링',
    desc: '전통 복식 선비 목각 인형과 붉은 매듭 노리개 키링',
    price: 15000,
    imageUrl: '/goods/01.jpg',
  },
  {
    id: '02',
    name: '전생여지도 자개 손거울',
    desc: '전주 경기전 전각과 벚꽃을 담은 천연 자개 손거울',
    price: 22000,
    imageUrl: '/goods/02.jpg',
  },
  {
    id: '03',
    name: '전생여지도 전생 호패',
    desc: '나의 전생 직업이 새겨진 원목 호패 & 구름 자수 스트랩',
    price: 14000,
    imageUrl: '/goods/03.jpg',
  },
  {
    id: '04',
    name: '전생여지도 미니 북 키링',
    desc: '구름 문양 전통 북과 나무 북채 미니어처 키링',
    price: 16000,
    imageUrl: '/goods/04.jpg',
  },
  {
    id: '05',
    name: '전생여지도 보부상 크로스백',
    desc: '보부상 금사 자수와 전통 매듭 참이 달린 반달형 가방',
    price: 38000,
    imageUrl: '/goods/05.jpg',
  },
  {
    id: '06',
    name: '전생여지도 보부상 해머백',
    desc: '구름 문양 스트랩과 넉넉한 수납의 원통형 보스턴백',
    price: 49000,
    imageUrl: '/goods/06.jpg',
  },
  {
    id: '07',
    name: '전생여지도 오답노트 (誤答筆記)',
    desc: '과거 낙방 9수생 에디션 전통 오침안정법 한지 노트',
    price: 12000,
    imageUrl: '/goods/07.jpg',
  },
  {
    id: '08',
    name: '전생여지도 전생 동전지갑',
    desc: '모란 자수와 엽전 노리개가 어우러진 슬롯형 동전지갑',
    price: 19000,
    imageUrl: '/goods/08.jpg',
  },
  {
    id: '09',
    name: '전생여지도 전생 단주 팔찌',
    desc: '10종 전생 상징 아이콘을 새긴 원목 단주 & 매듭 팔찌',
    price: 24000,
    imageUrl: '/goods/09.jpg',
  },
  {
    id: '10',
    name: '전생여지도 전생 붓',
    desc: '봉황 금박 문양과 매화 노리개가 달린 전통 서예 붓 세트',
    price: 28000,
    imageUrl: '/goods/10.jpg',
  },
  {
    id: '11',
    name: '전생여지도 전생 만년필',
    desc: '경기전 지붕 클립과 전각 금장 각인이 새겨진 프리미엄 만년필',
    price: 45000,
    imageUrl: '/goods/11.jpg',
  },
  {
    id: '12',
    name: '전생여지도 전생 인형 컬렉션',
    desc: '10종 전생 캐릭터의 특징을 살린 10cm 미니어처 봉제 인형',
    price: 25000,
    imageUrl: '/goods/12.jpg',
  },
  {
    id: '13',
    name: '전생여지도 마패 컵받침',
    desc: '암행어사 마패 부조 황동 코스터 & 전통 매듭 선물 패키지',
    price: 18000,
    imageUrl: '/goods/13.jpg',
  },
  {
    id: '14',
    name: '전생여지도 전생 캐릭터 키링',
    desc: '10종 전생 일러스트 양면 아크릴 키링 & 금장 구름 참',
    price: 11000,
    imageUrl: '/goods/14.jpg',
  },
];

export function formatWon(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}
