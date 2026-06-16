import { useState, useEffect, useCallback, useRef } from 'react';
import Head from 'next/head';
import Link from 'next/link';

function formatNum(n) {
  if (n == null) return '0';
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function domainOf(url) {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

const SORTS = [
  { id: 'points', label: 'Top' },
  { id: 'date', label: 'Newest' },
];

const RANGES = [
  { id: 'all', label: 'All time' },
  { id: 'day', label: 'Past day' },
  { id: 'week', label: 'Past week' },
  { id: 'month', label: 'Past month' },
  { id: 'year', label: 'Past year' },
];

function SkeletonRow() {
  return (
    <div className="p-4 border-b border-gray-800/60 animate-pulse">
      <div className="h-3 bg-gray-800 rounded w-2/3 mb-2" />
      <div className="flex gap-3">
        <div className="h-2 bg-gray-800/70 rounded w-14" />
        <div className="h-2 bg-gray-800/70 rounded w-14" />
        <div className="h-2 bg-gray-800/70 rounded w-20" />
      </div>
    </div>
  );
}

function ResultRow({ item }) {
  const domain = domainOf(item.url);
  return (
    <div className="p-4 border-b border-gray-800/60 hover:bg-gray-800/30 transition-colors">
      <div className="flex items-start justify-between gap-3 mb-1.5">
        <a
          href={item.url || item.hnUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-gray-200 hover:text-white leading-snug"
        >
          {item.title}
        </a>
        <span className="flex-shrink-0 text-xs font-semibold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
          ▲ {item.points}
        </span>
      </div>
      <div className="flex items-center gap-3 flex-wrap text-xs text-gray-600">
        {domain && <span className="text-gray-500">{domain}</span>}
        <span>by {item.author}</span>
        <span>{timeAgo(item.createdAt)}</span>
        <a
          href={item.hnUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-600 hover:text-orange-400 transition-colors"
        >
          💬 {formatNum(item.numComments)} comments
        </a>
      </div>
    </div>
  );
}

export default function Search() {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('points');
  const [range, setRange] = useState('all');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searched, setSearched] = useState(false);
  const ctrlRef = useRef(null);

  const runSearch = useCallback((q, s, r) => {
    if (!q.trim()) {
      setItems([]);
      setSearched(false);
      return;
    }
    if (ctrlRef.current) ctrlRef.current.abort();
    const ctrl = new AbortController();
    ctrlRef.current = ctrl;

    setLoading(true);
    setError(null);
    setSearched(true);

    fetch(`/api/search?q=${encodeURIComponent(q)}&sort=${s}&range=${r}`, { signal: ctrl.signal })
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => setItems(data.items || []))
      .catch(e => {
        if (e.name !== 'AbortError') setError('Search failed. ' + e.message);
      })
      .finally(() => setLoading(false));
  }, []);

  // Debounced search-as-you-type
  useEffect(() => {
    const timer = setTimeout(() => runSearch(query, sort, range), 350);
    return () => clearTimeout(timer);
  }, [query, sort, range, runSearch]);

  return (
    <>
      <Head>
        <title>Search Hacker News — HN × GitHub</title>
        <meta name="description" content="Search Hacker News by topic, sorted by upvotes or date" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔍</text></svg>"
        />
      </Head>

      <div className="h-screen flex flex-col bg-[#0d1117] text-gray-100 overflow-hidden font-sans">
        {/* Header */}
        <header className="border-b border-gray-800/80 px-5 py-3 flex items-center justify-between flex-shrink-0 bg-[#0d1117]/95 backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-base tracking-tight">
              <span className="text-orange-500">HN</span>
              <span className="text-gray-700 mx-1.5">×</span>
              <span className="text-white">Search</span>
            </h1>
            <span className="text-xs text-gray-600 hidden sm:block border-l border-gray-800 pl-3">
              Search any topic, ranked by upvotes or date
            </span>
          </div>
          <Link
            href="/"
            className="text-xs px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md border border-gray-700/50 transition-colors"
          >
            ← Trending repos
          </Link>
        </header>

        {/* Search bar + filters */}
        <div className="border-b border-gray-800/60 px-5 py-3 flex flex-col sm:flex-row gap-3 flex-shrink-0">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search a topic, e.g. &quot;hotel&quot;…"
            className="flex-1 bg-gray-900/80 border border-gray-800 rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-orange-600/50"
          />
          <div className="flex gap-2 flex-shrink-0">
            <div className="flex bg-gray-900/80 border border-gray-800 rounded-md overflow-hidden">
              {SORTS.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSort(s.id)}
                  className={`text-xs px-3 py-2 transition-colors ${
                    sort === s.id ? 'bg-orange-600/20 text-orange-400' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <select
              value={range}
              onChange={e => setRange(e.target.value)}
              className="bg-gray-900/80 border border-gray-800 rounded-md px-2 py-2 text-xs text-gray-400 focus:outline-none focus:border-orange-600/50"
            >
              {RANGES.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="px-5 py-2.5 bg-red-950/40 border-b border-red-900/30 text-red-400 text-xs">
              {error}
            </div>
          )}

          {!searched && !loading && (
            <div className="flex-1 h-full flex items-center justify-center text-gray-700">
              <div className="text-center select-none">
                <p className="text-5xl mb-3 opacity-30">🔍</p>
                <p className="text-sm">Type a topic to search Hacker News</p>
              </div>
            </div>
          )}

          {loading && items.length === 0 && searched &&
            Array(8).fill(0).map((_, i) => <SkeletonRow key={i} />)
          }

          {searched && !loading && items.length === 0 && (
            <div className="flex-1 h-full flex items-center justify-center text-gray-700">
              <p className="text-sm">No results for "{query}"</p>
            </div>
          )}

          {items.map(item => <ResultRow key={item.id} item={item} />)}
        </div>

        <div className="border-t border-gray-800/60 px-5 py-2 text-xs text-gray-800 flex-shrink-0 flex justify-between">
          <span>{searched ? `${items.length} results` : ''}</span>
          <span>powered by HN Algolia API</span>
        </div>
      </div>
    </>
  );
}
