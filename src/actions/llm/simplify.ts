'use server';

import { cookies } from 'next/headers';
import type { KeyTerm } from '@/store/typing';

const LEXSCAFFOLD_URL = process.env.LEXSCAFFOLD_URL ?? 'https://anoof-lexscaffold.hf.space';

export type SimplifyResponse = {
  simplified: string;
  coverage: number;
  level: string;
  key_terms?: KeyTerm[];
  kept_words?: string[];
  protected_phrases?: string[];
  coverage_key_terms_known?: number;
  stats?: Record<string, number>;
  engine_version?: string;
  config_id?: string;
  cached?: boolean;
};

export async function simplify(
  chunks: { text: string; newWords: string[] }[],
  level: '1k' | '2k' | '3k'
): Promise<SimplifyResponse> {
  const apiKey = (await cookies()).get('api-key')?.value;

  if (!apiKey) {
    throw new Error('Cannot get API key');
  }

  const text = chunks.map((c) => c.text).join(' ');

  // This call runs as a Next.js Server Action on Vercel (not a Route Handler),
  // so it shares the project's function-duration ceiling. No maxDuration
  // override is set here — see CONTEXT.md / FRONTEND_BRIEF.md change 2.
  const response = await fetch(`${LEXSCAFFOLD_URL}/simplify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, level, api_key: apiKey }),
  });

  if (!response.ok) {
    throw new Error(`LexScaffold error: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as SimplifyResponse;
}