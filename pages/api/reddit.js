const SUBREDDITS = 'programming+MachineLearning+webdev+javascript+Python+golang+rust+devops';

function decodeXml(str) {
  if (!str) return '';
  return str
    .replace(/&#32;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractEntries(xml) {
  const entries = [];
  const re = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = re.exec(xml)) !== null) entries.push(m[1]);
  return entries;
}

function parseEntry(entry) {
  const getTag = (tag) => {
    const m = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`).exec(entry);
    return m ? m[1].trim() : '';
  };

  const title = decodeXml(getTag('title'));
  const permalink = (/<link[^>]+href="([^"]+)"/.exec(entry) || [])[1] || '';

  const idMatch = /\/comments\/([a-z0-9]+)\//.exec(permalink);
  const id = idMatch ? idMatch[1] : '';

  const authorMatch = /<author>[\s\S]*?<name>([^<]+)<\/name>/.exec(entry);
  const author = authorMatch ? authorMatch[1].replace(/^\/u\//, '') : '';

  const subreddit = (/<category term="([^"]+)"/.exec(entry) || [])[1] || '';
  const published = getTag('published');

  const content = decodeXml(getTag('content'));
  const linkMatch = /href="([^"]+)">\[link\]/.exec(content);
  const url = linkMatch ? linkMatch[1] : permalink;
  const isSelf = !linkMatch || url.includes('reddit.com/r/');

  let domain = '';
  if (!isSelf && url) {
    try { domain = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  }

  if (!id || !title) return null;
  return { id, title, author, subreddit, permalink, url: isSelf ? permalink : url, isSelf, domain, createdAt: published };
}

async function fetchWithTimeout(url, options = {}, ms = 10000) {
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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

  let xml;
  try {
    const r = await fetchWithTimeout(
      `https://www.reddit.com/r/${SUBREDDITS}/top.rss?t=day&limit=50`,
      { headers: { 'User-Agent': 'HN-GitHub-Reader/1.0' } }
    );
    if (!r.ok) throw new Error(`Reddit RSS error: ${r.status}`);
    xml = await r.text();
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch Reddit feed: ' + err.message });
  }

  const seen = new Set();
  const posts = extractEntries(xml)
    .map(parseEntry)
    .filter(p => p && !seen.has(p.id) && seen.add(p.id));

  res.json({ posts, fetchedAt: new Date().toISOString() });
}
