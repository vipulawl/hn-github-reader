const RANGE_SECONDS = {
  day: 86400,
  week: 7 * 86400,
  month: 30 * 86400,
  year: 365 * 86400,
};

export default async function handler(req, res) {
  const { q = '', sort = 'points', range = 'all' } = req.query;

  if (!q.trim()) {
    return res.json({ items: [], query: q });
  }

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  const params = new URLSearchParams({
    query: q,
    tags: 'story',
    hitsPerPage: '100',
  });

  const seconds = RANGE_SECONDS[range];
  if (seconds) {
    const since = Math.floor(Date.now() / 1000) - seconds;
    params.set('numericFilters', `created_at_i>${since}`);
  }

  // Algolia exposes two endpoints: `search` (relevance-ranked) and
  // `search_by_date` (newest first). Neither sorts by points natively,
  // so for points we pull relevance-ranked hits and re-sort here.
  const endpoint = sort === 'date' ? 'search_by_date' : 'search';
  const url = `https://hn.algolia.com/api/v1/${endpoint}?${params.toString()}`;

  let data;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    data = await r.json();
  } catch (err) {
    return res.status(502).json({ error: 'Failed to query HN: ' + err.message });
  }

  let items = (data.hits || []).map(hit => ({
    id: hit.objectID,
    title: hit.title,
    url: hit.url,
    points: hit.points || 0,
    numComments: hit.num_comments || 0,
    author: hit.author,
    createdAt: hit.created_at,
    hnUrl: `https://news.ycombinator.com/item?id=${hit.objectID}`,
  }));

  if (sort === 'points') {
    items.sort((a, b) => b.points - a.points);
  }

  res.json({ items: items.slice(0, 60), query: q, sort, range });
}
