const { put } = require('@vercel/blob');
const formidable = require('formidable');
const fs = require('fs');

module.exports = function handler(req, res) {
  // Izinkan akses dari LiveCodes & Edunav (CORS)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Gunakan formidable untuk memproses file upload di Node.js
  const form = formidable({ keepExtensions: true });

  form.parse(req, async (err, fields, files) => {
    if (err) {
      console.error('Formidable error:', err);
      return res.status(500).json({ error: 'Gagal memproses form upload' });
    }

    // Formidable v2+ mengembalikan array, jadi kita ambil elemen pertama
    const file = Array.isArray(files.file) ? files.file[0] : files.file;
    const title = Array.isArray(fields.title) ? fields.title[0] : (fields.title || (file ? file.originalFilename.replace(/\.[^/.]+$/, '') : 'Unknown'));
    const artist = Array.isArray(fields.artist) ? fields.artist[0] : (fields.artist || 'Unknown Artist');

    if (!file) {
      return res.status(400).json({ error: 'File tidak ditemukan' });
    }

    try {
      // Upload ke Vercel Blob menggunakan stream dari file sementara
      const blob = await put(`soplay/${Date.now()}-${file.originalFilename}`, fs.createReadStream(file.filepath), {
        access: 'public',
        addRandomSuffix: true,
      });

      res.status(200).json({
        success: true,
        url: blob.url,
        title: title,
        artist: artist,
        size: file.size,
      });
    } catch (error) {
      console.error('Blob upload error:', error);
      res.status(500).json({ error: 'Gagal upload ke storage: ' + error.message });
    }
  });
};
