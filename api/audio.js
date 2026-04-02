const PIPED_INSTANCES = [
  'https://pipedapi.adminforge.de',
  'https://piped-api.garudalinux.org',
  'https://api.piped.yt',
  'https://pipedapi.in.projectsegfau.lt',
  'https://pipedapi.drgns.space'
];

async function searchYouTube(query) {
  for (const instance of PIPED_INSTANCES) {
    try {
      const res = await fetch(
        `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(5000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const video = data?.items?.find(i => i.type === 'stream' || i.duration > 0);
      if (video) {
        const videoId = video.url?.replace('/watch?v=', '') || video.videoId;
        return { videoId, instance };
      }
    } catch(e) { continue; }
  }
  return null;
}

async function getAudioStream(videoId, instance) {
  for (const inst of [instance, ...PIPED_INSTANCES.filter(i => i !== instance)]) {
    try {
      const res = await fetch(
        `${inst}/streams/${videoId}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (!data?.audioStreams?.length) continue;

      // Best audio quality
      const streams = data.audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      const best = streams.find(s => s.mimeType?.includes('audio')) || streams[0];

      if (best?.url) {
        return {
          url: best.url,
          title: data.title || '',
          artist: data.uploader || 'Unknown',
          duration: data.duration || 0,
          image: data.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          video_id: videoId
        };
      }
    } catch(e) { continue; }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query, video_id } = req.query;

  try {
    let videoId = video_id;
    let instance = PIPED_INSTANCES[0];

    // Agar sirf video_id diya hai
    if (!videoId) {
      if (!query) return res.status(400).json({ error: 'query or video_id required' });
      const result = await searchYouTube(query);
      if (!result) return res.status(404).json({ error: 'No results found' });
      videoId = result.videoId;
      instance = result.instance;
    }

    const audioData = await getAudioStream(videoId, instance);
    if (!audioData) return res.status(404).json({ error: 'No audio stream found' });

    return res.status(200).json(audioData);

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
