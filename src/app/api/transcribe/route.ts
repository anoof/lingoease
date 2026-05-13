export const runtime = 'nodejs';

import { cookies } from 'next/headers';
import OpenAI from 'openai';

export async function POST(request: Request) {
  try {
    const apiKey = (await cookies()).get('api-key')?.value;
    if (!apiKey) throw new Error('Cannot get API key');

    const { blobUrl, filename } = await request.json() as { blobUrl: string; filename: string };

    const fileResp = await fetch(blobUrl);
    const buffer = await fileResp.arrayBuffer();
    const file = new File([buffer], filename, { type: fileResp.headers.get('content-type') ?? 'audio/mp4' });

    const client = new OpenAI({ apiKey });
    const transcriptionResp = await client.audio.transcriptions.create({
      model: 'gpt-4o-mini-transcribe',
      file,
    });

    return Response.json({ ok: true, text: transcriptionResp.text, error: '' });
  } catch (error) {
    return Response.json({ ok: false, text: '', error: (error as Error).message });
  }
}