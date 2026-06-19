async function fetchWithTimeout(url, options = {}, ms = 6000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(timer);
    return res;
  } catch (e) {
    clearTimeout(timer);
    throw e;
  }
}

async function getRedditToken() {
  const creds = Buffer.from(
    `${process.env.REDDIT_CLIENT_ID}:${process.env.REDDIT_CLIENT_SECRET}`
  ).toString('base64');
  const res = await fetchWithTimeout('https://www.reddit.com/api/v1/access_token', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'DevHub/1.0',
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status}`);
  const data = await res.json();
  if (!data.access_token) throw new Error('No access token');
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

  const { sub, id } = req.query;
  if (!sub || !id) return res.status(400).json({ error: 'Missing sub or id' });

  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    return res.json({ comments: [] });
  }

  let token;
  try {
    token = await getRedditToken();
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  let data;
  try {
    const r = await fetchWithTimeout(
      `https://oauth.reddit.com/r/${sub}/comments/${id}?limit=5&sort=top&depth=1&raw_json=1`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          'User-Agent': 'DevHub/1.0',
        },
      }
    );
    if (!r.ok) throw new Error(`Reddit API error: ${r.status}`);
    data = await r.json();
  } catch (err) {
    return res.status(502).json({ error: err.message });
  }

  const listing = Array.isArray(data) ? (data[1]?.data?.children || []) : [];
  const comments = listing
    .filter(c => c.kind === 't1' && c.data?.body && c.data.body !== '[deleted]' && c.data.body !== '[removed]')
    .slice(0, 5)
    .map(c => ({
      id: c.data.id,
      author: c.data.author,
      score: c.data.score,
      body: c.data.body,
      bodyHtml: c.data.body_html || null,
      createdAt: new Date(c.data.created_utc * 1000).toISOString(),
    }));

  res.json({ comments });
}
