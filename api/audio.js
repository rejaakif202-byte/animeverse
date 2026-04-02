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

    const songId = song.id;
    const title = song.song || query;
    const artist = song.singers || song.primary_artists || 'Unknown';
    const duration = parseInt(song.duration || 0);
    const image = (song.image || '').replace('150x150', '500x500');

    // Decrypt audio URL
    const decryptUrl = `https://www.jiosaavn.com/api.php?__call=media.getMediaURL&r=320&_format=json&_marker=0&ctx=wap6dot0&desiredQuality=_320&url=${encodeURIComponent(song.encrypted_media_url)}`;

    const decryptRes = await fetch(decryptUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });

    const decryptData = await decryptRes.json();
    const audioUrl = decryptData?.auth_url || decryptData?.media_url || '';

    if (!audioUrl) {
      return res.status(500).json({ error: 'Could not decrypt audio URL', raw: decryptData });
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
