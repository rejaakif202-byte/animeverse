import ytdl from 'ytdl-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { video_id } = req.query;
  if (!video_id) return res.status(400).json({ error: 'video_id required' });

  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${video_id}`);
    const format = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
    return res.status(200).json({ url: format.url, mimeType: format.mimeType });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
