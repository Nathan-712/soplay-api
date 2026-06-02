const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  // 1. WAJIB: CORS Header (Dikirim SEBELUM ada proses apapun)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Kumpulkan raw data dari request Node.js
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    // 3. Ambil boundary dari header
    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) {
      return res.status(400).json({ error: 'Boundary tidak ditemukan' });
    }
    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const boundaryBuffer = Buffer.from(`--${boundary}`);

    // 4. Split buffer berdasarkan boundary
    const parts = [];
    let start = 0;
    while (true) {
      const idx = buffer.indexOf(boundaryBuffer, start);
      if (idx === -1) break;
      if (idx > start) {
        parts.push(buffer.slice(start, idx));
      }
      start = idx + boundaryBuffer.length + 2; // Lewati \r\n
    }

    let fileBuffer = null;
    let fileName = 'unknown.mp3';
    let mimeType = 'application/octet-stream';

    // 5. Cari bagian yang merupakan file
    for (const part of parts) {
      const headerEndIdx = part.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEndIdx === -1) continue;

      const headerStr = part.slice(0, headerEndIdx).toString('utf-8');
      
      if (headerStr.includes('filename="')) {
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        if (filenameMatch) fileName = filenameMatch[1];

        const contentTypeMatch = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
        if (contentTypeMatch) mimeType = contentTypeMatch[1].trim();

        // Ambil data file (body)
        let body = part.slice(headerEndIdx + 4);
        // Hapus \r\n di akhir jika ada
        if (body.length >= 2 && body[body.length - 2] === 13 && body[body.length - 1] === 10) {
          body = body.slice(0, -2);
        }
        fileBuffer = body;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return res.status(400).json({ error: 'File tidak ditemukan atau kosong' });
    }

    // 6. Upload ke Vercel Blob
    const blob = await put(`soplay/${Date.now()}-${fileName}`, fileBuffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true,
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      title: fileName.replace(/\.[^/.]+$/, ''),
      size: fileBuffer.length,
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Gagal upload: ' + error.message });
  }
};
