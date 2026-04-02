export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  const { query } = req.query;
  if (!query) return res.status(400).json({ error: 'query required' });

  try {
    // 'query' ki jagah 'q' use karo
    const searchUrl = `https://www.jiosaavn.com/api.php?__call=search.getResults&q=${encodeURIComponent(query)}&_format=json&_marker=0&ctx=wap6dot0&n=1&p=1`;

    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.jiosaavn.com/'
      }
    });

    const text = await searchRes.text();
    return res.status(200).json({ raw: text.substring(0, 3000) });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
}
