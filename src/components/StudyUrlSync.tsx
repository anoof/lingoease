'use client';

import { useStore } from '@/store';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

// The only component that reads useSearchParams() — mirrors `?talk=&level=`
// into the store so the rest of the app doesn't each need their own Suspense
// boundary. Writing the URL (sidebar clicks, Back to simplifier) goes
// through next/navigation's useRouter() directly, which doesn't need one.
export default function StudyUrlSync() {
  const searchParams = useSearchParams();
  const setStudyParams = useStore((state) => state.setStudyParams);

  useEffect(() => {
    const talk = searchParams.get('talk');
    const level = searchParams.get('level');
    // A direct link with a talk but no level (e.g. hand-shared) still needs
    // to resolve to something fetchable — default to Elementary rather than
    // leaving studyLevel null and stalling StudyResult on "Loading…" forever.
    setStudyParams(talk, talk ? (level ?? '1k') : null);
  }, [searchParams, setStudyParams]);

  return null;
}
