import { useState, useEffect, useRef, useCallback } from 'react';
import Head from 'next/head';
import Link from 'next/link';

const REFRESH_MS = 2 * 60 * 60 * 1000;
const REDDIT_REFRESH_MS = 60 * 60 * 1000;

const LANG_COLORS = {
  JavaScript: '#f7df1e', TypeScript: '#3178c6', Python: '#3572A5',
  Go: '#00ADD8', Rust: '#dea584', Java: '#b07219', 'C++': '#f34b7d',
  C: '#555555', Ruby: '#701516', Swift: '#FA7343', Kotlin: '#A97BFF',
  Dart: '#00B4AB', Shell: '#89e051', PHP: '#777BB4', CSS: '#563d7c',
  HTML: '#e34c26', Elixir: '#6e4a7e', Scala: '#c22d40', Haskell: '#5e5086',
};

const SUBREDDIT_COLORS = {
  programming: '#ff6314', MachineLearning: '#5f4bb6', webdev: '#0dd3bb',
  javascript: '#c8a000', Python: '#3572A5', golang: '#00ADD8',
  rust: '#dea584', devops: '#e07b39',
};

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

// ── Shared components ────────────────────────────────────────────────────────

function LangDot({ language }) {
  if (!language) return null;
  const color = LANG_COLORS[language] || '#8b949e';
  return (
    <span className="flex items-center gap-1 text-xs text-gray-400">
      <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {language}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="p-4 border-b border-gray-800/60 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="h-3 bg-gray-800 rounded w-2/3" />
        <div className="h-3 bg-gray-800 rounded w-10" />
      </div>
      <div className="h-2 bg-gray-800/70 rounded w-full mb-1" />
      <div className="h-2 bg-gray-800/70 rounded w-4/5 mb-3" />
      <div className="flex gap-2">
        <div className="h-2 bg-gray-800 rounded w-14" />
        <div className="h-2 bg-gray-800 rounded w-10" />
        <div className="h-2 bg-gray-800 rounded w-10" />
      </div>
    </div>
  );
}

function SkeletonComment() {
  return (
    <div className="border-l-2 border-gray-800 pl-3 py-1 animate-pulse">
      <div className="flex gap-2 mb-2">
        <div className="h-2.5 bg-gray-800 rounded w-20" />
        <div className="h-2.5 bg-gray-800 rounded w-14" />
      </div>
      <div className="space-y-1.5">
        <div className="h-2 bg-gray-800/70 rounded w-full" />
        <div className="h-2 bg-gray-800/70 rounded w-11/12" />
        <div className="h-2 bg-gray-800/70 rounded w-4/5" />
      </div>
    </div>
  );
}

function StatBox({ icon, label, value }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 text-center border border-gray-800/50">
      <p className="text-base font-bold text-white">{icon} {value}</p>
      <p className="text-xs text-gray-600 mt-0.5">{label}</p>
    </div>
  );
}

