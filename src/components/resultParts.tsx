import Highlighter, { HighlighterProps } from 'react-highlight-words';
import type { ResultView } from '@/lib/resultView';

export function Highlight({ children }: HighlighterProps) {
  return (
    <strong className='highlighted-text text-orange-500'>{children}</strong>
  );
}

export function AnalyzedText({
  chunks,
}: {
  chunks: {
    text: string;
    lemmasOriginalWordsMap: Map<string, string>;
    newWords: string[];
  }[];
}) {
  return (
    <div className='h-[calc(100dvh-30rem)] w-full rounded-md p-4 overflow-y-auto overscroll-none'>
      {chunks.map(({ text, newWords, lemmasOriginalWordsMap }, index) => (
        <div className='mb-6 select-text' key={index}>
          <Highlighter
            highlightClassName='YourHighlightClass'
            searchWords={newWords.map(
              (word) =>
                new RegExp(`\\b${lemmasOriginalWordsMap.get(word) ?? ''}\\b`, 'i')
            )}
            autoEscape={false}
            textToHighlight={text}
            highlightTag={Highlight}
          />
        </div>
      ))}
    </div>
  );
}

export function CoverageLine({ newWordsRate }: { newWordsRate: string }) {
  return (
    <div className='flex w-full items-center justify-center py-2 px-4'>
      Vocabulary Coverage:{' '}
      <span className='font-bold'>{(1 - Number(newWordsRate)) * 100}%</span>
    </div>
  );
}

// Below the text, above Start Over — hidden entirely when both lists are
// empty (FRONTEND_BRIEF.md change 3).
export function KeyTermsSection({
  keyTerms,
  keptWords,
}: {
  keyTerms: ResultView['keyTerms'];
  keptWords: ResultView['keptWords'];
}) {
  if (keyTerms.length === 0 && keptWords.length === 0) return null;

  return (
    <div className='w-full flex flex-col gap-3 px-4 py-3 text-sm border-t'>
      {keyTerms.length > 0 && (
        <div>
          <div className='font-semibold mb-1'>Key terms kept</div>
          <div className='text-muted-foreground'>
            {keyTerms.map((t) => `${t.word} (${t.count})`).join(', ')}
          </div>
        </div>
      )}
      {keptWords.length > 0 && (
        <div>
          <div className='font-semibold mb-1'>
            Words with no simple equivalent
          </div>
          <div className='text-muted-foreground'>{keptWords.join(', ')}</div>
        </div>
      )}
    </div>
  );
}
