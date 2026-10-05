# ADR 0001: CDN caching for all API routes

- **Status:** Accepted
- **Date:** 2026-10-05

## Context

On 2026-09-26 we shipped fixes to cut Vercel usage (commits `9416a88`, `b3cda32`):
60s CDN cache + ETag/304 on `/api/stream`, 200 items max, client polling every
60s (120s in a background tab). A week later the monthly usage summary for
`radar-news` looked unchanged (~64 min Active CPU, ~49K invocations, ~3 GB Fast
Origin Transfer), so we audited production to see whether the fixes work.

## Findings (production, 2026-10-05)

Each route was requested twice in a row with `curl -sI`, and `/api/stream` was
sampled every 15s for 3.5 minutes.

1. **`/api/stream` caching works.** Pattern over time: `MISS → HIT → HIT → HIT →
   STALE → HIT ...` with `Age` climbing to ~60 and resetting. The function runs at
   most about once a minute per CDN region. A conditional request returns `304`
   with 0 bytes. A cached response is 21 KB gzipped (was 44 KB).
2. **The client polls only `/api/stream`** (plus `/api/weather` once an hour).
   One timer chain (`setTimeout`, cleared before each reschedule), no query
   string / cache-buster, 60s visible / 120s hidden. Background tabs slow down
   rather than stop, on purpose: push notifications need them.
3. **Four routes had no CDN cache at all** — every request ran a function:
   - `/api/feeds`: `no-store`, fetched the 10 RSS sources **sequentially**
     (2.7s per call, 115 KB). Not called by our client, but public.
   - `/api/weather`, `/api/hebrew-date`, `/api/sources`: default
     `max-age=0`, `MISS` on every request.
4. **Origin ETag check never matched.** Vercel turns our `"abc"` ETag into the
   weak form `W/"abc"` when it compresses, so `If-None-Match` reaching the
   function was compared against the strong form and always returned a full 200.
   (The CDN itself answered 304 from cache, so the effect was small.)
5. No `set-cookie`, no `vercel.json` header overrides, no dynamic-rendering
   flags (this is not a Next.js project).

### Why the monthly total did not drop

Not verified against the dashboard (no API access to the team's usage data
from this session). The most likely explanation, consistent with every
measurement above: the summary is a cumulative 30-day figure that still contains
the pre-fix spike of Sep 19–26 (~400 MB/day and ~10K invocations/day at the
time). It cannot fall until those days leave the window. The per-day bars after
Sep 27 are the number to look at.

## Decision

- Keep the `/api/stream` design as is (60s `CDN-Cache-Control` + ETag).
- Put every other API route behind the CDN cache too:
  `/api/feeds` 60s, `/api/weather` 30 min (successful responses only),
  `/api/hebrew-date` 1 h, `/api/sources` 24 h.
- Fetch feeds in parallel in `/api/feeds`, same as `/api/stream`.
- Accept weak ETags in the `/api/stream` origin check.
- Not changed: the 8s per-feed timeout (already present), client polling.

## Consequences

- No route can be made to run a function per request by repeated calls to the
  same URL. Distinct query strings still create distinct cache entries.
- Weather can be up to 30 minutes old, the Hebrew date up to an hour.
- Source list changes take up to 24h to show on `/api/sources` (client does not
  use it; sources arrive inside `/api/stream`).

## Routes

| Route | Cache before | Cache after | What changed |
|---|---|---|---|
| `/api/stream` | CDN 60s, HIT on 2nd request | same | Origin now accepts weak `W/` ETag for 304 |
| `/api/feeds` | `no-store`, always MISS | CDN 60s + SWR 60s | Cache header; sequential fetch → `Promise.all` |
| `/api/weather` | none, always MISS | CDN 30 min + SWR 1 h | Cache header on successful responses |
| `/api/hebrew-date` | none, always MISS | CDN 1 h | Cache header on successful responses |
| `/api/sources` | none, always MISS | CDN 24 h | Cache header |
| `/`, `/app.js`, `/style.css`, `/logo.png` | static, HIT | same | Nothing |
