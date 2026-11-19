import jeonjuTraditionalMapImg from '../assets/images/jeonju_traditional_map_1794650257338.jpg';
import { SpotId } from '../types/jeonju';

export const START_HERO_IMAGE = '/assets/hahoe_character_transparent.png';

export const TRADITIONAL_MAP_IMAGE = jeonjuTraditionalMapImg;

/** 장소 상세 이미지 (public/places/*.jpg, 16:9 · 1920×1080) */
export const SPOT_IMAGES: Record<SpotId, string> = {
  gyeonggijeon: '/places/gyeonggijeon.jpg',
  jeollagamyeong: '/places/jeollagamyeong.jpg',
  wanpanbon: '/places/wanpanbon.jpg',
  nambu_market: '/places/nambu_market.jpg',
  jeonju_museum: '/places/jeonju_museum.jpg',
};

/** 출발지 한옥마을 이미지 (현재 화면에서 쓰는 곳은 없지만 에셋 경로를 한곳에 모아 둔다) */
export const HANOK_VILLAGE_IMAGE = '/places/hanok_village.jpg';
