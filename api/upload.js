import { put, head } from '@vercel/blob';

export const config = { api: { bodyParser: false } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const formData = await req.formData();
    const file = formData.get('file');
    const title = formData.get('title') || file.name.replace(/\.[^/.]+$/, '');
    const artist = formData.get('artist') || 'Unknown Artist';
    const album = formData.get('album') || 'Unknown Album';
    const addToCatalog = formData.get('addToCatalog') === 'true';

    if (!file) return res.status(400).json({ error: 'File tidak ditemukan' });

    // 1. Upload file audio ke Vercel Blob
    const blob = await put(`soplay/${Date.now()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    // 2. Jika diminta, tambahkan ke Katalog Publik (global_catalog.json)
    if (addToCatalog) {
      const catalogUrl = 'https://gf9ktt57jkxqawtd.public.blob.vercel-storage.com/soplay/global_catalog.json';
      let catalog = { songs: [] };
      
      try {
        // Ambil katalog yang sudah ada
        const resCatalog = await fetch(catalogUrl);
        if (resCatalog.ok) {
          catalog = await resCatalog.json();
        }
      } catch (e) {
        // Jika belum ada, biarkan array kosong
      }

      // Tambahkan lagu baru ke katalog
      catalog.songs.push({
        id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title: title,
        artist: artist,
        album: album,
        url: blob.url,
        size: file.size,
        addedAt: Date.now()
      });

      // Simpan kembali katalog yang sudah diupdate ke Vercel Blob
      await put('soplay/global_catalog.json', JSON.stringify(catalog), {
        access: 'public',
        contentType: 'application/json'
      });
    }

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
