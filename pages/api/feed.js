const SKIP_OWNERS = new Set([
  'about', 'contact', 'login', 'signup', 'features', 'pricing',
  'topics', 'explore', 'trending', 'marketplace', 'settings',
  'dashboard', 'notifications', 'pulls', 'issues', 'orgs',
  'organizations', 'collections', 'apps', 'sponsors',
]);

function extractGitHubRepo(url) {
  if (!url || !url.includes('github.com')) return null;
  const match = url.match(/github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (!match) return null;
  const [, owner, repo] = match;
  if (SKIP_OWNERS.has(owner.toLowerCase())) return null;
  return { owner, repo: repo.replace(/\.git$/, '') };
}

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

async function fetchGitHubRepo(owner, repo) {
  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'HN-GitHub-Reader/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }
  try {
    const res = await fetchWithTimeout(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers }
    );
    if (res.status === 404 || res.status === 403 || res.status === 451) return null;
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=3600');

  const since = Math.floor((Date.now() - 48 * 3600 * 1000) / 1000);

  let hnData;
  try {
    const hnRes = await fetchWithTimeout(
      `https://hn.algolia.com/api/v1/search?query=github.com&tags=story&hitsPerPage=40&numericFilters=points>5,created_at_i>${since}`,
      {},
      10000
    );
    hnData = await hnRes.json();
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch from HN: ' + err.message });
  }

  const seen = new Set();
  const stories = [];

  for (const hit of hnData.hits || []) {
    const parsed = extractGitHubRepo(hit.url);
    if (!parsed) continue;
    const key = `${parsed.owner}/${parsed.repo}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    stories.push({ hit, ...parsed });
  }

  const settled = await Promise.allSettled(
    stories.slice(0, 20).map(async ({ hit, owner, repo }) => {
      const github = await fetchGitHubRepo(owner, repo);
      return {
        hnId: hit.objectID,
        hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
        title: hit.title,
        url: hit.url,
        points: hit.points || 0,
        numComments: hit.num_comments || 0,
        author: hit.author,
        createdAt: hit.created_at,
        owner,
        repo,
        github,
      };
    })
  );

  const items = settled
    .filter(r => r.status === 'fulfilled' && r.value.github)
    .map(r => r.value)
    .sort((a, b) => b.points - a.points);

  res.json({ items, fetchedAt: new Date().toISOString() });
}
