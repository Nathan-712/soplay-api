// api/upload.js
import { put } from '@vercel/blob';

export const config = { 
  api: { bodyParser: false } 
};

export default async function handler(req, res) {
  // ✅ WAJIB: CORS Headers agar bisa diakses dari Edunav/LiveCodes
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Handle preflight request (browser cek izin dulu)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    
    if (!file) {
      return res.status(400).json({ error: 'File tidak ditemukan' });
    }

    const title = formData.get('title') || file.name.replace(/\.[^/.]+$/, '');
    const artist = formData.get('artist') || 'Unknown Artist';
    const album = formData.get('album') || 'Unknown Album';

    const blob = await put(`soplay/${Date.now()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    res.status(200).json({
      success: true,
      url: blob.url,
      title,
      artist,
      album,
      size: file.size
    });
  } catch (error) {
    console.error('Upload Error:', error);
    res.status(500).json({ error: 'Gagal upload: ' + error.message });
  }
}
