const { put } = require('@vercel/blob');
const formidable = require('formidable');
const fs = require('fs');

module.exports = async function handler(req, res) {
  // Izinkan akses dari mana saja (LiveCodes / Edunav)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable();

  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Gagal memproses form' });

    // Ambil file pertama
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    if (!file) return res.status(400).json({ error: 'File tidak ditemukan' });

    try {
      // Upload ke Vercel Blob
      const blob = await put(`soplay/${Date.now()}-${file.originalFilename}`, fs.createReadStream(file.filepath), {
        access: 'public',
        addRandomSuffix: true,
      });

      const title = fields.title ? (Array.isArray(fields.title) ? fields.title[0] : fields.title) : file.originalFilename;

      res.status(200).json({
        success: true,
        url: blob.url,
        title: title,
        size: file.size
      });
    } catch (error) {
      res.status(500).json({ error: 'Gagal upload: ' + error.message });
    }
  });
};
