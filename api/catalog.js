// api/catalog.js
const GIST_ID = '63104bfd16a026c85a363c0d4f517a2a'; // Gist ID kamu
const GIST_TOKEN = process.env.GIST_TOKEN; // Diset di Vercel Environment Variables

if (!GIST_TOKEN) {
  console.error('⚠️ GIST_TOKEN environment variable belum diset!');
}

const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Cache Control untuk CDN GitHub & Vercel Edge
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  
  if (req.method === 'OPTIONS') return res.status(204).end();

  // ================= GET: Baca Katalog dari Gist =================
  if (req.method === 'GET') {
    try {
      const headers = {
        'User-Agent': 'Soplay-Catalog/1.0',
        'If-None-Match': req.headers['if-none-match'] || ''
      };
      
      if (GIST_TOKEN) {
        headers['Authorization'] = `token ${GIST_TOKEN}`;
      }

      const resGist = await fetch(GIST_API_URL, { headers });
      
      // Handle 304 Not Modified (cache hit)
      if (resGist.status === 304) {
        return res.status(304).end();
      }
      
      if (!resGist.ok) {
        console.error('Gist API error:', resGist.status, await resGist.text());
        throw new Error(`Gist API error: ${resGist.status}`);
      }
      
      const data = await resGist.json();
      const catalogContent = data.files?.['soplay-catalog.json']?.content;
      
      if (!catalogContent) {
        console.warn('File soplay-catalog.json tidak ditemukan di Gist');
        throw new Error('Catalog file not found');
      }
      
      const catalog = JSON.parse(catalogContent);
      
      // Set ETag dari GitHub
      const etag = resGist.headers.get('ETag');
      if (etag) res.setHeader('ETag', etag);
      
      return res.status(200).json(catalog);
    } catch (e) {
      console.error('Gist GET error:', e);
      return res.status(200).json({ songs: [], lastUpdated: 0 });
    }
  }

  // ================= POST: Update Katalog ke Gist =================
  if (req.method === 'POST') {
    if (!GIST_TOKEN) {
      return res.status(500).json({ error: 'GIST_TOKEN tidak tersedia untuk update' });
    }

    try {
      const { title, artist, album, url, size, mimeType, img, duration } = req.body;
      if (!title || !url) return res.status(400).json({ error: 'Title dan URL wajib' });

      // 1. Ambil katalog existing dari Gist
      const resGist = await fetch(GIST_API_URL, {
        headers: {
          'User-Agent': 'Soplay-Catalog/1.0',
          'Authorization': `token ${GIST_TOKEN}`
        }
      });
      
      if (!resGist.ok) {
        console.error('Gagal fetch Gist untuk update:', resGist.status);
        throw new Error('Gagal fetch Gist');
      }
      
      const gistData = await resGist.json();
      const catalogContent = gistData.files?.['soplay-catalog.json']?.content;
      let catalog = { songs: [], lastUpdated: 0 };
      
      if (catalogContent) {
        catalog = JSON.parse(catalogContent);
      }

      // 2. Cek duplikasi berdasarkan URL
      if (catalog.songs.some(s => s.url === url)) {
        return res.status(200).json({ success: true, message: 'Sudah ada di katalog' });
      }

      // 3. Tambahkan lagu baru
      catalog.songs.push({
        id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title, 
        artist: artist || 'Unknown Artist', 
        album: album || '-',
        url, 
        size: size || 0, 
        mimeType: mimeType || 'audio/mpeg',
        img: img || '', 
        duration: duration || 0,
        addedAt: Date.now()
      });

      catalog.lastUpdated = Date.now();

      // 4. Update Gist via PATCH API
      const updateRes = await fetch(GIST_API_URL, {
        method: 'PATCH',
        headers: {
          'User-Agent': 'Soplay-Catalog/1.0',
          'Authorization': `token ${GIST_TOKEN}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          files: {
            'soplay-catalog.json': {
              content: JSON.stringify(catalog, null, 2)
            }
          }
        })
      });

      if (!updateRes.ok) {
        const errorText = await updateRes.text();
        console.error('Gagal update Gist:', updateRes.status, errorText);
        throw new Error(`Gagal update Gist: ${updateRes.status}`);
      }

      // 5. Invalidate cache untuk request berikutnya
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ 
        success: true, 
        total: catalog.songs.length, 
        lastUpdated: catalog.lastUpdated 
      });
    } catch (error) {
      console.error('Gist POST error:', error);
      return res.status(500).json({ error: 'Gagal update katalog: ' + error.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
