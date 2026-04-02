export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  const apis = [
    `https://jiosaavn-api-privatecvc2.vercel.app/api/search/songs?query=${encodeURIComponent(query)}&limit=1`,
    `https://saavn.dev/api/search/songs?query=${encodeURIComponent(query)}&limit=1`,
    `https://jiosaavn-api-five.vercel.app/api/search/songs?query=${encodeURIComponent(query)}&limit=1`
  ];

  let song = null;

  for (const url of apis) {
    try {
      const r = await fetch(url);
      const d = await r.json();
      song = d?.data?.results?.[0];
      if (song) break;
    } catch(e) {
      continue;
    }
  }

  if (!song) return res.status(404).json({ error: 'Song not found on any source' });

  const urls = song.downloadUrl || song.download_url || [];
  const best = urls.find(u => u.quality === '320kbps') ||
               urls.find(u => u.quality === '160kbps') ||
               urls.find(u => u.quality === '96kbps') ||
               urls[urls.length - 1];

  if (!best?.url) return res.status(404).json({ error: 'No audio URL found' });

  return res.status(200).json({
    url: best.url,
    title: song.name || song.title || query,
    artist: song.artists?.primary?.[0]?.name || song.primaryArtists || 'Unknown',
    duration: song.duration || 0,
    image: song.image?.[2]?.url || song.image?.[1]?.url || song.image?.[0]?.url || ''
  });
}
