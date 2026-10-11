import type { KeyTerm } from '@/store/typing';

export type StudyManifest = {
  engine_version: string;
  generated: string;
  level_labels: Record<string, string>;
  variants: Record<string, { config_id: string; levels: Record<string, string> }>;
  talks: {
    id: string;
    number: number;
    title: string;
    source_url: string;
    preview: string;
  }[];
};

export type StudyTalkFile = {
  talk_id: string;
  original: string;
  simplified: string;
  coverage: number;
  level: string;
  key_terms?: KeyTerm[];
  kept_words?: string[];
  protected_phrases?: string[];
  coverage_key_terms_known?: number;
  stats?: Record<string, number>;
  engine_version: string;
  config_id: string;
  run: string;
  cached?: boolean;
};

// Fixed per deployment — no in-app switch (FRONTEND_BRIEF.md change 4).
export function getStudyVariant(): string {
  return process.env.NEXT_PUBLIC_STUDY_VARIANT || 'key_terms_on';
}

// Sidebar and footer both need this; memoize so opening a talk doesn't
// trigger a second, identical request.
let manifestPromise: Promise<StudyManifest> | null = null;

export function fetchStudyManifest(): Promise<StudyManifest> {
  if (!manifestPromise) {
    manifestPromise = fetch('/study/manifest.json').then((res) => {
      if (!res.ok) {
        manifestPromise = null;
        throw new Error(`Failed to load study manifest: ${res.status}`);
      }
      return res.json();
    });
  }
  return manifestPromise;
}

export async function fetchStudyTalk(
  level: string,
  talkId: string
): Promise<StudyTalkFile> {
  const variant = getStudyVariant();
  const res = await fetch(`/study/${variant}/${level}/${talkId}.json`);
  if (!res.ok) {
    throw new Error(`Failed to load study talk ${talkId} at ${level}: ${res.status}`);
  }
  return res.json();
}

// Levels with precomputed data for the active variant, in the manifest's own
// key order (e.g. 1k, 2k, 3k — 3k only once that data exists).
export function availableStudyLevels(manifest: StudyManifest): string[] {
  const variant = getStudyVariant();
  return Object.keys(manifest.variants[variant]?.levels ?? {});
}
