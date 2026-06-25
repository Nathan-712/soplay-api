const GIST_ID = process.env.GIST_ID; 
const GIST_TOKEN = process.env.GIST_TOKEN; 
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;

module.exports = async function handler(req, res) {
  // CORS Headers untuk mengizinkan akses dari browser
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ================= GET: Baca Katalog =================
  if (req.method === 'GET') {
    try {
      const headers = { 'User-Agent': 'Soplay-Catalog/1.0', 'If-None-Match': req.headers['if-none-match'] || '' };
      if (GIST_TOKEN) headers['Authorization'] = `token ${GIST_TOKEN}`;

      const resGist = await fetch(GIST_API_URL, { headers });
      if (resGist.status === 304) return res.status(304).end();
      if (!resGist.ok) throw new Error(`Gist API error: ${resGist.status}`);
      
      const data = await resGist.json();
      const catalogContent = data.files?.['soplay-catalog.json']?.content;
      if (!catalogContent) throw new Error('Catalog file not found');
      
      const etag = resGist.headers.get('ETag');
      if (etag) res.setHeader('ETag', etag);
      
      return res.status(200).json(JSON.parse(catalogContent));
    } catch (e) {
      // Jika Gist kosong/error, kembalikan struktur kosong agar frontend tidak crash
      return res.status(200).json({ songs: [], lastUpdated: 0 });
    }
  }

  // ================= POST: Tambah Lagu & Lirik =================
  if (req.method === 'POST') {
    if (!GIST_TOKEN) return res.status(500).json({ error: 'GIST_TOKEN tidak tersedia' });

    try {
      // Tangkap data dari request frontend (termasuk lrcUrl)
      const { title, artist, album, url, lrcUrl, size, mimeType, img, duration } = req.body;
      
      if (!title || !url) {
        return res.status(400).json({ error: 'Title dan URL wajib diisi' });
      }

      // 1. Fetch data Gist saat ini
      const resGist = await fetch(GIST_API_URL, {
        headers: { 'User-Agent': 'Soplay-Catalog/1.0', 'Authorization': `token ${GIST_TOKEN}` }
      });
      if (!resGist.ok) throw new Error('Gagal fetch Gist');
      
      const gistData = await resGist.json();
      const catalogContent = gistData.files?.['soplay-catalog.json']?.content;
      
      let catalog = { songs: [], lastUpdated: 0 };
      if (catalogContent) {
        try {
          catalog = JSON.parse(catalogContent);
        } catch (parseErr) {
          console.warn('Gist content corrupt, resetting catalog');
        }
      }

      // 2. Cek duplikasi berdasarkan URL
      if (catalog.songs.some(s => s.url === url)) {
        return res.status(200).json({ success: true, message: 'Lagu sudah ada di katalog' });
      }

      // 3. Tambah lagu baru ke array
      catalog.songs.push({
        id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title, 
        artist: artist || 'Unknown Artist', 
        album: album || '-',
        url, 
        lrcUrl: lrcUrl || null, // ← URL lirik disimpan di sini
        size: size || 0, 
        mimeType: mimeType || 'audio/mpeg',
        img: img || '', 
        duration: duration || 0,
        addedAt: Date.now()
      });

      catalog.lastUpdated = Date.now();

      // 4. Update Gist via PATCH
      const updateRes = await fetch(GIST_API_URL, {
        method: 'PATCH',
        headers: {
          'User-Agent': 'Soplay-Catalog/1.0',
          'Authorization': `token ${GIST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: { 'soplay-catalog.json': { content: JSON.stringify(catalog, null, 2) } }
        })
      });

      if (!updateRes.ok) throw new Error('Gagal update Gist via PATCH');

      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ 
        success: true, 
        total: catalog.songs.length, 
        lastUpdated: catalog.lastUpdated 
      });
      
    } catch (error) {
      console.error('Catalog Update Error:', error);
      return res.status(500).json({ error: 'Gagal update katalog: ' + error.message });
    }
  }
  
  return res.status(405).json({ error: 'Method not allowed' });
};
