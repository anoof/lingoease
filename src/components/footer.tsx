'use client';

import { fetchStudyManifest, type StudyManifest } from '@/lib/studyData';
import { buildStudyUrl } from '@/lib/studyUrl';
import { useStore } from '@/store';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import Keyconfig from './keyconfig';
import Simplify from './simplify';
import { Button } from './ui/button';
import Upload from './upload';

export default function Footer() {
  const currentStep = useStore((state) => state.currentStep);
  const resetAll = useStore((state) => state.resetAll);
  const studyTalkId = useStore((state) => state.studyTalkId);

  const setStudyParams = useStore((state) => state.setStudyParams);

  if (studyTalkId) {
    return (
      <div className='flex w-full h-24 flex-col items-center justify-end'>
        <div className='mb-6 w-full px-6'>
          <StudyNavigation
            onExit={() => {
              resetAll();
              // Clear study state synchronously rather than relying on the
              // URL round-trip through StudyUrlSync to do it.
              setStudyParams(null, null);
            }}
          />
        </div>
      </div>
    );
  }

  const renederStepContent = () => {
    switch (currentStep) {
      case 0:
        return <SetAPIKey />;
      case 1:
        return <Upload />;
      case 2:
        return <Simplify />;
      case 3:
        return (
          <Button className='h-12 w-full' onClick={resetAll}>
            Start Over
          </Button>
        );
    }
  };

  return (
    <div className='flex w-full h-24 flex-col items-center justify-end'>
      <div className='mb-6 w-full px-6'>{renederStepContent()}</div>
    </div>
  );
}

function StudyNavigation({ onExit }: { onExit: () => void }) {
  const router = useRouter();
  const talkId = useStore((state) => state.studyTalkId);
  const level = useStore((state) => state.studyLevel);

  const [manifest, setManifest] = useState<StudyManifest | null>(null);

  useEffect(() => {
    fetchStudyManifest().then(setManifest).catch(() => setManifest(null));
  }, []);

  const talks = manifest?.talks ?? [];
  const index = talks.findIndex((t) => t.id === talkId);
  const canNavigate = index !== -1;

  const goTo = (offset: number) => {
    if (!canNavigate) return;
    const next = talks[(index + offset + talks.length) % talks.length];
    router.push(buildStudyUrl(next.id, level));
  };

  const exitStudyMode = () => {
    onExit();
    router.push('/');
  };

  return (
    <div className='flex flex-col gap-2 w-full'>
      <div className='flex gap-2 w-full'>
        <Button
          variant='outline'
          className='flex-1'
          disabled={!canNavigate}
          onClick={() => goTo(-1)}
        >
          <LuChevronLeft className='size-4' /> Previous
        </Button>
        <Button
          variant='outline'
          className='flex-1'
          disabled={!canNavigate}
          onClick={() => goTo(1)}
        >
          Next <LuChevronRight className='size-4' />
        </Button>
      </div>
      <Button className='h-12 w-full' onClick={exitStudyMode}>
        Start Over
      </Button>
    </div>
  );
}

function SetAPIKey() {
  return (
    <Keyconfig>
      <Button className='h-12 w-full'>Set API Key</Button>
    </Keyconfig>
  );
}
