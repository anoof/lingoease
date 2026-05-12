'use server';

import { analyzeChunks } from './utils';

const topK = 50;

export async function analyze(chunks: string[], wordFreq: 1000 | 2000) {
  return analyzeChunks(chunks, wordFreq);
}
