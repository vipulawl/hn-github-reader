const HN_API = 'https://hacker-news.firebaseio.com/v0';

async function fetchItem(id) {
  try {
    const res = await fetch(`${HN_API}/item/${id}.json`);
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'id required' });

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=1800');

  try {
    const story = await fetchItem(id);
    if (!story || !story.kids) return res.json({ comments: [] });

    const topIds = story.kids.slice(0, 6);
    const settled = await Promise.allSettled(topIds.map(fetchItem));

    const comments = settled
      .filter(r => r.status === 'fulfilled' && r.value && !r.value.deleted && !r.value.dead && r.value.text)
      .map(r => r.value)
      .slice(0, 5);

    res.json({ comments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
