import { handleUpload } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export async function POST(request) {
  // Cek apakah request berisi JSON body (untuk handleUpload)
  // Jika request body tidak bisa di-parse sebagai JSON, lewati
  let body;
  try {
    body = await request.json();
  } catch (e) {
    // Bukan request upload token, abaikan
    return new Response('Not an upload request', { status: 400 });
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        // 1. Auth (Opsional)
        // const session = await auth();
        // if (!session) throw new Error('Unauthorized');

        return {
          // Hanya izinkan file audio/video
          allowedContentTypes: [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 
            'video/mp4', 'video/webm'
          ],
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({
            uploadedAt: new Date().toISOString(),
            // userId: session?.user?.id
          }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // 2. Jalankan setelah upload selesai
        console.log('blob upload completed', blob, tokenPayload);
        
        // Opsional: Simpan info file ke Database kamu di sini
        // await db.collection('uploads').add({ url: blob.url, ... });
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 400 } // Status 400 agar webhook tidak retry terus
    );
  }
}
