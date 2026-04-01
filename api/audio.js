export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const video_id = req.query.video_id;
  if (!video_id) return res.status(400).json({ error: 'video_id required' });

  try {
    const url = `https://www.youtube.com/watch?v=${video_id}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const html = await response.text();

    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.+?})\s*;/s);
    if (!match) return res.status(404).json({ error: 'Could not extract player data' });

    const playerData = JSON.parse(match[1]);
    const formats = playerData?.streamingData?.adaptiveFormats || [];

    const audioFormats = formats.filter(f => f.mimeType?.startsWith('audio/') && f.url);
    if (audioFormats.length === 0) return res.status(404).json({ error: 'No audio found' });

    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const best = audioFormats[0];

    return res.status(200).json({
      url: best.url,
      mimeType: best.mimeType
    });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
