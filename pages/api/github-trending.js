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

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=7200, stale-while-revalidate=3600');

  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

  const headers = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'HN-GitHub-Reader/1.0',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  let data;
  try {
    const ghRes = await fetchWithTimeout(
      `https://api.github.com/search/repositories?q=created:>${since}&sort=stars&order=desc&per_page=30`,
      { headers },
      10000
    );
    if (!ghRes.ok) throw new Error(`GitHub API error: ${ghRes.status}`);
    data = await ghRes.json();
  } catch (err) {
    return res.status(502).json({ error: 'Failed to fetch from GitHub: ' + err.message });
  }

  const items = (data.items || []).map(repo => ({
    id: repo.id,
    owner: repo.owner.login,
    repo: repo.name,
    url: repo.html_url,
    description: repo.description,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    watchers_count: repo.watchers_count,
    topics: repo.topics || [],
    license: repo.license,
    pushed_at: repo.pushed_at,
    created_at: repo.created_at,
    homepage: repo.homepage,
  }));

  res.json({ items, fetchedAt: new Date().toISOString() });
}
