import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const { video_id } = req.query;
  if (!video_id) return res.status(400).json({ error: 'video_id required' });

  try {
    const info = await ytdl.getInfo(`https://www.youtube.com/watch?v=${video_id}`, {
      requestOptions: {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      }
    });
    
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestaudio', 
      filter: 'audioonly' 
    });
    
    return res.status(200).json({ 
      url: format.url, 
      mimeType: format.mimeType,
      contentLength: format.contentLength
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
