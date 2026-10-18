'use client';

import { buildResultView } from '@/lib/resultView';
import { fetchStudyTalk, type StudyTalkFile } from '@/lib/studyData';
import { useStore } from '@/store';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { HighlightedText, OriginalNote, WordListsSection } from './resultParts';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

// Renders a Study Result — a precomputed Study Talk opened from the sidebar.
// Never calls the live backend. See CONTEXT.md.
//
// Layout: fills the space under the header; only the text box scrolls (the
// page itself never does). Inline styles so the sizing doesn't depend on
// Tailwind having scanned new classes.
export default function StudyResult() {
  const talkId = useStore((state) => state.studyTalkId);
  const level = useStore((state) => state.studyLevel);

  const [talk, setTalk] = useState<StudyTalkFile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setTalk(null);
    setError(null);
    if (!talkId || !level) return;
    let cancelled = false;
    fetchStudyTalk(level, talkId)
      .then((t) => {
        if (!cancelled) setTalk(t);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [talkId, level]);

  if (error) {
    return (
      <div className='w-full px-8 py-4 text-center text-destructive'>
        {error}
      </div>
    );
  }

  if (!talk) {
    return (
      <div className='w-full px-8 py-4 text-center text-muted-foreground'>
        Loading…
      </div>
    );
  }

  return (
    <div style={FILL_COLUMN_PADDED}>
      <ResultTabs talk={talk} />
    </div>
  );
}

type Tab = 'simplified' | 'original';

function ResultTabs({ talk }: { talk: StudyTalkFile }) {
  // Highlights come precomputed in the talk file (pipeline spans) — nothing
  // is analysed here.
  const view = useMemo(
    () => buildResultView({ source: 'study', data: talk }),
    [talk]
  );
  const [tab, setTab] = useState<Tab>('simplified');

  // Both texts stay mounted (hidden when inactive) so each keeps its scroll
  // position when switching tabs.
  return (
    <div style={FILL_COLUMN}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className='w-full'>
        <TabsList className='w-full'>
          <TabsTrigger value='simplified'>Simplified</TabsTrigger>
          <TabsTrigger value='original'>Original</TabsTrigger>
        </TabsList>
      </Tabs>

      <div style={{ ...TEXT_BOX, display: tab === 'simplified' ? 'flex' : 'none' }}>
        <HighlightedText text={view.simplified} spans={view.spans} style={{ flex: 1, minHeight: 0 }} />
      </div>
      <div style={{ ...TEXT_BOX, display: tab === 'original' ? 'flex' : 'none' }}>
        <HighlightedText
          text={view.original}
          spans={view.originalSpans}
          uniform
          style={{ flex: 1, minHeight: 0 }}
        />
      </div>

      {tab === 'simplified' ? (
        <WordListsSection
          keyTerms={view.keyTerms}
          keptWords={view.keptWords}
          protectedPhrases={view.protectedPhrases}
          spans={view.spans}
          style={LISTS}
        />
      ) : (
        <OriginalNote spans={view.originalSpans} style={LISTS} />
      )}
    </div>
  );
}

const FILL_COLUMN: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  width: '100%',
  gap: '0.5rem',
};
const FILL_COLUMN_PADDED: CSSProperties = { ...FILL_COLUMN, padding: '0 2rem 1rem' };
const TEXT_BOX: CSSProperties = {
  flex: 1,
  minHeight: 0,
  flexDirection: 'column',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
};
// The word lists never push the page into scrolling: capped, with their own scroll.
const LISTS: CSSProperties = { flexShrink: 0, maxHeight: '35%', overflowY: 'auto' };
