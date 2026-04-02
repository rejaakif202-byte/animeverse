import crypto from 'crypto';

function decryptUrl(encUrl) {
  try {
    const key = Buffer.from('38346591');
    const iv = Buffer.alloc(8, 0);
    
    // Base64 decode
    const enc = Buffer.from(encUrl, 'base64');
    
    // DES CBC with zero IV
    const decipher = crypto.createDecipheriv('des-cbc', key, iv);
    decipher.setAutoPadding(false);
    
    let dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    let url = dec.toString('ascii').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim();
    
    url = url.replace('http://', 'https://');
    url = url.replace('_96.mp4', '_320.mp4');
    url = url.replace('_160.mp4', '_320.mp4');
    
    return url;
  } catch(e) {
    return null;
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

    if (!audioUrl || audioUrl.length < 10) {
      // Fallback — direct CDN URL try karo
      const fallback = `https://aac.saavncdn.com/${encUrl.replace('ID2ie', '')}_320.mp4`;
      return res.status(200).json({
        url: null,
        fallback,
        raw_enc: encUrl,
        debug: 'decryption failed'
      });
    }

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
