'use server';

import { cookies } from 'next/headers';

const LEXSCAFFOLD_URL = process.env.LEXSCAFFOLD_URL ?? 'https://anoof-lexscaffold.hf.space';

export async function simplify(
  chunks: { text: string; newWords: string[] }[],
  level: '1k' | '2k'
): Promise<string[]> {
  const apiKey = (await cookies()).get('api-key')?.value;

  if (!apiKey) {
    throw new Error('Cannot get API key');
  }

  const text = chunks.map((c) => c.text).join(' ');

  const response = await fetch(`${LEXSCAFFOLD_URL}/simplify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, level, api_key: apiKey }),
  });

  if (!response.ok) {
    throw new Error(`LexScaffold error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json() as { simplified: string; coverage: number; level: string };

  return [data.simplified];
}