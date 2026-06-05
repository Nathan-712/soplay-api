// api/upload.js
const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  // ✅ CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 🔧 Manual Multipart Parsing (Stabil di Node.js)
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

    let fileBuffer = null, fileName = 'unknown.mp3', mimeType = 'audio/mpeg';
    for (const part of parts) {
      const headerEndIdx = part.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEndIdx === -1) continue;
      const headerStr = part.slice(0, headerEndIdx).toString('utf-8');
      if (headerStr.includes('filename="')) {
        const fn = headerStr.match(/filename="([^"]+)"/);
        if (fn) fileName = fn[1];
        const ct = headerStr.match(/Content-Type:\s*([^\r\n]+)/i);
        if (ct) mimeType = ct[1].trim();
        let body = part.slice(headerEndIdx + 4);
        if (body.length >= 2 && body[body.length-2] === 13 && body[body.length-1] === 10) body = body.slice(0, -2);
        fileBuffer = body;
      }
    }

    if (!fileBuffer || fileBuffer.length === 0) return res.status(400).json({ error: 'File tidak ditemukan' });

    // 📦 Upload ke Vercel Blob
    const blob = await put(`soplay/${Date.now()}-${fileName}`, fileBuffer, {
      access: 'public',
      contentType: mimeType,
      addRandomSuffix: true // Audio file dapat suffix acak agar tidak bentrok
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      title: fileName.replace(/\.[^/.]+$/, ''),
      artist: 'Unknown Artist',
      album: '-',
      size: fileBuffer.length,
      mimeType
    });
  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Gagal upload: ' + error.message });
  }
};
