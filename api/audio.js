import crypto from 'crypto';

function decryptUrl(encUrl) {
  try {
    const key = Buffer.from('38346591');
    const decipher = crypto.createDecipheriv('des-ecb', key, '');
    decipher.setAutoPadding(false);
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(encUrl, 'base64')),
      decipher.final()
    ]).toString().replace(/\0/g, '').trim();
    return decrypted.replace('http://', 'https://').replace('_96.mp4', '_320.mp4').replace('_160.mp4', '_320.mp4');
  } catch(e) {
    // Fallback — remove ID2ie prefix, use CDN directly
    return `https://aac.saavncdn.com/${encUrl.replace('ID2ie', '')}_320.mp4`;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const searchRes = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=wap6dot0&n=1&p=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.jiosaavn.com/' } }
    );
    const searchData = await searchRes.json();
    const song = searchData?.results?.[0];
    if (!song) return res.status(404).json({ error: 'Song not found' });

    const encUrl = song.encrypted_media_url;
    if (!encUrl) return res.status(404).json({ error: 'No encrypted URL' });

    const audioUrl = decryptUrl(encUrl);

    return res.status(200).json({
      url: audioUrl,
      title: song.song || query,
      artist: song.singers || 'Unknown',
      duration: parseInt(song.duration || 0),
      image: (song.image || '').replace('150x150', '500x500')
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
