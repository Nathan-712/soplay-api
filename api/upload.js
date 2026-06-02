// api/upload.js
import { put } from '@vercel/blob';

// Gunakan Node.js runtime (default), BUKAN edge
export const config = {
  api: {
    bodyParser: false, // Kita handle manual
  },
};

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Parse multipart form data secara manual
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    // Ambil boundary dari content-type
    const contentType = req.headers['content-type'] || '';
    const boundary = contentType.split('boundary=')[1];
    
    if (!boundary) {
      return res.status(400).json({ error: 'Invalid content-type' });
    }

    // Parse form data sederhana
    const formData = parseMultipart(buffer, boundary);
    const file = formData.files.file;
    const title = formData.fields.title || (file ? file.filename.replace(/\.[^/.]+$/, '') : 'Unknown');
    const artist = formData.fields.artist || 'Unknown Artist';
    const album = formData.fields.album || 'Unknown Album';

    if (!file) {
      return res.status(400).json({ error: 'File tidak ditemukan' });
    }

    // Upload ke Vercel Blob
    const blob = await put(`soplay/${Date.now()}-${file.filename}`, file.buffer, {
      access: 'public',
      addRandomSuffix: true,
      contentType: file.mimetype,
    });

    return res.status(200).json({
      success: true,
      url: blob.url,
      title,
      artist,
      album,
      size: file.buffer.length,
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return res.status(500).json({ error: 'Gagal upload: ' + error.message });
  }
}

// Helper function untuk parse multipart form data
function parseMultipart(buffer, boundary) {
  const result = { fields: {}, files: {} };
  const boundaryString = `--${boundary}`;
  const parts = buffer.toString('binary').split(boundaryString);

  for (const part of parts) {
    if (part.trim() === '' || part.trim() === '--') continue;

    const [headers, ...bodyParts] = part.split('\r\n\r\n');
    const body = bodyParts.join('\r\n\r\n').trim();

    // Parse content-disposition header
    const dispositionMatch = headers.match(/content-disposition:.*?name="(.*?)"(?:; filename="(.*?)")?/i);
    if (!dispositionMatch) continue;

    const [, name, filename] = dispositionMatch;

    if (filename) {
      // Ini file
      const contentType = headers.match(/content-type: (.*?)\r\n/i)?.[1] || 'application/octet-stream';
      const fileBuffer = Buffer.from(body, 'binary');
      result.files[name] = {
        filename: filename.replace(/\r\n$/, ''),
        mimetype: contentType,
        buffer: fileBuffer,
      };
    } else {
      // Ini field biasa
      result.fields[name] = body.replace(/\r\n$/, '');
    }
  }

  return result;
}
