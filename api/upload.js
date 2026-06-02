const { put } = require('@vercel/blob');

module.exports = async function handler(req, res) {
  // 1. Izinkan CORS untuk LiveCodes & Edunav
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(204).end(); // Penting untuk preflight CORS
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // 2. Baca raw buffer dari request
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    }
    const buffer = Buffer.concat(chunks);
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];

    if (!boundary) return res.status(400).json({ error: 'Invalid boundary' });

    // 3. Parse multipart secara aman menggunakan Buffer
    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = [];
    let start = 0;
    
    // Cari setiap bagian berdasarkan boundary
    while (true) {
      const idx = buffer.indexOf(boundaryBuffer, start);
      if (idx === -1) break;
      if (idx > start) {
        parts.push(buffer.slice(start, idx));
      }
      start = idx + boundaryBuffer.length + 2; // +2 untuk \r\n
    }

    let fileBuffer = null;
    let fileName = 'unknown.mp3';
    let mimeType = 'audio/mpeg';

    // 4. Ekstrak file dari parts
    for (const part of parts) {
      const headerEnd = part.indexOf('\r\n\r\n');
      if (headerEnd === -1) continue;

      const headerStr = part.slice(0, headerEnd).toString('utf-8');
      
      if (headerStr.includes('filename="')) {
        const filenameMatch = headerStr.match(/filename="([^"]+)"/);
        if (filenameMatch) fileName = filenameMatch[1];

        const contentTypeMatch = headerStr.match(/Content-Type: ([^\r\n]+)/i);
        if (contentTypeMatch) mimeType = contentTypeMatch[1].trim();

        // Ambil body (data file), hapus 2 byte terakhir (\r\n)
        const body = part.slice(headerEnd + 4);
        fileBuffer = body.slice(0, body.length - 2); 
      }
    }

    if (!fileBuffer) {
      return res.status(400).json({ error: 'File tidak ditemukan' });
    }

    // 5. Upload ke Vercel Blob
    const blob = await put(`soplay/${Date.now()}-${fileName
