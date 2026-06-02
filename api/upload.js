const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  // Izinkan akses dari Edunav / LiveCodes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // 1. Baca raw body dari request Node.js secara manual
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);

    // 2. Ambil boundary untuk memisah file
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    if (!boundary) return res.status(400).json({ error: 'Invalid request' });

    // 3. Parse file secara manual (tanpa formidable/busboy)
    const parts = buffer.toString('binary').split(`--${boundary}`);
    let fileBuffer = null;
    let fileName = 'unknown.mp3';
    let mimeType = 'audio/mpeg';

    for (const part of parts) {
      if (part.includes('filename="')) {
        const headerEnd = part.indexOf('\r\n\r\n');
        const headerStr = part.substring(0, headerEnd);
        let bodyStr = part.substring(headerEnd + 4);

        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        if (filenameMatch) fileName = filenameMatch[1];

        const contentTypeMatch = headerStr.match(/Content-Type: ([^\r\n]+)/i);
        if (contentTypeMatch) mimeType = contentTypeMatch[1].trim();

        if (bodyStr.endsWith('\r\n')) bodyStr = bodyStr.slice(0, -2);
        fileBuffer = Buffer.from(bodyStr, 'binary');
      }
    }

    if (!fileBuffer) return res.status(400).json({ error: 'File tidak ditemukan' });

    // 4. Upload ke Vercel Blob
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
    console.error('Error:', error);
    return res.status(500).json({ error: 'Gagal upload: ' + error.message });
  }
};
