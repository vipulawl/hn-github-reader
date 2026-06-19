const SUBREDDITS = 'MachineLearning+LocalLLaMA+artificial+ClaudeAI+ChatGPT+singularity+LLMDevs+PromptEngineering';

async function fetchWithTimeout(url, options = {}, ms = 8000) {
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
  if (!data.access_token) throw new Error('No access token in Reddit response');
  return data.access_token;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Reddit credentials not configured. Add REDDIT_CLIENT_ID and REDDIT_CLIENT_SECRET to .env.local' });
  }

  let token;
  try {
    token = await getRedditToken();
  } catch (err) {
    return res.status(502).json({ error: 'Reddit auth error: ' + err.message });
  }

  let data;
  try {
    const r = await fetchWithTimeout(
      `https://oauth.reddit.com/r/${SUBREDDITS}/top?t=day&limit=50&raw_json=1`,
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
    return res.status(502).json({ error: 'Reddit fetch error: ' + err.message });
  }

  const posts = (data.data?.children || [])
    .map(c => c.data)
    .filter(p => !p.stickied)
    .map(p => ({
      id: p.id,
      title: p.title,
      subreddit: p.subreddit,
      author: p.author,
      score: p.score,
      numComments: p.num_comments,
      url: p.url,
      permalink: `https://reddit.com${p.permalink}`,
      isSelf: p.is_self,
      selfTextHtml: p.selftext_html || null,
      createdAt: new Date(p.created_utc * 1000).toISOString(),
      domain: p.domain,
      flair: p.link_flair_text,
    }));

  res.json({ posts, fetchedAt: new Date().toISOString() });
}
