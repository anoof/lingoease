import { useStore } from '@/store';

import { useMemo } from 'react';
import {
  CoverageLine,
  HighlightedText,
  OriginalNote,
  WordListsSection,
} from './resultParts';
import AudioPlayer from './ui/audioPlayer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

// Renders a Live Result (a real /simplify call) — a Study Result renders
// through StudyResult instead. See CONTEXT.md. Highlights and coverage are the
// backend's; nothing is analysed here.
export default function SimplifiedResult() {
  const simplifiedResult = useStore((state) => state.simplifiedResult);
  return (
    <div className='flex flex-col items-center justify-center w-full px-8 overscroll-none'>
      {simplifiedResult && <ResultTabs />}
    </div>
  );
}

function ResultTabs() {
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
        <SimplifiedTabContent />
      </TabsContent>
      <TabsContent
        value='original'
        forceMount
        className='data-[state=inactive]:hidden'
      >
        <OriginalTabContent />
      </TabsContent>
    </Tabs>
  );
}

function SimplifiedTabContent() {
  const result = useStore((state) => state.simplifiedResult);
  if (!result) return null;

  return (
    <div className='flex items-center justify-center flex-col'>
      <CoverageLine coverage={result.coverage} />
      <div className='flex  flex-col text-md mb-4 flex-1 w-full gap-4'>
        {result.audio?.url && (
          <AudioPlayer
            src={result.audio.url}
            title='Simplified Audio'
            downloadUrl={result.audio.downloadUrl}
          />
        )}
        <HighlightedText text={result.simplified} spans={result.spans} style={LIVE_TEXT} />
        <WordListsSection
          keyTerms={result.keyTerms}
          keptWords={result.keptWords}
          protectedPhrases={result.protectedPhrases}
          spans={result.spans}
        />
      </div>
    </div>
  );
}

function OriginalTabContent() {
  const file = useStore((state) => state.file);
  const result = useStore((state) => state.simplifiedResult);
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  if (!result) return null;

  return (
    <div className='flex items-center justify-center flex-col'>
      {result.originalCoverage !== undefined && (
        <CoverageLine coverage={result.originalCoverage} />
      )}
      <div className='flex  flex-col text-md mb-4 flex-1 w-full gap-4'>
        {file && <AudioPlayer src={fileUrl} title={file.name} type={file.type} />}
        <HighlightedText text={result.original} spans={result.originalSpans} uniform style={LIVE_TEXT} />
        <OriginalNote spans={result.originalSpans} />
      </div>
    </div>
  );
}

// Same height as before the v8b layout change (the live view keeps its
// header, coverage line and audio player above the text).
const LIVE_TEXT = { height: 'calc(100dvh - 30rem)' } as const;
