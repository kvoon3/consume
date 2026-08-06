# Agent notes

## Bangumi API

Official documentation: https://bangumi.github.io/api/
OpenAPI schema: https://bangumi.github.io/api/dist.json

The server integration lives in `server/routes/api/collections.get.ts` and calls:

```http
GET https://api.bgm.tv/v0/users/1140496/collections?limit={limit}&offset={offset}
```

Always send the repository's existing `User-Agent`. Add `Authorization: Bearer ${BANGUMI_TOKEN}` only when the environment variable exists. Never expose the token to client code.

Subject types are `1` book, `2` anime, `3` music, `4` game, and `6` live action. There is no subject type `5`.

Collection types are `1` wish, `2` done, `3` doing, `4` on hold, and `5` dropped.

Use `vol_status` and `subject.volumes` for book progress. Use `ep_status` and `subject.eps` for other subjects. The endpoint is paginated, so continue until the accumulated data reaches `total` or a page is empty.

The local `/api/collections` response is cached for 300 seconds with stale-while-revalidate. Keep Bangumi-specific response mapping on the server and the normalized client types in `src/composables/useBangumi.ts`.

## Checks

Run before finishing:

```bash
pnpm lint
pnpm build
```
