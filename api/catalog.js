// api/catalog.js
const GIST_ID = process.env.GIST_ID;
const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
const FILENAME = 'soplay-catalog.json';

module.exports = async function handler(req, res) {
  // ✅ CORS & CDN Cache Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(204).end();

  // ================= GET (Read Catalog) =================
  if (req.method === 'GET') {
    try {
      const headers = { 'Authorization': `token ${GIST_TOKEN}` };
      if (req.headers['if-none-match']) headers['If-None-Match'] = req.headers['if-none-match'];

      const gistRes = await fetch(GIST_API_URL, { headers });

      // 🟢 304 Not Modified (Hemat 100% Token & Bandwidth)
      if (gistRes.status === 304) return res.status(304).end();
      if (!gistRes.ok) throw new Error('Gist fetch failed');

      const data = await gistRes.json();
      const etag = gistRes.headers.get('ETag');
      if (etag) res.setHeader('ETag', etag);

      return res.status(200).json(JSON.parse(data.files[FILENAME].content));
    } catch (e) {
      console.error('Gist GET error:', e);
      return res.status(200).json({ songs: [], lastUpdated: 0 });
    }
  }

  // ================= POST (Update Catalog) =================
  if (req.method === 'POST') {
    try {
      const { title, artist, album, url, size, mimeType, img, duration } = req.body;
      if (!title || !url) return res.status(400).json({ error: 'Title dan URL wajib' });

      // 1. Fetch katalog existing
      const gistRes = await fetch(GIST_API_URL, { headers: { 'Authorization': `token ${GIST_TOKEN}` } });
      const gistData = await gistRes.json();
      const catalog = JSON.parse(gistData.files[FILENAME].content);

      // 2. Cek duplikasi berdasarkan URL
      if (catalog.songs.some(s => s.url === url)) {
        return res.status(200).json({ success: true, message: 'Sudah ada di katalog' });
      }

      // 3. Tambah lagu baru
      catalog.songs.push({
        id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title, artist: artist || 'Unknown Artist', album: album || '-',
        url, size: size || 0, mimeType: mimeType || 'audio/mpeg',
        img: img || '', duration: duration || 0,
        addedAt: Date.now()
      });

      catalog.lastUpdated = Date.now();

      // 4. Update Gist via API
      const patchRes = await fetch(GIST_API_URL, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${GIST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(catalog, null, 2) } } })
      });

      if (!patchRes.ok) throw new Error('Gist update failed');

      // 5. Invalidate CDN cache agar polling berikutnya dapat data segar
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ success: true, total: catalog.songs.length, lastUpdated: catalog.lastUpdated });
    } catch (error) {
      console.error('Gist POST error:', error);
      return res.status(500).json({ error: 'Gagal update katalog: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
