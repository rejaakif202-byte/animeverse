export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const query = req.query.q;
  
  if (!query) {
    return res.status(400).json({ error: 'Query required' });
  }

  try {
    const searchQuery = encodeURIComponent(query);
    const url = `https://www.youtube.com/results?search_query=${searchQuery}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });
    
    const html = await response.text();
    
    // Extract ytInitialData
    const match = html.match(/var ytInitialData = ({.+?});/);
    if (!match) {
      return res.status(404).json({ error: 'No results found' });
    }
    
    const data = JSON.parse(match[1]);
    
    // Navigate to video results
    const contents = data?.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents?.[0]
      ?.itemSectionRenderer?.contents;
    
    if (!contents) {
      return res.status(404).json({ error: 'No results found' });
    }
    
    // Find first video
    let video = null;
    for (const item of contents) {
      if (item.videoRenderer) {
        video = item.videoRenderer;
        break;
      }
    }
    
    if (!video) {
      return res.status(404).json({ error: 'No video found' });
    }
    
    // Extract info
    const videoId = video.videoId;
    const title = video.title?.runs?.[0]?.text || query;
    const channel = video.ownerText?.runs?.[0]?.text || 'Unknown';
    const durationText = video.lengthText?.simpleText || '0:00';
    
    // Convert duration to seconds
    const parts = durationText.split(':').reverse();
    let seconds = 0;
    if (parts[0]) seconds += parseInt(parts[0]);
    if (parts[1]) seconds += parseInt(parts[1]) * 60;
    if (parts[2]) seconds += parseInt(parts[2]) * 3600;
    
    return res.status(200).json({
      video_id: videoId,
      title: title,
      channel: channel,
      duration: seconds,
      duration_text: durationText,
      thumbnail: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
    });
    
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
