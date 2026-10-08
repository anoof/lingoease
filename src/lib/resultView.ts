import { analyzeChunks } from '@/actions/llm/utils';
import type { KeyTerm } from '@/store/typing';

// The one seam between raw data (a live /simplify response, or a precomputed
// Study Talk file) and what the result view renders. See CONTEXT.md: Live
// Result / Study Result.

export type ResultView = {
  source: 'live' | 'study';
  simplifiedChunks: ReturnType<typeof analyzeChunks>['analyzedChunks'];
  newWordsRate: string;
  totalLemmasCount: number;
  totalNewWordsCount: number;
  keyTerms: KeyTerm[];
  keptWords: string[];
  audio?: { url: string; downloadUrl: string };
  attribution?: {
    talkId: string;
    engineVersion: string;
    configId: string;
    run: string;
  };
};

type ResultInput = {
  simplifiedText: string;
  wordFreq: 1000 | 2000 | 3000;
  keyTerms?: KeyTerm[];
  keptWords?: string[];
} & (
  | { source: 'live'; audio: { url: string; downloadUrl: string } }
  | {
      source: 'study';
      talkId: string;
      engineVersion: string;
      configId: string;
      run: string;
    }
);

export function buildResultView(input: ResultInput): ResultView {
  const analyzed = analyzeChunks([input.simplifiedText], input.wordFreq);

  const base = {
    simplifiedChunks: analyzed.analyzedChunks,
    newWordsRate: analyzed.newWordsRate,
    totalLemmasCount: analyzed.totalLemmasCount,
    totalNewWordsCount: analyzed.totalNewWordsCount,
    keyTerms: input.keyTerms ?? [],
    keptWords: input.keptWords ?? [],
  };

  if (input.source === 'live') {
    return { ...base, source: 'live', audio: input.audio };
  }

  return {
    ...base,
    source: 'study',
    attribution: {
      talkId: input.talkId,
      engineVersion: input.engineVersion,
      configId: input.configId,
      run: input.run,
    },
  };
}
