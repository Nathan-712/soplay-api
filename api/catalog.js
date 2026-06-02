// api/catalog.js
const { put } = require('@vercel/blob');

const CATALOG_URL = 'https://gf9ktt57jkxqawtd.public.blob.vercel-storage.com/soplay/global_catalog.json';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET: Ambil katalog
  if (req.method === 'GET') {
    try {
      const r = await fetch(CATALOG_URL + '?t=' + Date.now());
      if (!r.ok) return res.status(200).json({ songs: [] });
      const data = await r.json();
      return res.status(200).json(data);
    } catch (e) {
      return res.status(200).json({ songs: [] });
    }
  }

  // POST: Tambah lagu ke katalog
  if (req.method === 'POST') {
    try {
      const { title, artist, album, url, size, mimeType } = req.body;
      if (!title || !url) return res.status(400).json({ error: 'Title dan URL wajib' });

      // Ambil katalog yang ada
      let catalog = { songs: [] };
      try {
        const r = await fetch(CATALOG_URL + '?t=' + Date.now());
        if (r.ok) catalog = await r.json();
      } catch (e) {}

      // Cek duplikasi berdasarkan URL
      if (catalog.songs.some(s => s.url === url)) {
        return res.status(200).json({ success: true, message: 'Sudah ada di katalog' });
      }

      // Tambahkan lagu baru
      catalog.songs.push({
        id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title,
        artist: artist || 'Unknown Artist',
        album: album || '-',
        url,
        size: size || 0,
        mimeType: mimeType || 'audio/mpeg',
        addedAt: Date.now()
      });

      // Simpan kembali ke Vercel Blob
      await put('soplay/global_catalog.json', JSON.stringify(catalog, null, 2), {
        access: 'public',
        contentType: 'application/json',
      });

      return res.status(200).json({ 
        success: true, 
        message: 'Berhasil ditambahkan ke katalog',
        total: catalog.songs.length 
      });

    } catch (error) {
      console.error('Catalog Error:', error);
      return res.status(500).json({ error: 'Gagal update katalog: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
