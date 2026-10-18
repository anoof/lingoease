// Highlight spans come from the backend (LexScaffold v7+) — the frontend no
// longer decides which words are outside the word list. The pipeline computes
// them with the same family-aware lists it simplifies with, so what is
// highlighted is exactly what lowers the reported coverage.

import type { CSSProperties } from 'react';

export type SpanType = 'mwe' | 'proper_noun' | 'key_term' | 'kept_word' | 'oov';

export type Span = {
  start: number; // character offsets into the text the spans belong to
  end: number;
  text: string;
  type: SpanType;
};

// Display order of the legend; labels match the word-list section headings.
export const SPAN_TYPES: SpanType[] = [
  'oov',
  'key_term',
  'kept_word',
  'mwe',
  'proper_noun',
];

export const SPAN_LABELS: Record<SpanType, string> = {
  oov: 'Outside the word list',
  key_term: 'Key terms kept',
  kept_word: 'Words with no simple equivalent',
  mwe: 'Multi-word expressions protected',
  proper_noun: 'Names',
};

// Inline styles so they don't depend on Tailwind having scanned new classes.
// Each type differs in more than colour (weight, underline, background).
export const SPAN_STYLES: Record<SpanType, CSSProperties> = {
  oov: { color: '#f97316', fontWeight: 700 },
  key_term: { color: '#16a34a', fontWeight: 700 },
  kept_word: {
    color: '#9333ea',
    fontWeight: 700,
    textDecoration: 'underline dotted',
    textUnderlineOffset: '3px',
  },
  mwe: {
    backgroundColor: 'rgba(14, 165, 233, 0.14)',
    borderBottom: '2px solid #0ea5e9',
    borderRadius: '2px',
  },
  proper_noun: { color: 'var(--muted-foreground)', fontStyle: 'italic' },
};

export type Segment = { text: string; type?: SpanType };

// Split `text` into plain and highlighted segments. Spans that do not match
// the text (wrong offsets) or overlap an earlier span are skipped rather than
// shifting the rest of the text.
export function segmentsFromSpans(text: string, spans: Span[] = []): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  for (const s of [...spans].sort((a, b) => a.start - b.start)) {
    if (s.start < pos || s.end > text.length || text.slice(s.start, s.end) !== s.text) {
      continue;
    }
    if (s.start > pos) out.push({ text: text.slice(pos, s.start) });
    out.push({ text: s.text, type: s.type });
    pos = s.end;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}

export function spanTypesPresent(spans: Span[] = []): SpanType[] {
  const present = new Set(spans.map((s) => s.type));
  return SPAN_TYPES.filter((t) => present.has(t));
}
