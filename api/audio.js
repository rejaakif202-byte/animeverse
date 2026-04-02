import crypto from 'crypto';

function decryptUrl(encryptedUrl) {
  try {
    const key = '38346591';
    const iv = '\0\0\0\0\0\0\0\0';
    const decipher = crypto.createDecipheriv(
      'des-ecb',
      Buffer.from(key),
      Buffer.alloc(0)
    );
    decipher.setAutoPadding(false);
    const decoded = Buffer.from(encryptedUrl, 'base64');
    let decrypted = decipher.update(decoded);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString('utf8').replace(/\0/g, '').replace('http://', 'https://').replace('_96.', '_320.');
  } catch(e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=wap6dot0&n=1&p=1`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });

    const data = await searchRes.json();
    const song = data?.results?.[0];
    if (!song) return res.status(404).json({ error: 'Song not found' });

    const title = song.song || query;
    const artist = song.singers || song.primary_artists || 'Unknown';
    const duration = parseInt(song.duration || 0);
    const image = (song.image || '').replace('150x150', '500x500');
    const encryptedUrl = song.encrypted_media_url;

    if (!encryptedUrl) {
      return res.status(404).json({ error: 'No encrypted URL found' });
    }

    const audioUrl = decryptUrl(encryptedUrl);

    if (!audioUrl) {
      return res.status(500).json({ error: 'Decryption failed' });
    }

    return res.status(200).json({
      url: audioUrl,
      title,
      artist,
      duration,
      image
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
