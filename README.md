# Dev Hub

A tabbed dashboard for keeping up with the tech world — three feeds, one place. Left column lists items, click any to see full details + comments on the right.

## Tabs

| Tab | What it shows | Source | Refresh |
|-----|--------------|--------|---------|
| **HN × GitHub** | GitHub repos linked on HN, ranked by upvotes | HN Algolia + GitHub API | 2h |
| **GH Trending** | New repos (created this week) sorted by stars | GitHub Search API | 2h |
| **Reddit** | Top posts today from 8 tech subreddits | Reddit JSON API | 1h |

Reddit subreddits: r/programming, r/MachineLearning, r/webdev, r/javascript, r/Python, r/golang, r/rust, r/devops

## Setup

```bash
cd hn-github-reader
npm install
```

Optional — add a GitHub token for higher API rate limits (60 req/hr → 5000/hr):

```bash
cp .env.example .env.local
# Edit .env.local and set GITHUB_TOKEN=ghp_...
```

Create a token at https://github.com/settings/tokens — no scopes needed (public repo access is sufficient).

## Run locally

```bash
npm run dev
# Open http://localhost:3000
```

## Deploy to Vercel

```bash
npm i -g vercel
vercel
```

In Vercel dashboard → Project → Settings → Environment Variables, add:
- `GITHUB_TOKEN` = your token (optional but recommended)

## File structure

```
pages/
  index.js                  # Tabbed hub UI (HN×GitHub, GH Trending, Reddit)
  search.js                 # HN topic search page
  api/
    feed.js                 # HN Algolia + GitHub API, cached 2h
    comments.js             # HN top comments, cached 1h
    github-trending.js      # GitHub Search API (new repos this week), cached 2h
    reddit.js               # Reddit top-today posts, 8 subreddits merged, cached 1h
    reddit-comments.js      # Reddit top comments per post, cached 1h
styles/
  globals.css               # Tailwind base + comment HTML overrides
```

## API cost

- **HN Algolia API**: free, no auth
- **GitHub API**: free, 60 req/hr unauthenticated / 5000/hr with token. Calls are cached on Vercel's edge, so actual usage is very low.
- **Reddit JSON API**: free, no auth. Standard rate limits apply; caching keeps usage minimal.
