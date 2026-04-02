import crypto from 'crypto';

function decryptJioSaavn(encUrl) {
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
    return `https://aac.saavncdn.com/${encUrl.replace('ID2ie', '')}_320.mp4`;
  }
}

async function getFromJioSaavn(query) {
  try {
    const res = await fetch(
      `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=wap6dot0&n=1&p=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Referer': 'https://www.jiosaavn.com/' } }
    );
    const data = await res.json();
    const song = data?.results?.[0];
    if (!song || !song.encrypted_media_url) return null;

    const audioUrl = decryptJioSaavn(song.encrypted_media_url);
    if (!audioUrl) return null;

    return {
      url: audioUrl,
      title: song.song || query,
      artist: song.singers || 'Unknown',
      duration: parseInt(song.duration || 0),
      image: (song.image || '').replace('150x150', '500x500'),
      source: 'jiosaavn'
    };
  } catch(e) {
    return null;
  }
}

async function getFromDeezer(query) {
  try {
    const res = await fetch(
      `https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const track = data?.data?.[0];
    if (!track || !track.preview) return null;

    return {
      url: track.preview,
      title: track.title || query,
      artist: track.artist?.name || 'Unknown',
      duration: track.duration || 30,
      image: track.album?.cover_xl || track.album?.cover_big || '',
      source: 'deezer',
      preview: true
    };
  } catch(e) {
    return null;
  }
}

async function getFromPiped(query) {
  try {
    // YouTube search
    const searchRes = await fetch(
      `https://pipedapi.adminforge.de/search?q=${encodeURIComponent(query)}&filter=videos`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const searchData = await searchRes.json();
    const video = searchData?.items?.[0];
    if (!video) return null;

    const videoId = video.url?.replace('/watch?v=', '');
    if (!videoId) return null;

    // Streams fetch karo
    const streamRes = await fetch(
      `https://pipedapi.adminforge.de/streams/${videoId}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const streamData = await streamRes.json();

    const audioStreams = streamData?.audioStreams || [];
    audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const best = audioStreams[0];

    if (!best?.url) return null;

    return {
      url: best.url,
      title: streamData.title || video.title || query,
      artist: streamData.uploader || 'Unknown',
      duration: Math.floor((streamData.duration || 0)),
      image: streamData.thumbnailUrl || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      source: 'youtube',
      video_id: videoId
    };
  } catch(e) {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  // Source 1 — JioSaavn (Indian songs best)
  const jioResult = await getFromJioSaavn(query);
  if (jioResult) return res.status(200).json(jioResult);

  // Source 2 — Piped/YouTube (International songs)
  const pipedResult = await getFromPiped(query);
  if (pipedResult) return res.status(200).json(pipedResult);

  // Source 3 — Deezer (30-sec preview fallback)
  const deezerResult = await getFromDeezer(query);
  if (deezerResult) return res.status(200).json(deezerResult);

  return res.status(404).json({ error: 'Song not found on any source' });
}
