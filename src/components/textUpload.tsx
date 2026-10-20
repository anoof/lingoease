'use client';

import { segment } from '@/actions/llm/segment';
import { simplify } from '@/actions/llm/simplify';
import { tts } from '@/actions/llm/tts';
import { buildResultView } from '@/lib/resultView';
import { useStore } from '@/store';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import AudioOptions from './AudioOptions';
import { Button } from './ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from './ui/drawer';
import { Textarea } from './ui/textarea';

export default function TextUpload({
  children,
}: {
  children: React.ReactNode;
}) {
  const wordFreq = useStore((state) => state.outputOptions.level.wordFreq) as
    | 1000
    | 2000
    | 3000;
  const voice = useStore((state) => state.outputOptions.voice);
  const style = useStore((state) => state.outputOptions.style);

  const content = useStore((state) => state.content);
  const setContent = useStore((state) => state.setContent);
  const setSimplifiedResult = useStore((state) => state.setSimplifiedResult);
  const updateCurrentStep = useStore((state) => state.updateCurrentStep);
  const setSimplificationProgress = useStore(
    (state) => state.setSimplificationProgress
  );
  // const setOriginalChunks = useStore((state) => state.setOriginalChunks);
  // const contextWindowSize = useStore((state) => state.contextWindowSize);

  const [simplifying, startSimplifyTransition] = useTransition();

  const [isOpen, setIsOpen] = useState(false);

  const startSimplify = () => {
    updateCurrentStep();
    setIsOpen(false);
    startSimplifyTransition(async () => {
      // const transcription = await transcribe(fileUrl);
      try {
        setSimplificationProgress('Segmenting the scripts...');

        const chunks = await segment(content);

        console.log('chunks:');
        console.log('------------- chunks ------------- ');
        console.log(chunks);

        const lexLevel =
          wordFreq === 1000 ? '1k' : wordFreq === 2000 ? '2k' : '3k';

        // Analyze the chunks
        // const analysisRes = await analyzeAndFindCandidateWords(
        //   chunks,
        //   wordFreq
        // );
        // console.log('------------- analysis ------------- ');
        // console.log(analysisRes);

        // setOriginalChunks(analysisRes.analyzedChunks);

        setSimplificationProgress('Simplifying the scripts...');
        const simplifyResp = await simplify(
          chunks.map((text) => ({ text, newWords: [] })),
          lexLevel
        );
        console.log('------------- simplified ------------- ');
        console.log(simplifyResp);

        setSimplificationProgress('Generating audio...');

        const ttsResp = await tts(simplifyResp.simplified, { voice, style });

        if (!ttsResp) {
          console.error('TTS failed');
          toast.error('TTS failed');
          return;
        }

        const { url, downloadUrl } = ttsResp;

        setSimplificationProgress('');

        const view = buildResultView({
          source: 'live',
          data: simplifyResp,
          original: chunks.join(' '),
          audio: { url, downloadUrl },
        });

        setIsOpen(false);
        setSimplifiedResult(view);
        updateCurrentStep();
      } catch (error) {
        console.error('Error during simplification:', error);
        // Include stack if available for more detail
        const description = (error as Error)?.message ?? String(error);
        const stack = (error as Error)?.stack;
        toast.error('Error during simplification', {
          description: stack ? `${description}\n\n${stack}` : description,
        });
      }
    });
  };

  return (
    <Drawer onOpenChange={setIsOpen} open={isOpen}>
      <DrawerTrigger className='cursor-pointer' asChild>
        {children}
      </DrawerTrigger>
      {/* Fixed height: the text box takes what's left and scrolls inside
          itself, so the options and the Simplify button stay on screen however
          long the pasted text is. Inline styles so the sizing doesn't depend
          on Tailwind having scanned new classes. */}
      <DrawerContent style={{ height: '85dvh', maxHeight: '85dvh' }}>
        <DrawerHeader style={{ flexShrink: 0 }}>
          <DrawerTitle className='flex items-center justify-center gap-2'>
            Upload Text
          </DrawerTitle>
          <DrawerDescription></DrawerDescription>
        </DrawerHeader>
        <div
          className='flex flex-col px-8'
          style={{ flex: 1, minHeight: '6rem' }}
        >
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder='Type your text here...'
            // The shared Textarea grows with its content (field-sizing:
            // content); here it must stay the size of its box and scroll.
            style={TEXT_INPUT}
          />
        </div>
        <div style={{ flexShrink: 0 }}>
          <AudioOptions />
        </div>

        <DrawerFooter className='px-8' style={{ flexShrink: 0 }}>
          <Button disabled={!content || simplifying} onClick={startSimplify}>
            {simplifying ? (
              <span className='loading loading-dots loading-xs'></span>
            ) : (
              'Simplify'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

const TEXT_INPUT = {
  fieldSizing: 'fixed',
  flex: 1,
  minHeight: 0,
  height: '100%',
  overflowY: 'auto',
  resize: 'none',
} as React.CSSProperties;
