import type { Span } from '@/lib/highlight';
import type { KeyTerm } from '@/store/typing';

// The one seam between raw data (a live /simplify response, or a precomputed
// Study Talk file) and what the result view renders. See CONTEXT.md: Live
// Result / Study Result. Highlights and coverage come from the backend.

export type ResultView = {
  source: 'live' | 'study';
  simplified: string;
  spans: Span[];
  coverage: number;
  original: string;
  originalSpans: Span[];
  originalCoverage?: number;
  keyTerms: KeyTerm[];
  keptWords: string[];
  protectedPhrases: string[];
  audio?: { url: string; downloadUrl: string };
};

// Fields shared by a /simplify response and a Study Talk file.
export type ResultData = {
  simplified: string;
  coverage: number;
  spans?: Span[];
  original?: string;
  original_spans?: Span[];
  original_coverage?: number;
  key_terms?: KeyTerm[];
  kept_words?: string[];
  protected_phrases?: string[];
};

type ResultInput = { data: ResultData; original?: string } & (
  | { source: 'live'; audio: { url: string; downloadUrl: string } }
  | { source: 'study' }
);

export function buildResultView(
  input: ResultInput & { source: 'live' }
): ResultView & { source: 'live' };
export function buildResultView(
  input: ResultInput & { source: 'study' }
): ResultView & { source: 'study' };
export function buildResultView(input: ResultInput): ResultView {
  const { data } = input;
  if (!data.spans) {
    console.warn('No highlight spans in the result (backend older than v7) — text shown without highlights.');
  }

  const base = {
    simplified: data.simplified,
    spans: data.spans ?? [],
    coverage: data.coverage,
    original: data.original ?? input.original ?? '',
    originalSpans: data.original_spans ?? [],
    originalCoverage: data.original_coverage,
    keyTerms: data.key_terms ?? [],
    keptWords: data.kept_words ?? [],
    protectedPhrases: data.protected_phrases ?? [],
  };

  if (input.source === 'live') {
    return { ...base, source: 'live', audio: input.audio };
  }

  return { ...base, source: 'study' };
}
