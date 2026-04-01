export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const { video_id } = req.query;
  if (!video_id) return res.status(400).json({ error: 'video_id required' });

  try {
    const response = await fetch('https://api.cobalt.tools/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        url: `https://www.youtube.com/watch?v=${video_id}`,
        downloadMode: 'audio',
        audioFormat: 'mp3',
        audioBitrate: '128'
      })
    });

    const data = await response.json();

    if (data.url) {
      return res.status(200).json({ url: data.url });
    } else if (data.tunnel) {
      return res.status(200).json({ url: data.tunnel });
    } else {
      return res.status(500).json({ error: 'No audio URL found', raw: data });
    }

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
