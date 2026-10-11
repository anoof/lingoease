'use client';

import { analyzeChunks } from '@/actions/llm/utils';
import { buildResultView } from '@/lib/resultView';
import { fetchStudyTalk, type StudyTalkFile } from '@/lib/studyData';
import { useStore } from '@/store';
import { useEffect, useMemo, useState } from 'react';
import { AnalyzedText, KeyTermsSection } from './resultParts';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Renders a Study Result — a precomputed Study Talk opened from the sidebar.
// Never calls the live backend. See CONTEXT.md.
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
    <div className='flex flex-col items-center justify-center w-full px-8 overscroll-none'>
      <ResultTabs talk={talk} />
    </div>
  );
}

function ResultTabs({ talk }: { talk: StudyTalkFile }) {
  const wordFreq = levelToWordFreq(talk.level);

  // analyzeChunks runs a full NLP pass — compute it once per talk, not on
  // every render (a mounted ResultTabs re-renders for reasons unrelated to
  // the talk itself, e.g. sidebar state).
  const view = useMemo(
    () =>
      buildResultView({
        source: 'study',
        simplifiedText: talk.simplified,
        wordFreq,
        keyTerms: talk.key_terms,
        keptWords: talk.kept_words,
      }),
    [talk, wordFreq]
  );

  const originalAnalyzed = useMemo(
    () => analyzeChunks([talk.original], wordFreq),
    [talk, wordFreq]
  );

  const layout = useStore((state) => state.studyLayout);
  const setLayout = useStore((state) => state.setStudyLayout);

  const toggle = (
    <Button
      variant='outline'
      size='sm'
      className='shrink-0'
      onClick={() => setLayout(layout === 'sideBySide' ? 'tabs' : 'sideBySide')}
    >
      {layout === 'sideBySide' ? 'Tabs' : 'Side by side'}
    </Button>
  );

  if (layout === 'sideBySide') {
    return (
      <div className='w-full h-full'>
        <div style={{ position: 'relative', paddingBottom: '0.5rem' }}>
          <div
            className='grid gap-4 text-center text-sm font-semibold'
            style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
          >
            <div style={COLUMN_LABEL}>Simplified</div>
            <div style={COLUMN_LABEL}>Original</div>
          </div>
          <div style={{ position: 'absolute', right: 0, top: '-0.25rem' }}>
            {toggle}
          </div>
        </div>
        <div
          className='grid gap-4'
          style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}
        >
          <div style={COLUMN_BOX}>
            <AnalyzedText chunks={view.simplifiedChunks} height={TEXT_HEIGHT} />
          </div>
          <div style={COLUMN_BOX}>
            <AnalyzedText
              chunks={originalAnalyzed.analyzedChunks}
              height={TEXT_HEIGHT}
            />
          </div>
        </div>
        <KeyTermsSection keyTerms={view.keyTerms} keptWords={view.keptWords} />
      </div>
    );
  }

  return (
    <Tabs defaultValue='simplified' className='w-full h-full'>
      <div className='flex items-center gap-2'>
        <TabsList className='flex-1'>
          <TabsTrigger value='simplified'>Simplified</TabsTrigger>
          <TabsTrigger value='original'>Original</TabsTrigger>
        </TabsList>
        {toggle}
      </div>
      <TabsContent
        value='simplified'
        forceMount
        className='data-[state=inactive]:hidden'
      >
        <div className='flex items-center justify-center flex-col'>
          <div className='flex flex-col text-md mb-4 flex-1 w-full gap-4'>
            <AnalyzedText chunks={view.simplifiedChunks} height={TEXT_HEIGHT} />
            <KeyTermsSection keyTerms={view.keyTerms} keptWords={view.keptWords} />
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value='original'
        forceMount
        className='data-[state=inactive]:hidden'
      >
        <div className='flex items-center justify-center flex-col'>
          <div className='flex flex-col text-md mb-4 flex-1 w-full gap-4'>
            <AnalyzedText
              chunks={originalAnalyzed.analyzedChunks}
              height={TEXT_HEIGHT}
            />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

// 6rem more than the shared default: the study footer is gone.
const TEXT_HEIGHT = 'calc(100dvh - 24rem)';

// Inline so they don't depend on Tailwind having scanned new classes.
const COLUMN_LABEL = { paddingBottom: '0.375rem' } as const;
const COLUMN_BOX = {
  border: '1px solid var(--border)',
  borderTop: '2px solid var(--muted-foreground)',
  borderRadius: '0.5rem',
  minWidth: 0,
} as const;

function levelToWordFreq(level: string): 1000 | 2000 | 3000 {
  if (level === '2k') return 2000;
  if (level === '3k') return 3000;
  return 1000;
}
