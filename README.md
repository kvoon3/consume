# consume

My books, anime, music, games, and live action, powered by [Bangumi](https://bgm.tv).

```bash
pnpm install
pnpm dev
```

## Setup

Copy the keys into `.env`:

- `BANGUMI_TOKEN` — required for private collections.
- `NEODB_TOKEN` — create an app at https://neodb.social/developer/ (set `NEODB_INSTANCE` for another instance).
- Spotify: create an app at https://developer.spotify.com/dashboard, add `http://127.0.0.1:3210/callback` as a Redirect URI, set `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`, then run `pnpm tsx scripts/spotify-auth.ts` to get `SPOTIFY_REFRESH_TOKEN`.

[Bangumi API](https://bangumi.github.io/api/) · [OpenAPI](https://bangumi.github.io/api/dist.json)

MIT License
