# HN × GitHub Reader

A single-page dashboard that surfaces trending GitHub repos from Hacker News. No tab-switching — left column shows repos ranked by HN upvotes, click any to see full repo stats + top HN comments on the right.

Auto-refreshes every 2 hours.

## What it shows

- GitHub repos linked on HN in the last 48h, ranked by upvote score
- Per repo: stars, forks, open issues, language, license, last push date, topics
- Per HN post: upvote count, comment count, top 5 comments rendered inline
- Links out to both GitHub and the HN discussion

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
  index.js          # Main 2-column UI
  api/
    feed.js         # Fetches HN Algolia + GitHub API, cached 2h
    comments.js     # Fetches top HN comments for a story, cached 1h
styles/
  globals.css       # Tailwind base + HN comment HTML overrides
```

## API cost

- **HN Algolia API**: free, no auth
- **GitHub API**: free, 60 req/hr unauthenticated / 5000/hr with token. Each page load fetches up to 20 repos. With 2h caching on Vercel's edge, actual API calls are rare.
