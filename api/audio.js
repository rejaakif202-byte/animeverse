export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    const searchUrl = `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=1`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    const song = data?.data?.results?.[0];
    if (!song) return res.status(404).json({ error: 'Song not found' });

    const urls = song.downloadUrl;
    const best = urls?.find(u => u.quality === '320kbps') ||
                 urls?.find(u => u.quality === '160kbps') ||
                 urls?.[urls.length - 1];

    if (!best?.url) return res.status(404).json({ error: 'No audio URL' });

    return res.status(200).json({
      url: best.url,
      title: song.name,
      artist: song.artists?.primary?.[0]?.name || 'Unknown',
      duration: song.duration,
      image: song.image?.[2]?.url || song.image?.[1]?.url || ''
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
