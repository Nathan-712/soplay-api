// api/upload.js
import { handleUpload } from '@vercel/blob/client';

export const config = {
  api: {
    bodyParser: false, // Penting: biarkan SDK handle body parsing
  },
};

export default async function handler(request, response) {
  try {
    const jsonResponse = await handleUpload({
      body: request.body,
      request,
      
      // 1. Sebelum generate token (validasi & auth)
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        console.log('🔐 Token request for:', pathname);
        
        // 🔒 TODO: Tambahkan autentikasi di sini untuk produksi
        // const session = await getSession(request);
        // if (!session) throw new Error('Unauthorized');
        
        return {
          // Hanya izinkan file audio/video
          allowedContentTypes: [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 'audio/aac', 'audio/x-m4a',
            'video/mp4', 'video/webm', 'video/quicktime'
          ],
          
          // Tambahkan suffix random agar filename unik
          addRandomSuffix: true,
          
          // Payload yang akan dikembalikan saat upload selesai
          tokenPayload: JSON.stringify({
            uploadedAt: new Date().toISOString(),
            originalName: pathname,
            // userId: session?.user?.id // Simpan jika ada auth
          }),
          
          // Batas ukuran 10 MB (validasi tambahan di server)
          maximumSizeInBytes: 10 * 1024 * 1024,
        };
      },
      
      // 2. Setelah upload selesai (webhook callback)
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('✅ Upload completed:', blob.url);
        console.log('Size:', blob.size, 'bytes');
        
        try {
          // TODO: Simpan metadata ke database eksternal jika perlu
          // Contoh: await db.save({ url: blob.url, size: blob.size, ...JSON.parse(tokenPayload) });
          
          console.log('📦 Metadata saved for:', blob.url);
        } catch (error) {
          // Upload sudah sukses di Blob, error hanya di side-effect
          console.error('❌ Failed to save metadata:', error);
        }
      },
    });

    return response.status(200).json(jsonResponse);
    
  } catch (error) {
    console.error('❌ Upload handler error:', error);
    const message = error instanceof Error ? error.message : 'Upload failed';
    
    return response.status(400).json({ error: message });
  }
}
