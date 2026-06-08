const { handleUpload } = require('@vercel/blob/client');

// PENTING: Matikan bodyParser bawaan Next.js agar SDK bisa handle stream upload
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(request, response) {
  try {
    const jsonResponse = await handleUpload({
      body: request.body,
      request,
      
      // 1. Validasi & Buat Token
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        
        // 🔒 Contoh sederhana pengecekan (opsional)
        // const session = await getSession(request);
        // if (!session) throw new Error('Unauthorized');

        return {
          // Hanya izinkan file audio/video
          allowedContentTypes: [
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac', 
            'video/mp4', 'video/webm'
          ],
          // Tambahkan angka acak di belakang nama file biar tidak tertimpa
          addRandomSuffix: true,
          
          // Simpan data tambahan (misal ID User)
          tokenPayload: JSON.stringify({
            uploadedAt: new Date().toISOString(),
            // userId: session?.user?.id 
          }),
        };
      },

      // 2. Jalankan setelah upload sukses (Webhook)
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('✅ Upload Selesai:', blob.url);
        
        // Disini kamu bisa save ke database MongoDB/MySQL/Supabase
        // Contoh: await db.save({ url: blob.url, ...JSON.parse(tokenPayload) });
      },
    });

    return response.status(200).json(jsonResponse);

  } catch (error) {
    // Return error ke frontend
    return response.status(400).json({ 
      error: (error instanceof Error) ? error.message : 'Upload failed' 
    });
  }
}
