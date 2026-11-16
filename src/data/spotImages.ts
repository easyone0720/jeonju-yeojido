import jeonjuTraditionalMapImg from '../assets/images/jeonju_traditional_map_1794650257338.jpg';
import jeollagamyeongImg from '../assets/images/real/spot_jeollagamyeong.jpg';
import wanpanbonImg from '../assets/images/real/spot_wanpanbon.jpg';
import nambuMarketImg from '../assets/images/real/spot_nambu_market.jpg';
import jeonjuMuseumImg from '../assets/images/real/spot_jeonju_museum.jpg';
import { SpotId } from '../types/jeonju';

export const START_HERO_IMAGE = '/assets/hahoe_character_transparent.png';

export const TRADITIONAL_MAP_IMAGE = jeonjuTraditionalMapImg;

export const SPOT_IMAGES: Record<SpotId, string> = {
  gyeonggijeon: '/assets/aistudio/image_8a6fad13.png',
  jeollagamyeong: jeollagamyeongImg,
  wanpanbon: wanpanbonImg,
  nambu_market: nambuMarketImg,
  jeonju_museum: jeonjuMuseumImg,
};
