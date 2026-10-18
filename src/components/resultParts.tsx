import {
  SPAN_LABELS,
  SPAN_STYLES,
  segmentsFromSpans,
  spanTypesPresent,
  type Span,
  type SpanType,
} from '@/lib/highlight';
import type { ResultView } from '@/lib/resultView';
import { useMemo, type CSSProperties } from 'react';

// Renders `text` with the backend's highlight spans. `uniform` shows every
// span in the "outside the word list" style (used for the original text,
// where the categories of the simplified text don't apply). Without spans
// (an older backend) the text is shown plain.
//
// The box scrolls on its own; size it from the parent (`style`), e.g. flex: 1
// inside a column that fills the screen.
export function HighlightedText({
  text,
  spans,
  uniform = false,
  style,
}: {
  text: string;
  spans: Span[];
  uniform?: boolean;
  style?: CSSProperties;
}) {
  const segments = useMemo(() => segmentsFromSpans(text, spans), [text, spans]);

  return (
    <div
      className='w-full min-w-0 select-text overscroll-contain'
      style={{ overflowY: 'auto', padding: '1rem', lineHeight: 1.7, ...style }}
    >
      {segments.map((seg, i) => {
        if (!seg.type) return <span key={i}>{seg.text}</span>;
        const type: SpanType = uniform ? 'oov' : seg.type;
        return (
          <span
            key={i}
            className='highlighted-text'
            data-span-type={type}
            title={SPAN_LABELS[type]}
            style={SPAN_STYLES[type]}
          >
            {seg.text}
          </span>
        );
      })}
    </div>
  );
}

// A label written in its own highlight style — the legend is the labels
// themselves (no separate swatches).
export function StyledLabel({ type, children }: { type: SpanType; children?: React.ReactNode }) {
  return <span style={SPAN_STYLES[type]}>{children ?? SPAN_LABELS[type]}</span>;
}

export function CoverageLine({ coverage }: { coverage: number }) {
  return (
    <div className='flex w-full items-center justify-center py-2 px-4'>
      Vocabulary Coverage:{' '}
      <span className='font-bold'>{(coverage * 100).toFixed(1)}%</span>
    </div>
  );
}

const SECTION: CSSProperties = {
  width: '100%',
  display: 'flex',
  flexDirection: 'column',
  gap: '0.75rem',
  padding: '0.75rem 1rem',
  fontSize: '0.875rem',
  borderTop: '1px solid var(--border)',
};
const HEADING: CSSProperties = { fontWeight: 600, marginBottom: '0.25rem' };
const MUTED: CSSProperties = { color: 'var(--muted-foreground)' };

// Below the simplified text. Each heading is styled like the highlight it
// explains, so it doubles as the legend. Types without a list (outside the
// word list, names) get one "Also marked" line, only if they occur.
export function WordListsSection({
  keyTerms,
  keptWords,
  protectedPhrases,
  spans,
  style,
}: {
  keyTerms: ResultView['keyTerms'];
  keptWords: ResultView['keptWords'];
  protectedPhrases: ResultView['protectedPhrases'];
  spans: Span[];
  style?: CSSProperties;
}) {
  const present = new Set(spanTypesPresent(spans));
  const others = (['oov', 'proper_noun'] as SpanType[]).filter((t) => present.has(t));
  const lists: { type: SpanType; items: string[] }[] = [
    { type: 'key_term', items: keyTerms.map((t) => `${t.word} (${t.count})`) },
    { type: 'kept_word', items: keptWords },
    { type: 'mwe', items: protectedPhrases },
  ];
  const shown = lists.filter((l) => l.items.length > 0);
  if (shown.length === 0 && others.length === 0) return null;

  return (
    <div style={{ ...SECTION, ...style }}>
      {shown.map(({ type, items }) => (
        <div key={type}>
          <div style={HEADING}>
            <StyledLabel type={type} />
          </div>
          <div style={MUTED}>{items.join(', ')}</div>
        </div>
      ))}
      {others.length > 0 && (
        <div style={MUTED}>
          Also marked:{' '}
          {others.map((t, i) => (
            <span key={t}>
              {i > 0 && ' · '}
              <StyledLabel type={t} />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Below the original text: one style only.
export function OriginalNote({ spans, style }: { spans: Span[]; style?: CSSProperties }) {
  if (spans.length === 0) return null;
  return (
    <div style={{ ...SECTION, ...MUTED, ...style }}>
      <div>
        Words <StyledLabel type='oov'>outside the word list</StyledLabel> for this level are marked.
      </div>
    </div>
  );
}
