import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request: Request): Promise<NextResponse> {
  const body = (await request.json()) as HandleUploadBody;
  const jsonResponse = await handleUpload({
    body,
    request,
    onBeforeGenerateToken: async () => ({
      allowedContentTypes: [
        'audio/mp4', 'video/mp4', 'audio/mpeg', 'audio/mp3',
        'audio/wav', 'audio/ogg', 'audio/webm', 'video/webm',
        'audio/x-m4a', 'audio/flac', 'audio/m4a',
      ],
      addRandomSuffix: true,
    }),
    onUploadCompleted: async () => {},
  });
  return NextResponse.json(jsonResponse);
}