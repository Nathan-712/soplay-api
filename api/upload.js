// api/upload.js
import { put } from '@vercel/blob';

// Gunakan Edge runtime agar req.formData() berfungsi secara native
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  // Handle preflight CORS request
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  try {
    // Di Edge runtime, req adalah objek Request standar web API
    const formData = await req.formData();
    const file = formData.get('file');
    const title = formData.get('title') || (file ? file.name.replace(/\.[^/.]+$/, '') : 'Unknown');
    const artist = formData.get('artist') || 'Unknown Artist';
    const album = formData.get('album') || 'Unknown Album';

    if (!file) {
      return new Response(JSON.stringify({ error: 'File tidak ditemukan' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Upload ke Vercel Blob (Public)
    const blob = await put(`soplay/${Date.now()}-${file.name}`, file, {
      access: 'public',
      addRandomSuffix: true,
    });

    return new Response(JSON.stringify({
      success: true,
      url: blob.url,
      title,
      artist,
      album,
      size: file.size
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });

  } catch (error) {
    console.error('Upload Error:', error);
    return new Response(JSON.stringify({ error: 'Gagal upload ke storage: ' + error.message }), { 
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
