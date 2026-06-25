const GIST_ID = process.env.GIST_ID;
const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_URL = `https://api.github.com/gists/${GIST_ID}`;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    try {
      const headers = { 'User-Agent': 'Soplay/1.3.8' };
      if (req.headers['if-none-match']) headers['If-None-Match'] = req.headers['if-none-match'];
      if (GIST_TOKEN) headers.Authorization = `Bearer ${GIST_TOKEN}`;

      const r = await fetch(GIST_URL, { headers });
      if (r.status === 304) return res.status(304).end();
      if (!r.ok) throw new Error(`Gist error: ${r.status}`);

      const data = await r.json();
      const content = data.files?.['soplay-catalog.json']?.content;
      const etag = r.headers.get('ETag');
      if (etag) res.setHeader('ETag', etag);

      return res.status(200).json(content ? JSON.parse(content) : { songs: [], lastUpdated: 0 });
    } catch (e) {
      return res.status(200).json({ songs: [], lastUpdated: 0, error: e.message });
    }
  }

  if (req.method === 'POST') {
    if (!GIST_TOKEN) return res.status(500).json({ error: 'GIST_TOKEN tidak diset' });
    try {
      const { title, artist, album, url, lrcUrl, size, mimeType, img, duration } = req.body;
      if (!title || !url) return res.status(400).json({ error: 'Title & URL wajib' });

      const r = await fetch(GIST_URL, { headers: { 'Authorization': `Bearer ${GIST_TOKEN}` } });
      const data = await r.json();
      const content = data.files?.['soplay-catalog.json']?.content;
      let catalog = content ? JSON.parse(content) : { songs: [], lastUpdated: 0 };

      if (catalog.songs.some(s => s.url === url)) {
        return res.status(200).json({ success: true, message: 'Sudah ada' });
      }

      catalog.songs.push({
        id: `pub_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        title, artist: artist || 'Unknown', album: album || '-',
        url, lrcUrl: lrcUrl || null, size, mimeType: mimeType || 'audio/mpeg',
        img, duration, addedAt: Date.now()
      });
      catalog.lastUpdated = Date.now();

      const patch = await fetch(GIST_URL, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${GIST_TOKEN}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ files: { 'soplay-catalog.json': { content: JSON.stringify(catalog, null, 2) } } })
      });
      if (!patch.ok) throw new Error('Gagal update Gist');

      return res.status(200).json({ success: true, total: catalog.songs.length });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
