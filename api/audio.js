const INVIDIOUS_INSTANCES = [
  'https://invidious.fdn.fr',
  'https://invidious.privacyredirect.com',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://invidious.lunar.icu',
  'https://iv.datura.network',
  'https://invidious.perennialte.ch'
];

async function searchAndGetAudio(query) {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      // Search
      const searchRes = await fetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video&fields=videoId,title,author,lengthSeconds,videoThumbnails`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(6000) }
      );
      if (!searchRes.ok) continue;
      const results = await searchRes.json();
      if (!results?.length) continue;

      const video = results[0];
      const videoId = video.videoId;

      // Audio streams
      const streamRes = await fetch(
        `${instance}/api/v1/videos/${videoId}?fields=adaptiveFormats,formatStreams,title,author,lengthSeconds,videoThumbnails`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      );
      if (!streamRes.ok) continue;
      const streamData = await streamRes.json();

      const audioFormats = (streamData.adaptiveFormats || [])
        .filter(f => f.type?.startsWith('audio/') && f.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (!audioFormats.length) continue;

      const best = audioFormats[0];
      const thumb = video.videoThumbnails?.find(t => t.quality === 'high')?.url ||
                    video.videoThumbnails?.[0]?.url ||
                    `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

      return {
        url: best.url,
        title: video.title || streamData.title || query,
        artist: video.author || streamData.author || 'Unknown',
        duration: video.lengthSeconds || streamData.lengthSeconds || 0,
        image: thumb.startsWith('http') ? thumb : `${instance}${thumb}`,
        video_id: videoId,
        source: instance
      };

    } catch(e) { continue; }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query, video_id } = req.query;
  if (!query && !video_id) return res.status(400).json({ error: 'query or video_id required' });

  try {
    const searchQuery = query || video_id;
    const result = await searchAndGetAudio(searchQuery);
    if (!result) return res.status(404).json({ error: 'No audio found' });
    return res.status(200).json(result);
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
