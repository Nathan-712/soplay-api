import { put } from '@vercel/blob';

export const config = { 
  api: { bodyParser: false } 
};

export default async function handler(req, res) {
  // --- WAJIB: Tambahkan CORS Headers agar LiveCodes/Edunav boleh akses ---
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Jika browser mengecek izin (preflight OPTIONS), langsung izinkan
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse file secara native (Node.js 18+ di Vercel mendukung ini)
    const formData = await req.formData();
    const file = formData.get('file');
    const title = formData.get('title') || (file ? file.name.replace(/\.[^/.]+$/, '') : 'Unknown');
    const artist = formData.get('artist') || 'Unknown Artist';
    const album = formData.get('album') || 'Unknown Album';

    if (!file) return res.status(400).json({ error: 'File tidak ditemukan' });

    // Upload ke Vercel Blob (Public)
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
    res.status(500).json({ error: 'Gagal upload ke storage: ' + error.message });
  }
}
