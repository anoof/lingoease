'use client';

import { analyzeChunks } from '@/actions/llm/utils';
import { buildResultView } from '@/lib/resultView';
import { fetchStudyTalk, type StudyTalkFile } from '@/lib/studyData';
import { useStore } from '@/store';
import { useEffect, useState } from 'react';
import {
  AnalyzedText,
  Attribution,
  CoverageLine,
  KeyTermsSection,
} from './resultParts';
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

  const view = buildResultView({
    source: 'study',
    simplifiedText: talk.simplified,
    wordFreq,
    keyTerms: talk.key_terms,
    keptWords: talk.kept_words,
    talkId: talk.talk_id,
    engineVersion: talk.engine_version,
    configId: talk.config_id,
    run: talk.run,
  });

  const originalAnalyzed = analyzeChunks([talk.original], wordFreq);

  return (
    <Tabs defaultValue='simplified' className='w-full h-full'>
      <TabsList className='w-full'>
        <TabsTrigger value='simplified'>Simplified</TabsTrigger>
        <TabsTrigger value='original'>Original</TabsTrigger>
      </TabsList>
      <TabsContent
        value='simplified'
        forceMount
        className='data-[state=inactive]:hidden'
      >
        <div className='flex items-center justify-center flex-col'>
          <CoverageLine newWordsRate={view.newWordsRate} />
          <div className='flex flex-col text-md mb-4 flex-1 w-full gap-4'>
            <AnalyzedText chunks={view.simplifiedChunks} />
            <KeyTermsSection keyTerms={view.keyTerms} keptWords={view.keptWords} />
            {view.attribution && <Attribution attribution={view.attribution} />}
          </div>
        </div>
      </TabsContent>
      <TabsContent
        value='original'
        forceMount
        className='data-[state=inactive]:hidden'
      >
        <div className='flex items-center justify-center flex-col'>
          <CoverageLine newWordsRate={originalAnalyzed.newWordsRate} />
          <div className='flex flex-col text-md mb-4 flex-1 w-full gap-4'>
            <AnalyzedText chunks={originalAnalyzed.analyzedChunks} />
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

function levelToWordFreq(level: string): 1000 | 2000 | 3000 {
  if (level === '2k') return 2000;
  if (level === '3k') return 3000;
  return 1000;
}
