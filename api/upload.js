// api/upload.js
const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Baca seluruh body request sebagai buffer
    const chunks = [];
    for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    const buffer = Buffer.concat(chunks);
    
    // 2. Parse Boundary dari Header
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) return res.status(400).json({ error: 'Boundary tidak ditemukan' });
    
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    
    // 3. Pecah buffer menjadi parts berdasarkan boundary
    const parts = [];
    let start = 0;
    while (true) {
      const idx = buffer.indexOf(boundaryBuffer, start);
      if (idx === -1) break;
      if (idx > start) parts.push(buffer.slice(start, idx));
      start = idx + boundaryBuffer.length + 2;
    }

    // 4. Ekstrak File Audio Utama dan File LRC (jika ada)
    let audioFileBuffer = null, audioFileName = 'unknown.mp3', audioMimeType = 'audio/mpeg';
    let lrcFileBuffer = null, lrcFileName = null;

    for (const part of parts) {
      const headerEndIdx = part.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEndIdx === -1) continue;
      
      const headerStr = part.slice(0, headerEndIdx).toString('utf-8');
      
      // Cek apakah part ini punya filename
      if (headerStr.includes('filename="')) {
        const fn = headerStr.match(/filename="([^"]+)"/);
        const fieldName = headerStr.match(/name="([^"]+)"/); // Cek nama field form
        
        if (fn) {
          const fileName = fn[1];
          let body = part.slice(headerEndIdx + 4);
          // Hapus trailing CRLF jika ada
          if (body.length >= 2 && body[body.length-2] === 13 && body[body.length-1] === 10) 
            body = body.slice(0, -2);

          // Logika Pemisahan:
          // Jika field name adalah 'lrcFile' ATAU ekstensi file .lrc/.json, anggap sebagai lirik
          if ((fieldName && fieldName[1] === 'lrcFile') || fileName.toLowerCase().endsWith('.lrc') || fileName.toLowerCase().endsWith('.json')) {
            lrcFileBuffer = body;
            lrcFileName = fileName;
          } else {
            // Anggap sebagai file audio utama
            audioFileBuffer = body;
            audioFileName = fileName;
            const ct = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
            if (ct) audioMimeType = ct[1].trim();
          }
        }
      }
    }

    if (!audioFileBuffer || audioFileBuffer.length === 0) {
      return res.status(400).json({ error: 'File audio tidak ditemukan' });
    }

    // 5. Upload Audio ke Vercel Blob
    const audioBlob = await put(`soplay/audio/${Date.now()}-${audioFileName}`, audioFileBuffer, {
      access: 'public', 
      contentType: audioMimeType, 
      addRandomSuffix: true
    });

    // 6. Upload LRC ke Vercel Blob (Jika Ada)
    let lrcUrl = null;
    if (lrcFileBuffer && lrcFileBuffer.length > 0) {
      const lrcBlob = await put(`soplay/lyrics/${Date.now()}-${lrcFileName}`, lrcFileBuffer, {
        access: 'public',
        contentType: 'application/json', // Kita simpan sebagai JSON agar mudah diparse frontend
        addRandomSuffix: true
      });
      lrcUrl = lrcBlob.url;
    }

    // 7. Response
    return res.status(200).json({
      success: true,
      url: audioBlob.url,
      lrcUrl: lrcUrl, // URL lirik dikirim kembali
      title: audioFileName.replace(/\.[^/.]+$/, ''),
      artist: 'Unknown Artist',
      album: '-',
      size: audioFileBuffer.length,
      mimeType: audioMimeType
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Gagal upload: ' + error.message });
  }
};
