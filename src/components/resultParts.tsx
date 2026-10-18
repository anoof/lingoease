import {
  SPAN_LABELS,
  SPAN_STYLES,
  segmentsFromSpans,
  spanTypesPresent,
  type Span,
  type SpanType,
} from '@/lib/highlight';
import type { ResultView } from '@/lib/resultView';
import { useMemo } from 'react';

// Renders `text` with the backend's highlight spans. Without spans (an older
// backend) the text is shown plain — the frontend has no word lists of its own.
export function HighlightedText({
  text,
  spans,
  height,
}: {
  text: string;
  spans: Span[];
  height?: string;
}) {
  const segments = useMemo(() => segmentsFromSpans(text, spans), [text, spans]);

  return (
    <div
      className='h-[calc(100dvh-30rem)] w-full min-w-0 rounded-md p-4 overflow-y-auto overscroll-none'
      style={height ? { height } : undefined}
    >
      <div className='mb-6 select-text'>
        {segments.map((seg, i) =>
          seg.type ? (
            <span
              key={i}
              className='highlighted-text'
              data-span-type={seg.type}
              title={SPAN_LABELS[seg.type]}
              style={SPAN_STYLES[seg.type]}
            >
              {seg.text}
            </span>
          ) : (
            <span key={i}>{seg.text}</span>
          )
        )}
      </div>
    </div>
  );
}

function Swatch({ type }: { type: SpanType }) {
  return (
    <span style={SPAN_STYLES[type]} aria-hidden>
      Aa
    </span>
  );
}

// One line under the text: what each highlight style means. Only the types
// that occur in the given spans are listed.
export function HighlightLegend({ spans }: { spans: Span[] }) {
  const types = spanTypesPresent(spans);
  if (types.length === 0) return null;
  return (
    <div className='w-full flex flex-wrap gap-x-4 gap-y-1 px-4 pt-2 text-xs text-muted-foreground'>
      {types.map((t) => (
        <span key={t} className='inline-flex items-center gap-1'>
          <Swatch type={t} /> {SPAN_LABELS[t]}
        </span>
      ))}
    </div>
  );
}

export function CoverageLine({ coverage }: { coverage: number }) {
  return (
    <div className='flex w-full items-center justify-center py-2 px-4'>
      Vocabulary Coverage:{' '}
      <span className='font-bold'>{(coverage * 100).toFixed(1)}%</span>
    </div>
  );
}

// Below the text, above Start Over — hidden entirely when all lists are empty
// (FRONTEND_BRIEF.md change 3).
export function KeyTermsSection({
  keyTerms,
  keptWords,
  protectedPhrases,
}: {
  keyTerms: ResultView['keyTerms'];
  keptWords: ResultView['keptWords'];
  protectedPhrases: ResultView['protectedPhrases'];
}) {
  if (keyTerms.length === 0 && keptWords.length === 0 && protectedPhrases.length === 0) {
    return null;
  }

  return (
    <div className='w-full flex flex-col gap-3 px-4 py-3 text-sm border-t'>
      {keyTerms.length > 0 && (
        <div>
          <div className='font-semibold mb-1'>
            <Swatch type='key_term' /> {SPAN_LABELS.key_term}
          </div>
          <div className='text-muted-foreground'>
            {keyTerms.map((t) => `${t.word} (${t.count})`).join(', ')}
          </div>
        </div>
      )}
      {keptWords.length > 0 && (
        <div>
          <div className='font-semibold mb-1'>
            <Swatch type='kept_word' /> {SPAN_LABELS.kept_word}
          </div>
          <div className='text-muted-foreground'>{keptWords.join(', ')}</div>
        </div>
      )}
      {protectedPhrases.length > 0 && (
        <div>
          <div className='font-semibold mb-1'>
            <Swatch type='mwe' /> {SPAN_LABELS.mwe}
          </div>
          <div className='text-muted-foreground'>{protectedPhrases.join(', ')}</div>
        </div>
      )}
    </div>
  );
}
