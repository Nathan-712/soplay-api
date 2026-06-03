// api/catalog.js
const { put } = require('@vercel/blob');

// Ganti dengan URL Blob Publik kamu
const CATALOG_JSON_URL = 'https://gf9ktt57jkxqawtd.public.blob.vercel-storage.com/katalog/global_catalog.json';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  // GET: Incremental sync & cache validation
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const since = parseInt(url.searchParams.get('since')) || 0;

      const r = await fetch(CATALOG_JSON_URL + '?t=' + Date.now());
      if (!r.ok) return res.status(200).json({ songs: [], lastUpdated: 0, changed: false });
      
      const data = await r.json();
      const lastUpdated = data.lastUpdated || 0;
      
      if (lastUpdated <= since) {
        return res.status(200).json({ songs: [], lastUpdated, changed: false });
      }

      return res.status(200).json({ 
        songs: data.songs || [], 
        lastUpdated, 
        changed: true 
      });
    } catch (e) {
      return res.status(200).json({ songs: [], lastUpdated: 0, changed: false });
    }
  }

  // POST: Register track to catalog
  if (req.method === 'POST') {
    try {
      const { title, artist, album, url, size, mimeType, img, duration } = req.body;
      if (!title || !url) return res.status(400).json({ error: 'Title dan URL wajib' });

      let catalog = { songs: [], lastUpdated: 0 };
      try {
        const r = await fetch(CATALOG_JSON_URL + '?t=' + Date.now());
        if (r.ok) catalog = await r.json();
      } catch (e) {}

      if (catalog.songs.some(s => s.url === url)) {
        return res.status(200).json({ success: true, message: 'Sudah ada di katalog' });
      }

      catalog.songs.push({
        id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title, artist: artist || 'Unknown Artist', album: album || '-',
        url, size: size || 0, mimeType: mimeType || 'audio/mpeg',
        img: img || '', duration: duration || 0,
        addedAt: Date.now()
      });

      catalog.lastUpdated = Date.now();

      // api/catalog.js - Bagian POST handler
await put('katalog/global_catalog.json', JSON.stringify(catalog, null, 2), {
  access: 'public',
  contentType: 'application/json',
  addRandomSuffix: false,  // ✅ PENTING: Agar URL tetap predictable
});

      return res.status(200).json({ success: true, total: catalog.songs.length, lastUpdated: catalog.lastUpdated });
    } catch (error) {
      console.error('Catalog Error:', error);
      return res.status(500).json({ error: 'Gagal update katalog: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
