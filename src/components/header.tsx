'use client';
import React from 'react';

import { useStore } from '@/store';
import { useRouter } from 'next/navigation';
import { LuArrowLeft } from 'react-icons/lu';
import { StudyTextsToggle } from './StudySidebar';
import { Button } from './ui/button';
import { Toaster } from './ui/sonner';

function BackToSimplifier() {
  const router = useRouter();
  const resetAll = useStore((state) => state.resetAll);
  const setStudyParams = useStore((state) => state.setStudyParams);

  return (
    <Button
      variant='outline'
      size='sm'
      className='gap-2'
      onClick={() => {
        resetAll();
        // Clear study state synchronously rather than relying on the
        // URL round-trip through StudyUrlSync to do it.
        setStudyParams(null, null);
        router.push('/');
      }}
    >
      <LuArrowLeft className='size-4' />
      Back to simplifier
    </Button>
  );
}

export default function Header() {
  const state = useStore();

  // Detect 'dev' query string and set development mode
  React.useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.has('dev') && state.setDevelopment) {
        state.setDevelopment(true);
      }
    }
  }, [state]);

  return (
    <div className='relative flex w-full h-36 flex-col items-center justify-end'>
      <Toaster />
      <div className='absolute left-4 top-4 flex items-center gap-2'>
        <StudyTextsToggle />
        {state.studyTalkId && <BackToSimplifier />}
      </div>
      <div className=''>
        <div className='text-4xl font-bold' onClick={() => console.log(state)}>
          LingoEase
        </div>
        <div className='flex flex-col items-center justify-center p-2 text-sm font-semibold'>
          <div>Powered by LexScaffold</div>
          <div className='text-xs font-normal text-muted-foreground mt-1'>Simplify Language</div>
          <div className='text-xs font-normal text-muted-foreground mt-1'>Amplify Understanding</div>
        </div>
      </div>
    </div>
  );
}
