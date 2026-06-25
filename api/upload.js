const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Baca buffer request
    const chunks = [];
    for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
    if (!boundaryMatch) return res.status(400).json({ error: 'Boundary tidak ditemukan' });

    const boundary = boundaryMatch[1] || boundaryMatch[2];
    const boundaryBuffer = Buffer.from(`--${boundary}`);

    const parts = [];
    let start = 0;
    while (true) {
      const idx = buffer.indexOf(boundaryBuffer, start);
      if (idx === -1) break;
      if (idx > start) parts.push(buffer.slice(start, idx));
      start = idx + boundaryBuffer.length + 2;
    }

    let audioFileBuffer = null, audioFileName = 'unknown.mp3';
    let lrcFileBuffer = null, lrcFileName = null;

    // 2. Parsing Part (Audio & Lirik)
    for (const part of parts) {
      const headerEndIdx = part.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEndIdx === -1) continue;
      
      const headerStr = part.slice(0, headerEndIdx).toString('utf-8');
      
      if (headerStr.includes('filename="')) {
        const fn = headerStr.match(/filename="([^"]+)"/);
        const fieldName = headerStr.match(/name="([^"]+)"/); 
        
        if (fn) {
          const fileName = fn[1];
          let body = part.slice(headerEndIdx + 4);
          // Hapus trailing CRLF
          if (body.length >= 2 && body[body.length-2] === 13 && body[body.length-1] === 10) {
            body = body.slice(0, -2);
          }

          // DETEKSI FIELD: Jika 'lrcFile' simpan ke buffer lirik
          if ((fieldName && fieldName[1] === 'lrcFile')) {
            lrcFileBuffer = body;
            lrcFileName = fileName;
          } else {
            // Jika bukan lrcFile, anggap audio utama
            audioFileBuffer = body;
            audioFileName = fileName;
          }
        }
      }
    }

    if (!audioFileBuffer || audioFileBuffer.length === 0) {
      return res.status(400).json({ error: 'File audio tidak ditemukan' });
    }

    // 3. Upload Audio
    const audioBlob = await put(`soplay/audio/${Date.now()}-${audioFileName}`, audioFileBuffer, {
      access: 'public', 
      contentType: 'audio/mpeg', 
      addRandomSuffix: true
    });

    // 4. Upload Lirik (Jika ada)
    let lrcUrl = null;
    if (lrcFileBuffer && lrcFileBuffer.length > 0) {
      const lrcBlob = await put(`soplay/lyrics/${Date.now()}-${lrcFileName}`, lrcFileBuffer, {
        access: 'public',
        contentType: 'text/plain', 
        addRandomSuffix: true
      });
      lrcUrl = lrcBlob.url;
    }

    // 5. Return Response (Termasuk lrcUrl)
    return res.status(200).json({
      success: true,
      url: audioBlob.url,
      lrcUrl: lrcUrl, // <--- INI KUNCI AGAR LIRIK MASUK KE GIST
      title: audioFileName.replace(/\.[^/.]+$/, ''),
      size: audioFileBuffer.length
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Gagal upload: ' + error.message });
  }
};
