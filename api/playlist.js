const GIST_ID = process.env.PLAYLIST_GIST_ID;
const GIST_TOKEN = process.env.GIST_TOKEN;
const GIST_API_URL = `https://api.github.com/gists/${GIST_ID}`;
const FILENAME = 'soplay-playlists.json';

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
      const doc = JSON.parse(data.files[FILENAME].content);
      if (doc.lastUpdated <= since) return res.status(200).json({ playlists: doc.playlists, lastUpdated: doc.lastUpdated, changed: false });
      const etag = gistRes.headers.get('ETag');
      if (etag) res.setHeader('ETag', etag);
      return res.status(200).json({ playlists: doc.playlists, lastUpdated: doc.lastUpdated, changed: true });
    } catch (e) {
      return res.status(200).json({ playlists: [], lastUpdated: 0, changed: false });
    }
  }

  if (req.method === 'POST') {
    try {
      const { action, playlistId, data } = req.body;
      const gistRes = await fetch(GIST_API_URL, { headers: { 'Authorization': `token ${GIST_TOKEN}`, 'User-Agent': 'Soplay-App/1.0' } });
      const gistData = await gistRes.json();
      const doc = JSON.parse(gistData.files[FILENAME].content);

      if (action === 'create') {
        doc.playlists.unshift({
          id: playlistId || `pl_${Date.now()}_${Math.random().toString(36).substr(2,6)}`,
          name: data.name || 'Untitled', creator: data.creator || 'Anonymous',
          cover: data.cover || '', description: data.description || '',
          songs: data.songs || [], createdAt: Date.now(), updatedAt: Date.now(), playCount: 0
        });
      } else if (action === 'update' && playlistId) {
        const idx = doc.playlists.findIndex(p => p.id === playlistId);
        if (idx === -1) return res.status(404).json({ error: 'Playlist not found' });
        Object.assign(doc.playlists[idx], data, { updatedAt: Date.now() });
      } else if (action === 'delete' && playlistId) {
        doc.playlists = doc.playlists.filter(p => p.id !== playlistId);
      }
      doc.lastUpdated = Date.now();

      const patchRes = await fetch(GIST_API_URL, {
        method: 'PATCH',
        headers: { 'Authorization': `token ${GIST_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'Soplay-App/1.0' },
        body: JSON.stringify({ files: { [FILENAME]: { content: JSON.stringify(doc, null, 2) } } })
      });
      if (!patchRes.ok) throw new Error('Gist update failed');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.status(200).json({ success: true, lastUpdated: doc.lastUpdated });
    } catch (error) {
      return res.status(500).json({ error: 'Gagal update playlist: ' + error.message });
    }
  }
  return res.status(405).json({ error: 'Method not allowed' });
};
