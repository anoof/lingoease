// ...existing code...
'use server';

import { timeId } from '@/lib/utils';
import { put } from '@vercel/blob';
import OpenAI from 'openai';
import { cookies } from 'next/headers';

import type { OutputOptions } from '@/store/typing';

export async function tts(
  content: string,
  opts: Pick<OutputOptions, 'voice' | 'style'>
) {
  
  const apiKey = (await cookies()).get('api-key')?.value;
  if (!apiKey) throw new Error('Cannot get API key');

  const openai = new OpenAI({ apiKey });
  const startTtsTime = performance.now();

  const mp3Response = await openai.audio.speech.create({
    model: 'gpt-4o-mini-tts',
    voice: opts.voice,
    speed: 1,
    instructions: opts.style.instruction,
    input: content,
    response_format: 'mp3',
    stream_format: 'audio',
  });

  const ttsTime = (performance.now() - startTtsTime) / 1000;
  console.log(`TTS took ${ttsTime.toFixed(2)} seconds`);

  if (mp3Response.body) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      const buffer = Buffer.from(await new Response(mp3Response.body).arrayBuffer());
      const dataUrl = `data:audio/mp3;base64,${buffer.toString('base64')}`;
      return { url: dataUrl, downloadUrl: dataUrl };
    }
    console.log('TTS response received, uploading to blob storage...');
    const putStartTime = performance.now();
    const path = `lingoease-simplified-${timeId()}.mp3`;

    const { url, downloadUrl } = await put(path, mp3Response.body, {
      access: 'public',
    });

    const putTime = (performance.now() - putStartTime) / 1000;
    console.log(
      `Uploaded speech.mp3 to ${url} in ${putTime.toFixed(2)} seconds`
    );
    return { url, downloadUrl };
  }
}
