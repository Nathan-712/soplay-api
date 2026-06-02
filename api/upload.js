import Busboy from 'busboy';
import { put } from '@vercel/blob';

export const config = {
  api: { bodyParser: false },
};

export default function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const bb = Busboy({ headers: req.headers });
  let fileBuffer = null, fileName = null, mimeType = null;
  const fields = {};

  bb.on('file', (name, file, info) => {
    const chunks = [];
    file.on('data', (data) => chunks.push(data));
    file.on('end', () => {
      fileBuffer = Buffer.concat(chunks);
      fileName = info.filename;
      mimeType = info.mimeType;
    });
  });

  bb.on('field', (name, val) => { fields[name] = val; });

  bb.on('finish', async () => {
    try {
      if (!fileBuffer) return res.status(400).json({ error: 'File tidak ditemukan' });

      const title = fields.title || fileName.replace(/\.[^/.]+$/, '');
      const artist = fields.artist || 'Unknown Artist';
      const album = fields.album || 'Unknown Album';

      const blob = await put(`soplay/${Date.now()}-${fileName}`, fileBuffer, {
        access: 'public',
        contentType: mimeType,
        addRandomSuffix: true,
      });

      res.status(200).json({ success: true, url: blob.url, title, artist, album, size: fileBuffer.length });
    } catch (error) {
      res.status(500).json({ error: 'Gagal upload: ' + error.message });
    }
  });

  req.pipe(bb);
}
