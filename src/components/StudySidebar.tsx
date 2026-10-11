'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  availableStudyLevels,
  fetchStudyManifest,
  type StudyManifest,
} from '@/lib/studyData';
import { buildStudyUrl } from '@/lib/studyUrl';
import { useStore } from '@/store';
import clsx from 'clsx';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LuBookOpen, LuX } from 'react-icons/lu';

export function StudyTextsToggle() {
  const open = useStore((state) => state.studySidebarOpen);
  const setOpen = useStore((state) => state.setStudySidebarOpen);

  return (
    <Button
      variant='outline'
      size='sm'
      className='gap-2'
      onClick={() => setOpen(!open)}
    >
      <LuBookOpen className='size-4' />
      Study texts
    </Button>
  );
}

export function StudySidebarPanel() {
  const open = useStore((state) => state.studySidebarOpen);
  const setOpen = useStore((state) => state.setStudySidebarOpen);
  const studyTalkId = useStore((state) => state.studyTalkId);
  const studyLevel = useStore((state) => state.studyLevel);
  const router = useRouter();

  const [manifest, setManifest] = useState<StudyManifest | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  useEffect(() => {
    fetchStudyManifest().then(setManifest).catch(() => setManifest(null));
  }, []);

  // A direct link can set the level from the URL —
  // keep the sidebar's own selection in step with it.
  useEffect(() => {
    if (studyLevel) setSelectedLevel(studyLevel);
  }, [studyLevel]);

  const levels = manifest ? availableStudyLevels(manifest) : [];
  const effectiveLevel = selectedLevel ?? levels[0] ?? null;

  const openTalk = (talkId: string) => {
    router.push(buildStudyUrl(talkId, effectiveLevel ?? levels[0] ?? '1k'));
  };

  const changeLevel = (level: string) => {
    setSelectedLevel(level);
    if (studyTalkId) {
      router.push(buildStudyUrl(studyTalkId, level));
    }
  };

  return (
    <>
      {open && (
        <div
          className='fixed inset-0 bg-black/30 z-40 md:hidden'
          onClick={() => setOpen(false)}
        />
      )}
      <aside
        className={clsx(
          'h-dvh overflow-hidden border-r bg-background transition-[width] duration-200 fixed inset-y-0 left-0 z-50 md:static md:z-auto',
          open ? 'w-80' : 'w-0'
        )}
      >
        <div className='w-80 h-full flex flex-col'>
          <div className='flex items-center justify-between p-4 border-b'>
            <span className='font-bold'>Study texts</span>
            <Button variant='ghost' size='icon' onClick={() => setOpen(false)}>
              <LuX className='size-4' />
            </Button>
          </div>

          {levels.length > 0 && (
            <div className='flex flex-col gap-2 p-4 border-b'>
              <Label className='text-sm font-bold'>Level</Label>
              <RadioGroup
                className='flex flex-row flex-wrap items-center gap-2'
                value={effectiveLevel ?? undefined}
                onValueChange={changeLevel}
              >
                {levels.map((lvl) => {
                  const id = `study-level-${lvl}`;
                  const selected = effectiveLevel === lvl;
                  return (
                    <div key={lvl} className='flex items-center'>
                      <RadioGroupItem id={id} value={lvl} className='sr-only' />
                      <Label
                        htmlFor={id}
                        className={clsx(
                          'cursor-pointer select-none rounded-md border px-3 py-1 text-sm transition-colors',
                          selected
                            ? 'bg-black text-white border-black'
                            : 'bg-transparent text-foreground border-input hover:bg-muted'
                        )}
                      >
                        {manifest?.level_labels[lvl] ?? lvl}
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>
          )}

          <ScrollArea className='flex-1 min-h-0'>
            <ul className='flex flex-col'>
              {manifest?.talks.map((talk) => {
                const isOpen = talk.id === studyTalkId;
                return (
                  <li key={talk.id}>
                    <button
                      onClick={() => openTalk(talk.id)}
                      className={clsx(
                        'w-full text-left px-4 py-3 border-b text-sm transition-colors cursor-pointer',
                        isOpen ? 'bg-muted font-semibold' : 'hover:bg-muted/50'
                      )}
                    >
                      {talk.number}. {talk.title || talk.preview}
                    </button>
                  </li>
                );
              })}
            </ul>
          </ScrollArea>
        </div>
      </aside>
    </>
  );
}
