# Meckman Resume Builder

Free resume builder for teens applying for their first job. All data stays in the
user's browser (localStorage). The only thing that touches the network is the
"Help me word this" button, which sends one bullet of text to Cloudflare Workers
AI for a one-time rewrite — nothing is logged or stored.

## Stack

- Single Cloudflare Worker that serves the static frontend and a `/api/polish`
  endpoint.
- Workers AI binding (Llama 3.1 8B Instruct) for the polish feature.
- Built-in Cloudflare Rate Limiting (30 polish requests / minute / IP).
- No database, no auth, no user accounts.

## Local dev

```bash
npm install
npm run dev
```

Open the URL Wrangler prints.

## Deploy

```bash
npm run deploy
```

Then attach `resume.meckman.org` in the Cloudflare dashboard (Workers & Pages →
this worker → Custom domains).

## Layout

```
public/        Static frontend served as-is
  index.html   Gate + editor + live preview
  styles.css   Editor (dark Meckman) + print stylesheet (B&W resume)
  app.js       State, sections, AI calls, export/import, print
src/
  worker.js    Asset routing + /api/polish
wrangler.toml  Bindings (ASSETS, AI, POLISH_RATE_LIMITER)
```
