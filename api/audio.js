import crypto from 'crypto';

function decryptUrl(encUrl) {
  try {
    const key = '38346591';
    const enc = decodeURIComponent(encUrl);
    const buff = Buffer.from(enc, 'base64');
    
    // DES ECB no padding
    const decipher = crypto.createDecipheriv('des-ecb', Buffer.from(key), null);
    decipher.setAutoPadding(false);
    
    let decrypted = Buffer.concat([decipher.update(buff), decipher.final()]);
    let url = decrypted.toString('ascii').replace(/\0|\r|\n/g, '').trim();
    
    // Quality upgrade
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
    // Step 1 — Search
    const searchRes = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=wap6dot0&n=1&p=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.jiosaavn.com/' } }
    );
    const searchData = await searchRes.json();
    const song = searchData?.results?.[0];
    if (!song) return res.status(404).json({ error: 'Song not found' });

    // Step 2 — Song details ID se lo
    const detailRes = await fetch(
      `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0&_format=json&pids=${song.id}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.jiosaavn.com/' } }
    );
    const detailData = await detailRes.json();
    const detail = detailData?.[song.id]?.more_info || song.more_info || {};

    const encUrl = detail.encrypted_media_url || song.encrypted_media_url;
    
    // Debug: raw enc url bhi bhejo
    if (!encUrl) {
      return res.status(404).json({ 
        error: 'No encrypted URL',
        song_keys: Object.keys(song),
        detail_keys: Object.keys(detail)
      });
    }

    const audioUrl = decryptUrl(encUrl);

    return res.status(200).json({
      url: audioUrl,
      raw_enc: encUrl.substring(0, 50),
      title: song.song || query,
      artist: song.singers || 'Unknown',
      duration: parseInt(song.duration || 0),
      image: (song.image || '').replace('150x150', '500x500')
    });

  } catch(e) {
    return res.status(500).json({ error: e.message, stack: e.stack?.substring(0, 200) });
  }
}
