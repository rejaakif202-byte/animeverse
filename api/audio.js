export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { video_id } = req.query;
  if (!video_id) return res.status(400).json({ error: 'video_id required' });

  try {
    const ytUrl = `https://www.youtube.com/watch?v=${video_id}`;

    const response = await fetch(ytUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      }
    });

    const html = await response.text();

    // ytInitialPlayerResponse extract karo
    const match = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\})\s*;?\s*(?:var|const|let|window|<\/script)/s);
    if (!match) return res.status(500).json({ error: 'Could not find player data' });

    let playerData;
    try {
      playerData = JSON.parse(match[1]);
    } catch(e) {
      return res.status(500).json({ error: 'Could not parse player data' });
    }

    const formats = [
      ...(playerData?.streamingData?.formats || []),
      ...(playerData?.streamingData?.adaptiveFormats || [])
    ];

    // Audio only formats filter karo
    const audioFormats = formats.filter(f =>
      f.mimeType && f.mimeType.startsWith('audio/') && f.url && !f.signatureCipher
    );

    if (audioFormats.length === 0) {
      // Fallback — any format with audio
      const anyAudio = formats.filter(f => f.url && f.audioQuality);
      if (anyAudio.length === 0) {
        return res.status(500).json({ error: 'No direct audio URL found' });
      }
      anyAudio.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = anyAudio[0];
      return res.status(200).json({
        url: best.url,
        mimeType: best.mimeType || 'audio/mp4',
        quality: best.audioQuality
      });
    }

    // Highest bitrate select karo
    audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const best = audioFormats[0];

    return res.status(200).json({
      url: best.url,
      mimeType: best.mimeType,
      quality: best.audioQuality || 'unknown'
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
