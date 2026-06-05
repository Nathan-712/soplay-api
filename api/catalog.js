const GIST_ID = process.env.GIST_ID;
const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
const FILENAME = 'soplay-catalog.json';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method === 'GET') {
    try {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const since = parseInt(url.searchParams.get('since')) || 0;
      const headers = { 'Authorization': `token ${GIST_TOKEN}`, 'User-Agent': 'Soplay-App/1.0' };
      const gistRes = await fetch(GIST_API_URL, { headers });
      if (!gistRes.ok) throw new Error('Gist fetch failed');
      const data = await gistRes.json();
      const catalog = JSON.parse(data.files[FILENAME].content);
      if (catalog.lastUpdated <= since) return res.status(200).json({ songs: catalog.songs, lastUpdated: catalog.lastUpdated, changed: false });
      const etag = gistRes.headers.get('ETag');
      if (etag) res.setHeader('ETag', etag);
      return res.status(200).json({ songs: catalog.songs, lastUpdated: catalog.lastUpdated, changed: true });
    } catch (e) {
      return res.status(200).json({ songs: [], lastUpdated: 0, changed: false });
    }
  }

  if (req.method === 'POST') {
    try {
      const { title, artist, album, url, size, mimeType, img, duration } = req.body;
      if (!title || !url) return res.status(400).json({ error: 'Title dan URL wajib' });
      const gistRes = await fetch(GIST_API_URL, { headers: { 'Authorization': `token ${GIST_TOKEN}`, 'User-Agent': 'Soplay-App/1.0' } });
      const gistData = await gistRes.json();
      const catalog = JSON.parse(gistData.files[FILENAME].content);
      if (catalog.songs.some(s => s.url === url)) return res.status(200).json({ success: true, message: 'Sudah ada' });
      catalog.songs.push({
        id: `pub_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        title, artist: artist || 'Unknown Artist', album: album || '-',
        url, size: size || 0, mimeType: mimeType || 'audio/mpeg',
        img: img || '', duration: duration || 0, addedAt: Date.now()
      });
      catalog.lastUpdated = Date.now();
      const patchRes = await fetch(GIST_API_URL, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${GIST_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'Soplay-App/1.0' },
        body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(catalog, null, 2) } } })
      });
      if (!patchRes.ok) throw new Error('Gist update failed');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ success: true, total: catalog.songs.length, lastUpdated: catalog.lastUpdated });
    } catch (error) {
      return res.status(500).json({ error: 'Gagal update katalog: ' + error.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
