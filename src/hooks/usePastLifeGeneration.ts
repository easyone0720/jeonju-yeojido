import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Character,
  GenerationSource,
  ImagePart,
  PartState,
  PastLifeGenerator,
  PastLifeInput,
  PastLifeParts,
  StoryPart,
  VoicePart,
  createFallbackGenerator,
  createPastLifeGenerator,
  isAbortError,
  mockPartsForStory,
} from '../services/pastLife';

export interface PastLifeGenerationState {
  story: PartState<StoryPart>;
  image: PartState<ImagePart>;
  voice: PartState<VoicePart>;
}

/** 화면이 바로 쓰는 합쳐진 결과 (세 단계가 모두 준비되기 전에는 null) */
export interface PastLifeView extends StoryPart {
  imageUrl: string;
  imageAlt: string;
  audioUrl: string;
}

export interface UsePastLifeGenerationOptions {
  input?: PastLifeInput;
  /** 테스트·특수 화면용 주입. 생략하면 현재 모드(features.ts)로 정한다 */
  generator?: PastLifeGenerator;
  fallback?: PastLifeGenerator | null;
}

const pending = <T,>(): PartState<T> => ({ status: 'pending', data: null, source: null });
const ready = <T,>(data: T, source: 'mock' | 'api'): PartState<T> => ({ status: 'ready', data, source });
const fellBack = <T,>(data: T, error: unknown): PartState<T> => ({
  status: 'fallback',
  data,
  source: 'mock',
  error: error instanceof Error ? error.message : String(error),
});
const failed = <T,>(error: unknown): PartState<T> => ({
  status: 'error',
  data: null,
  source: null,
  error: error instanceof Error ? error.message : String(error),
});

function stateFromParts(parts: PastLifeParts, source: 'mock' | 'api'): PastLifeGenerationState {
  return { story: ready(parts.story, source), image: ready(parts.image, source), voice: ready(parts.voice, source) };
}

function overallSource(state: PastLifeGenerationState): GenerationSource | null {
  const sources = [state.story.source, state.image.source, state.voice.source].filter(Boolean);
  if (sources.length === 0) return null;
  if (sources.every((s) => s === 'mock')) return 'mock';
  if (sources.every((s) => s === 'api')) return 'api';
  return 'mixed';
}

/**
 * 전생 결과(스토리 → 이미지·음성 병렬)를 단계별 상태로 구독한다.
 * - Mock 모드: 이 탭에 고정된 캐릭터로 첫 화면을 즉시 그린다(기존 동작과 동일, 로딩 없음).
 * - API 모드: 스토리를 먼저 보여 주고 이미지·음성을 이어서 채운다. 실패한 단계만 Mock 으로 폴백한다.
 * - 화면을 벗어나거나 새로 요청하면 진행 중인 요청을 취소한다(AbortController).
 */
export function usePastLifeGeneration(options: UsePastLifeGenerationOptions = {}) {
  const generator = useMemo(() => options.generator ?? createPastLifeGenerator(), [options.generator]);
  const fallback = useMemo(
    () => (options.fallback !== undefined ? options.fallback : createFallbackGenerator(generator.mode)),
    [options.fallback, generator.mode],
  );
  const inputRef = useRef<PastLifeInput>(options.input ?? {});
  inputRef.current = options.input ?? {};

  const [state, setState] = useState<PastLifeGenerationState>(() => {
    const peeked = generator.peekCurrent?.() ?? null;
    return peeked
      ? stateFromParts(peeked, generator.mode)
      : { story: pending(), image: pending(), voice: pending() };
  });
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);

  const run = useCallback(
    async (input: PastLifeInput) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;
      const { signal } = controller;
      // Mock 은 즉시 끝나므로 한 번에 반영해 중간 화면(새 스토리 + 이전 이미지)이 보이지 않게 한다
      const progressive = generator.mode !== 'mock';
      setIsLoading(true);
      if (progressive) setState({ story: pending(), image: pending(), voice: pending() });

      try {
        // 1단계: 스토리
        let story: PartState<StoryPart>;
        let storyFromFallback = false;
        try {
          story = ready(await generator.story(input, signal), generator.mode);
        } catch (error) {
          if (isAbortError(error)) throw error;
          if (!fallback) {
            story = failed(error);
          } else {
            story = fellBack(await fallback.story(input, signal), error);
            storyFromFallback = true;
          }
        }
        if (signal.aborted) return;
        if (progressive) setState((prev) => ({ ...prev, story }));

        if (!story.data) {
          setState({ story, image: failed(story.error), voice: failed(story.error) });
          return;
        }

        // 2단계: 이미지·음성 병렬 (하나가 실패해도 다른 하나는 살린다)
        const source = storyFromFallback && fallback ? fallback : generator;
        const [img, vo] = await Promise.allSettled([
          source.image(story.data, signal),
          source.voice(story.data, signal),
        ]);
        if (signal.aborted) return;

        const backup = fallback ? mockPartsForStory(story.data) : null;
        const sourceMode = storyFromFallback ? 'mock' : generator.mode;
        const image: PartState<ImagePart> =
          img.status === 'fulfilled'
            ? storyFromFallback
              ? fellBack(img.value, story.error)
              : ready(img.value, sourceMode)
            : backup
              ? fellBack(backup.image, img.reason)
              : failed(img.reason);
        const voice: PartState<VoicePart> =
          vo.status === 'fulfilled'
            ? storyFromFallback
              ? fellBack(vo.value, story.error)
              : ready(vo.value, sourceMode)
            : backup
              ? fellBack(backup.voice, vo.reason)
              : failed(vo.reason);

        setState({ story, image, voice });
      } catch (error) {
        if (isAbortError(error)) return;
        setState({ story: failed(error), image: failed(error), voice: failed(error) });
      } finally {
        if (controllerRef.current === controller) {
          controllerRef.current = null;
          setIsLoading(false);
        }
      }
    },
    [generator, fallback],
  );

  // 첫 화면: 즉시 보여 줄 결과가 없을 때만 생성한다 (Mock 은 peekCurrent 로 이미 채워져 있다)
  useEffect(() => {
    if (state.story.status === 'pending') void run(inputRef.current);
    return () => controllerRef.current?.abort();
    // 마운트 시 한 번만
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** '다른 전생 확인하기': 현재 결과를 제외하고 다시 만든다 */
  const another = useCallback(() => {
    void run({ ...inputRef.current, excludeCharacterId: state.story.data?.characterId ?? null });
  }, [run, state.story.data?.characterId]);

  /** 실패했을 때 같은 입력으로 다시 시도 */
  const retry = useCallback(() => {
    void run(inputRef.current);
  }, [run]);

  const view = useMemo<PastLifeView | null>(() => {
    const { story, image, voice } = state;
    if (!story.data || !image.data || !voice.data) return null;
    return { ...story.data, imageUrl: image.data.url, imageAlt: image.data.alt, audioUrl: voice.data.url };
  }, [state]);

  /** 기존 화면 코드(Character 형태)와 바로 맞물리는 값. 모든 단계가 준비되기 전에는 null */
  const character = useMemo<Character | null>(
    () =>
      view
        ? {
            id: view.characterId,
            emoji: view.emoji,
            title: view.title,
            imageUrl: view.imageUrl,
            audioUrl: view.audioUrl,
            quote: view.quote,
            setting: view.setting,
            dialogue: view.dialogue,
            result: view.result,
            ending: view.ending,
          }
        : null,
    [view],
  );

  return {
    ...state,
    view,
    character,
    mode: generator.mode,
    source: overallSource(state),
    isLoading,
    another,
    retry,
  };
}