function RepoMeta({ item }) {
  return (
    <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 pb-5 mb-5 border-b border-gray-800/60">
      <LangDot language={item.language} />
      {item.license?.spdx_id && item.license.spdx_id !== 'NOASSERTION' && (
        <span>📄 {item.license.spdx_id}</span>
      )}
      {item.pushed_at && <span>Last push {timeAgo(item.pushed_at)}</span>}
      {item.created_at && <span>Created {timeAgo(item.created_at)}</span>}
      {item.homepage && (
        <a
          href={item.homepage}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-400 transition-colors truncate max-w-[200px]"
        >
          🌐 {item.homepage.replace(/^https?:\/\//, '')}
        </a>
      )}
    </div>
  );
}

// ── HN × GitHub tab ──────────────────────────────────────────────────────────

function StoryCard({ item, isSelected, onClick }) {
  const { github } = item;
  return (
    <button
      onClick={() => onClick(item)}
      className={`w-full text-left p-4 border-b border-gray-800/60 transition-colors group ${
        isSelected
          ? 'bg-gray-800/80 border-l-2 border-l-orange-500 pl-[14px]'
          : 'hover:bg-gray-800/40 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-gray-200 truncate leading-snug group-hover:text-white transition-colors">
          <span className="text-gray-500">{item.owner}/</span>
          <span className={isSelected ? 'text-white' : 'text-gray-100'}>{item.repo}</span>
        </p>
        <span className="flex-shrink-0 text-xs font-semibold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
          ▲ {item.points}
        </span>
      </div>
      {github?.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">{github.description}</p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <LangDot language={github?.language} />
        {github?.stargazers_count != null && (
          <span className="text-xs text-gray-500">⭐ {formatNum(github.stargazers_count)}</span>
        )}
        {github?.forks_count > 0 && (
          <span className="text-xs text-gray-600">⑂ {formatNum(github.forks_count)}</span>
        )}
        <span className="text-xs text-gray-600">💬 {item.numComments}</span>
        <span className="text-xs text-gray-700 ml-auto">{timeAgo(item.createdAt)}</span>
      </div>
    </button>
  );
}

function HNComment({ comment }) {
  const [expanded, setExpanded] = useState(false);
  if (!comment?.text) return null;
  const isLong = comment.text.length > 600;
  const displayText = isLong && !expanded ? comment.text.slice(0, 600) + '…' : comment.text;
  return (
    <div className="border-l-2 border-gray-800 pl-3 py-1">
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-xs font-semibold text-blue-400">{comment.by}</span>
        <span className="text-xs text-gray-700">
          {timeAgo(new Date(comment.time * 1000).toISOString())}
        </span>
      </div>
      <div
        className="text-xs text-gray-400 leading-relaxed hn-comment"
        dangerouslySetInnerHTML={{ __html: displayText }}
      />
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-xs text-gray-600 hover:text-gray-400 mt-1 transition-colors"
        >
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  );
}

function HNDetailPane({ item, comments, commentsLoading }) {
  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-700">
        <div className="text-center select-none">
          <p className="text-5xl mb-3 opacity-30">⬅</p>
          <p className="text-sm">Select a repo to view details</p>
        </div>
      </div>
    );
  }
  const { github } = item;
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl p-6 mx-auto">
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-lg font-bold text-white leading-snug">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                <span className="text-gray-500 font-normal">{item.owner} / </span>
                {item.repo}
              </a>
            </h1>
            <div className="flex gap-2 flex-shrink-0">
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md border border-gray-700 transition-colors">
                GitHub ↗
              </a>
              <a href={item.hnUrl} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-md border border-orange-600/30 transition-colors">
                HN ▲{item.points}
              </a>
            </div>
          </div>
          {github?.description && (
            <p className="text-sm text-gray-400 leading-relaxed mb-3">{github.description}</p>
          )}
          {github?.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {github.topics.slice(0, 12).map(t => (
                <span key={t} className="text-xs px-2 py-0.5 bg-blue-950/60 text-blue-400 rounded-full border border-blue-900/50">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        {github && (
          <div className="grid grid-cols-4 gap-2 mb-5">
            <StatBox icon="⭐" label="Stars" value={formatNum(github.stargazers_count)} />
            <StatBox icon="⑂" label="Forks" value={formatNum(github.forks_count)} />
            <StatBox icon="🐛" label="Issues" value={formatNum(github.open_issues_count)} />
            <StatBox icon="👁" label="Watching" value={formatNum(github.watchers_count)} />
          </div>
        )}
        {github && <RepoMeta item={github} />}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-2">
              <span className="text-orange-500 normal-case font-bold text-sm">HN</span>
              Top Comments
              <span className="text-gray-700 font-normal normal-case">({item.numComments} total)</span>
            </h2>
            <a href={item.hnUrl} target="_blank" rel="noopener noreferrer"
              className="text-xs text-gray-600 hover:text-orange-400 transition-colors">
              See all on HN →
            </a>
          </div>
          {commentsLoading ? (
            <div className="space-y-4">
              <SkeletonComment /><SkeletonComment /><SkeletonComment />
            </div>
          ) : comments.length === 0 ? (
            <p className="text-xs text-gray-700 py-4 text-center">No comments yet on this post.</p>
          ) : (
            <div className="space-y-5">
              {comments.map(c => <HNComment key={c.id} comment={c} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function HNTab({ refreshKey, onLoading, onFetched }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const hasAutoSelected = useRef(false);
  const commentsCtrl = useRef(null);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    onLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/feed');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      onFetched(data.fetchedAt);
      if (data.items?.length > 0 && !hasAutoSelected.current) {
        setSelected(data.items[0]);
        hasAutoSelected.current = true;
      }
    } catch (e) {
      setError('Failed to load feed. ' + e.message);
    } finally {
      setLoading(false);
      onLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchFeed();
    const timer = setInterval(fetchFeed, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!selected) return;
    if (commentsCtrl.current) commentsCtrl.current.abort();
    const ctrl = new AbortController();
    commentsCtrl.current = ctrl;
    setComments([]);
    setCommentsLoading(true);
    fetch(`/api/comments?id=${selected.hnId}`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(d => setComments(d.comments || []))
      .catch(e => { if (e.name !== 'AbortError') console.error(e); })
      .finally(() => setCommentsLoading(false));
    return () => ctrl.abort();
  }, [selected?.hnId]);

  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="w-[420px] flex-shrink-0 border-r border-gray-800/60 flex flex-col overflow-hidden bg-[#0d1117]">
        {error && (
          <div className="px-4 py-2.5 bg-red-950/40 border-b border-red-900/30 text-red-400 text-xs">{error}</div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0
            ? Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />)
            : items.map(item => (
                <StoryCard key={item.hnId} item={item} isSelected={selected?.hnId === item.hnId} onClick={setSelected} />
              ))}
        </div>
        <div className="border-t border-gray-800/60 px-4 py-2 text-xs text-gray-800 flex-shrink-0 flex justify-between">
          <span>{items.length} repos · last 24h</span>
          <span>auto-refreshes every 2h</span>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col bg-[#0d1117]">
        <HNDetailPane item={selected} comments={comments} commentsLoading={commentsLoading} />
      </main>
    </div>
  );
}

// ── GitHub Trending tab ───────────────────────────────────────────────────────

function GithubTrendingCard({ item, isSelected, onClick }) {
  return (
    <button
      onClick={() => onClick(item)}
      className={`w-full text-left p-4 border-b border-gray-800/60 transition-colors group ${
        isSelected
          ? 'bg-gray-800/80 border-l-2 border-l-blue-500 pl-[14px]'
          : 'hover:bg-gray-800/40 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <p className="text-sm font-medium text-gray-200 truncate leading-snug group-hover:text-white transition-colors">
          <span className="text-gray-500">{item.owner}/</span>
          <span className={isSelected ? 'text-white' : 'text-gray-100'}>{item.repo}</span>
        </p>
        <span className="flex-shrink-0 text-xs font-semibold text-yellow-400 bg-yellow-400/10 px-2 py-0.5 rounded-full">
          ⭐ {formatNum(item.stargazers_count)}
        </span>
      </div>
      {item.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">{item.description}</p>
      )}
      <div className="flex items-center gap-3 flex-wrap">
        <LangDot language={item.language} />
        {item.forks_count > 0 && (
          <span className="text-xs text-gray-600">⑂ {formatNum(item.forks_count)}</span>
        )}
        <span className="text-xs text-gray-700 ml-auto">{timeAgo(item.created_at)}</span>
      </div>
    </button>
  );
}

function GithubTrendingDetail({ item }) {
  if (!item) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-700">
        <div className="text-center select-none">
          <p className="text-5xl mb-3 opacity-30">⬅</p>
          <p className="text-sm">Select a repo to view details</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl p-6 mx-auto">
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-lg font-bold text-white leading-snug">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                <span className="text-gray-500 font-normal">{item.owner} / </span>
                {item.repo}
              </a>
            </h1>
            <div className="flex gap-2 flex-shrink-0">
              <a href={item.url} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md border border-gray-700 transition-colors">
                GitHub ↗
              </a>
              <a
                href={`https://hn.algolia.com/?q=${encodeURIComponent(`${item.owner}/${item.repo}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-orange-600/20 hover:bg-orange-600/30 text-orange-400 rounded-md border border-orange-600/30 transition-colors"
              >
                Search HN ↗
              </a>
            </div>
          </div>
          {item.description && (
            <p className="text-sm text-gray-400 leading-relaxed mb-3">{item.description}</p>
          )}
          {item.topics?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {item.topics.slice(0, 12).map(t => (
                <span key={t} className="text-xs px-2 py-0.5 bg-blue-950/60 text-blue-400 rounded-full border border-blue-900/50">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2 mb-5">
          <StatBox icon="⭐" label="Stars" value={formatNum(item.stargazers_count)} />
          <StatBox icon="⑂" label="Forks" value={formatNum(item.forks_count)} />
          <StatBox icon="🐛" label="Issues" value={formatNum(item.open_issues_count)} />
          <StatBox icon="👁" label="Watching" value={formatNum(item.watchers_count)} />
        </div>
        <RepoMeta item={item} />
      </div>
    </div>
  );
}

function GithubTrendingTab({ refreshKey, onLoading, onFetched }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const hasAutoSelected = useRef(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    onLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/github-trending');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setItems(data.items || []);
      onFetched(data.fetchedAt);
      if (data.items?.length > 0 && !hasAutoSelected.current) {
        setSelected(data.items[0]);
        hasAutoSelected.current = true;
      }
    } catch (e) {
      setError('Failed to load trending repos. ' + e.message);
    } finally {
      setLoading(false);
      onLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchFeed();
    const timer = setInterval(fetchFeed, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="w-[420px] flex-shrink-0 border-r border-gray-800/60 flex flex-col overflow-hidden bg-[#0d1117]">
        {error && (
          <div className="px-4 py-2.5 bg-red-950/40 border-b border-red-900/30 text-red-400 text-xs">{error}</div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading && items.length === 0
            ? Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />)
            : items.map(item => (
                <GithubTrendingCard key={item.id} item={item} isSelected={selected?.id === item.id} onClick={setSelected} />
              ))}
        </div>
        <div className="border-t border-gray-800/60 px-4 py-2 text-xs text-gray-800 flex-shrink-0 flex justify-between">
          <span>{items.length} repos · new this week</span>
          <span>auto-refreshes every 2h</span>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col bg-[#0d1117]">
        <GithubTrendingDetail item={selected} />
      </main>
    </div>
  );
}

// ── Reddit tab ────────────────────────────────────────────────────────────────

function RedditPostCard({ post, isSelected, onClick }) {
  const subColor = SUBREDDIT_COLORS[post.subreddit] || '#8b949e';
  return (
    <button
      onClick={() => onClick(post)}
      className={`w-full text-left p-4 border-b border-gray-800/60 transition-colors group ${
        isSelected
          ? 'bg-gray-800/80 border-l-2 border-l-red-500 pl-[14px]'
          : 'hover:bg-gray-800/40 border-l-2 border-l-transparent'
      }`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="flex-shrink-0 text-xs px-1.5 py-0.5 rounded font-medium"
          style={{ backgroundColor: `${subColor}20`, color: subColor, border: `1px solid ${subColor}40` }}
        >
          r/{post.subreddit}
        </span>
      </div>
      <p className="text-sm font-medium text-gray-200 leading-snug group-hover:text-white transition-colors mb-2 line-clamp-2">
        {post.title}
      </p>
      <div className="flex items-center gap-3 flex-wrap">
        {!post.isSelf && (
          <span className="text-xs text-gray-600 truncate max-w-[200px]">{post.domain}</span>
        )}
        {post.isSelf && <span className="text-xs text-gray-700">self post</span>}
        <span className="text-xs text-gray-700 ml-auto">{timeAgo(post.createdAt)}</span>
      </div>
    </button>
  );
}

function RedditDetail({ post }) {
  if (!post) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-700">
        <div className="text-center select-none">
          <p className="text-5xl mb-3 opacity-30">⬅</p>
          <p className="text-sm">Select a post to view details</p>
        </div>
      </div>
    );
  }
  const subColor = SUBREDDIT_COLORS[post.subreddit] || '#8b949e';
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-4xl p-6 mx-auto">
        <div className="mb-5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2 flex-wrap">
                <span
                  className="text-xs px-2 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${subColor}20`, color: subColor, border: `1px solid ${subColor}40` }}
                >
                  r/{post.subreddit}
                </span>
              </div>
              <h1 className="text-lg font-bold text-white leading-snug">
                <a href={post.permalink} target="_blank" rel="noopener noreferrer" className="hover:text-blue-400 transition-colors">
                  {post.title}
                </a>
              </h1>
              <p className="text-xs text-gray-600 mt-1.5">by u/{post.author} · {timeAgo(post.createdAt)}</p>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              {!post.isSelf && (
                <a href={post.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-md border border-gray-700 transition-colors">
                  {post.domain} ↗
                </a>
              )}
              <a href={post.permalink} target="_blank" rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-md border border-red-600/30 transition-colors">
                Reddit ↗
              </a>
            </div>
          </div>
        </div>

        {!post.isSelf && (
          <div className="mb-5 pb-5 border-b border-gray-800/60">
            <a href={post.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-blue-400 hover:text-blue-300 break-all transition-colors">
              {post.url}
            </a>
          </div>
        )}

        <a
          href={post.permalink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-4 bg-red-600/10 hover:bg-red-600/20 border border-red-600/20 rounded-lg text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
        >
          View full discussion on Reddit →
        </a>
      </div>
    </div>
  );
}

function RedditTab({ refreshKey, onLoading, onFetched }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const hasAutoSelected = useRef(false);

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    onLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/reddit');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setPosts(data.posts || []);
      onFetched(data.fetchedAt);
      if (data.posts?.length > 0 && !hasAutoSelected.current) {
        setSelected(data.posts[0]);
        hasAutoSelected.current = true;
      }
    } catch (e) {
      setError('Failed to load Reddit feed. ' + e.message);
    } finally {
      setLoading(false);
      onLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchFeed();
    const timer = setInterval(fetchFeed, REDDIT_REFRESH_MS);
    return () => clearInterval(timer);
  }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 flex overflow-hidden">
      <aside className="w-[420px] flex-shrink-0 border-r border-gray-800/60 flex flex-col overflow-hidden bg-[#0d1117]">
        {error && (
          <div className="px-4 py-2.5 bg-red-950/40 border-b border-red-900/30 text-red-400 text-xs">{error}</div>
        )}
        <div className="flex-1 overflow-y-auto">
          {loading && posts.length === 0
            ? Array(12).fill(0).map((_, i) => <SkeletonCard key={i} />)
            : posts.map(post => (
                <RedditPostCard key={post.id} post={post} isSelected={selected?.id === post.id} onClick={setSelected} />
              ))}
        </div>
        <div className="border-t border-gray-800/60 px-4 py-2 text-xs text-gray-800 flex-shrink-0 flex justify-between">
          <span>{posts.length} posts · top today · 8 subreddits</span>
          <span>auto-refreshes every 1h</span>
        </div>
      </aside>
      <main className="flex-1 overflow-hidden flex flex-col bg-[#0d1117]">
        <RedditDetail post={selected} />
      </main>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

const TABS = [
  { id: 'hn', label: 'HN × GitHub', accent: 'orange' },
  { id: 'trending', label: 'GH Trending', accent: 'blue' },
  { id: 'reddit', label: 'Reddit', accent: 'red' },
];

const TAB_ACTIVE_CLASS = {
  orange: 'text-orange-400 border-b-orange-500 bg-orange-500/5',
  blue: 'text-blue-400 border-b-blue-500 bg-blue-500/5',
  red: 'text-red-400 border-b-red-500 bg-red-500/5',
};

export default function Home() {
  const [tab, setTab] = useState('hn');
  const [loading, setLoading] = useState(false);
  const [fetchedAt, setFetchedAt] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const activeTab = TABS.find(t => t.id === tab);

  return (
    <>
      <Head>
        <title>Dev Hub — HN · GitHub Trending · Reddit</title>
        <meta name="description" content="All your tech feeds in one place" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="icon"
          href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🔥</text></svg>"
        />
      </Head>

      <div className="h-screen flex flex-col bg-[#0d1117] text-gray-100 overflow-hidden font-sans">
        <header className="border-b border-gray-800/80 px-5 py-0 flex items-stretch justify-between flex-shrink-0 bg-[#0d1117]/95 backdrop-blur-sm">
          <div className="flex items-stretch">
            <div className="flex items-center pr-5 border-r border-gray-800/60">
              <h1 className="font-bold text-base tracking-tight text-white py-3">Dev Hub</h1>
            </div>
            <nav className="flex items-stretch ml-1">
              {TABS.map(t => (
                <button
                  key={t.id}
                  onClick={() => { setTab(t.id); setFetchedAt(null); }}
                  className={`px-4 text-sm font-medium transition-colors border-b-2 ${
                    tab === t.id
                      ? TAB_ACTIVE_CLASS[t.accent]
                      : 'text-gray-500 border-b-transparent hover:text-gray-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 py-3">
            {fetchedAt && !loading && (
              <span className="text-xs text-gray-700 hidden sm:block">
                Updated {timeAgo(fetchedAt)}
              </span>
            )}
            {tab === 'hn' && (
              <Link
                href="/search"
                className="text-xs px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md border border-gray-700/50 transition-colors"
              >
                🔍 Search HN
              </Link>
            )}
            <button
              onClick={() => setRefreshKey(k => k + 1)}
              disabled={loading}
              className="text-xs px-3 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-400 hover:text-white rounded-md border border-gray-700/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="inline-block w-3 h-3 border border-gray-500 border-t-gray-300 rounded-full animate-spin" />
                  Loading
                </span>
              ) : '↻ Refresh'}
            </button>
          </div>
        </header>

        {tab === 'hn' && (
          <HNTab refreshKey={refreshKey} onLoading={setLoading} onFetched={setFetchedAt} />
        )}
        {tab === 'trending' && (
          <GithubTrendingTab refreshKey={refreshKey} onLoading={setLoading} onFetched={setFetchedAt} />
        )}
        {tab === 'reddit' && (
          <RedditTab refreshKey={refreshKey} onLoading={setLoading} onFetched={setFetchedAt} />
        )}
      </div>
    </>
  );
}
