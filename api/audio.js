export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    // Step 1 — Search karo
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&query=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=wap6dot0&n=1&p=1`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });

    const searchData = await searchRes.json();
    const song = searchData?.results?.[0];

    if (!song) return res.status(404).json({ error: 'Song not found' });

    const songId = song.id;
    const title = song.title || query;
    const artist = song.more_info?.singers || song.subtitle || 'Unknown';
    const duration = parseInt(song.more_info?.duration || 0);
    const image = song.image?.replace('150x150', '500x500') || '';

    // Step 2 — Audio URL lo
    const songUrl = `https://www.jiosaavn.com/api.php?__call=song.getDetails&cc=in&_marker=0%3F_marker%3D0&_format=json&pids=${songId}`;

    const songRes = await fetch(songUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });

    const songData = await songRes.json();
    const songInfo = songData?.[songId];

    if (!songInfo) return res.status(404).json({ error: 'Song details not found' });

    // Encrypted URL decode karo
    let audioUrl = songInfo.more_info?.encrypted_media_url || '';

    if (audioUrl) {
      // JioSaavn decrypt endpoint
      const decryptUrl = `https://www.jiosaavn.com/api.php?__call=media.getMediaURL&r=320&_format=json&_marker=0&ctx=wap6dot0&desiredQuality=high&url=${encodeURIComponent(audioUrl)}`;

      const decryptRes = await fetch(decryptUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Referer': 'https://www.jiosaavn.com/'
        }
      });

      const decryptData = await decryptRes.json();
      const finalUrl = decryptData?.auth_url || decryptData?.media_url || '';

      if (finalUrl) {
        return res.status(200).json({
          url: finalUrl,
          title,
          artist,
          duration,
          image
        });
      }
    }

    // Fallback — 320kbps direct try karo
    const directUrl = songInfo.more_info?.['320kbps'] === 'true'
      ? audioUrl.replace('_96.mp4', '_320.mp4')
      : audioUrl.replace('_96.mp4', '_160.mp4');

    return res.status(200).json({
      url: directUrl,
      title,
      artist,
      duration,
      image
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
