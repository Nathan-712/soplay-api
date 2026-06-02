const { put } = require('@vercel/blob');
const { IncomingForm } = require('formidable');
const fs = require('fs');

export const config = {
  api: { bodyParser: false },
};

export default function handler(req, res) {
  // Izinkan akses dari LiveCodes & Edunav
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = new IncomingForm();
  
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Gagal parse form' });

    const file = files.file?.[0];
    const title = fields.title?.[0] || file?.originalFilename?.replace(/\.[^/.]+$/, '') || 'Unknown';
    const artist = fields.artist?.[0] || 'Unknown Artist';

    if (!file) return res.status(400).json({ error: 'File tidak ditemukan' });

    try {
      // Upload ke Vercel Blob
      const blob = await put(`soplay/${Date.now()}-${file.originalFilename}`, fs.createReadStream(file.filepath), {
        access: 'public',
        addRandomSuffix: true,
      });

      res.status(200).json({
        success: true,
        url: blob.url,
        title,
        artist,
        size: file.size,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Gagal upload: ' + error.message });
    }
  });
}
