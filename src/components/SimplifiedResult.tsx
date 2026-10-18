import { useStore } from '@/store';

import { useMemo, useState, type CSSProperties } from 'react';
import {
  CoverageLine,
  HighlightedText,
  OriginalNote,
  WordListsSection,
} from './resultParts';
import AudioPlayer from './ui/audioPlayer';
import { Tabs, TabsList, TabsTrigger } from './ui/tabs';

// Renders a Live Result (a real /simplify call) — a Study Result renders
// through StudyResult instead. See CONTEXT.md. Highlights and coverage are the
// backend's; nothing is analysed here.
//
// Same layout as StudyResult: fills the space under the header; the coverage
// line and audio player keep their size, the text box takes what is left and
// is the only thing that scrolls (the page itself never does). Inline styles
// so the sizing doesn't depend on Tailwind having scanned new classes.
export default function SimplifiedResult() {
  const result = useStore((state) => state.simplifiedResult);
  if (!result) return null;
  return (
    <div style={FILL_COLUMN_PADDED}>
      <ResultTabs />
    </div>
  );
}

type Tab = 'simplified' | 'original';

function ResultTabs() {
  const result = useStore((state) => state.simplifiedResult);
  const file = useStore((state) => state.file);
  const fileUrl = useMemo(() => (file ? URL.createObjectURL(file) : ''), [file]);
  const [tab, setTab] = useState<Tab>('simplified');
  if (!result) return null;

  // Both tabs stay mounted (hidden when inactive) so each keeps its scroll
  // position and audio state when switching.
  const show = (t: Tab): CSSProperties => ({ display: tab === t ? 'flex' : 'none' });

  return (
    <div style={FILL_COLUMN}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className='w-full'>
        <TabsList className='w-full'>
          <TabsTrigger value='simplified'>Simplified</TabsTrigger>
          <TabsTrigger value='original'>Original</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Simplified */}
      <div style={{ ...TAB_PANEL, ...show('simplified') }}>
        <div style={FIXED}>
          <CoverageLine coverage={result.coverage} />
          {result.audio?.url && (
            <AudioPlayer
              src={result.audio.url}
              title='Simplified Audio'
              downloadUrl={result.audio.downloadUrl}
            />
          )}
        </div>
        <div style={TEXT_BOX}>
          <HighlightedText text={result.simplified} spans={result.spans} style={FILL} />
        </div>
        <WordListsSection
          keyTerms={result.keyTerms}
          keptWords={result.keptWords}
          protectedPhrases={result.protectedPhrases}
          spans={result.spans}
          style={LISTS}
        />
      </div>

      {/* Original: every word outside the word list in one style */}
      <div style={{ ...TAB_PANEL, ...show('original') }}>
        <div style={FIXED}>
          {result.originalCoverage !== undefined && (
            <CoverageLine coverage={result.originalCoverage} />
          )}
          {file && <AudioPlayer src={fileUrl} title={file.name} type={file.type} />}
        </div>
        <div style={TEXT_BOX}>
          <HighlightedText
            text={result.original}
            spans={result.originalSpans}
            uniform
            style={FILL}
          />
        </div>
        <OriginalNote spans={result.originalSpans} style={LISTS} />
      </div>
    </div>
  );
}

const FILL: CSSProperties = { flex: 1, minHeight: 0 };
const FILL_COLUMN: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: 0,
  width: '100%',
  gap: '0.5rem',
};
const FILL_COLUMN_PADDED: CSSProperties = { ...FILL_COLUMN, padding: '0 2rem 1rem' };
const TAB_PANEL: CSSProperties = { ...FILL_COLUMN };
const FIXED: CSSProperties = {
  flexShrink: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: '0.5rem',
};
const TEXT_BOX: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  minHeight: '8rem', // never squeezed to nothing on a short window
  border: '1px solid var(--border)',
  borderTop: '2px solid var(--muted-foreground)',
  borderRadius: '0.5rem',
};
// The word lists never push the page into scrolling: capped, with their own scroll.
const LISTS: CSSProperties = { flexShrink: 0, maxHeight: '25%', overflowY: 'auto' };
