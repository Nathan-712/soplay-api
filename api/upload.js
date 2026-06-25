import { put } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const chunks = [];
    for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
    const buffer = Buffer.concat(chunks);

    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1] || contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];
    if (!boundary) return res.status(400).json({ error: 'Boundary tidak valid' });

    const boundaryBuffer = Buffer.from(`--${boundary}`);
    const parts = [];
    let start = 0;
    while (true) {
      const idx = buffer.indexOf(boundaryBuffer, start);
      if (idx === -1) break;
      if (idx > start) parts.push(buffer.slice(start, idx));
      start = idx + boundaryBuffer.length + 2;
    }

    let audioBuffer = null, audioName = 'unknown.mp3';
    let lrcBuffer = null, lrcName = null;

    for (const part of parts) {
      const headerEnd = part.indexOf(Buffer.from('\r\n\r\n'));
      if (headerEnd === -1) continue;
      const header = part.slice(0, headerEnd).toString();
      const nameMatch = header.match(/name="([^"]+)"/)?.[1];
      const fileMatch = header.match(/filename="([^"]+)"/)?.[1];

      if (fileMatch) {
        let body = part.slice(headerEnd + 4);
        if (body.length >= 2 && body[body.length-2] === 13 && body[body.length-1] === 10) {
          body = body.slice(0, -2);
        }
        if (nameMatch === 'lrcFile') { lrcBuffer = body; lrcName = fileMatch; }
        else if (!audioBuffer) { audioBuffer = body; audioName = fileMatch; }
      }
    }

    if (!audioBuffer) return res.status(400).json({ error: 'File audio tidak ditemukan' });

    const audioBlob = await put(`soplay/audio/${Date.now()}-${encodeURIComponent(audioName)}`, audioBuffer, {
      access: 'public', contentType: 'audio/mpeg', addRandomSuffix: true
    });

    let lrcUrl = null;
    if (lrcBuffer && lrcBuffer.length > 0) {
      const lrcBlob = await put(`soplay/lyrics/${Date.now()}-${encodeURIComponent(lrcName || 'lyrics.json')}`, lrcBuffer, {
        access: 'public', contentType: 'application/json', addRandomSuffix: true
      });
      lrcUrl = lrcBlob.url;
    }

    return res.status(200).json({
      success: true,
      url: audioBlob.url,
      lrcUrl,
      title: audioName.replace(/\.[^/.]+$/, ''),
      size: audioBuffer.length
    });
  } catch (err) {
    console.error('Upload Error:', err);
    return res.status(500).json({ error: 'Gagal upload: ' + err.message });
  }
}
