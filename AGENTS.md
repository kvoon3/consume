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

## Pick (Jev, `server/routes/api/pick.ts`)

The ask input submits `{ prompt, items }` to `POST /api/pick`; the server asks Jev (TypeSafe System
One) and returns probabilities; the client turns them into the row of discs. Two shapes have to
stay in sync, and both are measured rather than guessed:

- **The request** lives in `server/utils/jev.ts`, shared with `scripts/pick-probe.ts` (the measuring
tool — `pnpm exec tsx scripts/pick-probe.ts`, or `PROMPTS='a|b'` for selected ones). Reword the
question or the `state` fields there and re-run the probe, or the measurement is measuring a
request nobody sends. The criterion that makes the status condition work ("every condition the
request states about watched-status or progress is satisfied") is what keeps "还没看过的" out of the
在看 and 看过 shelves.
- **The thresholds** live in `FloorStage.vue` (`FLOOR`, `RATIO`, `LIMIT`) and came out of the same
probe: an absolute cutoff alone reports "nothing matches" for vague asks whose best answer only
reaches ~0.4, so a pick must also stand up against the best one. A genuine no-match measures
0.02–0.04, which is what the floor is for.

Two calls, not one: all 79 items with their summaries is 28k tokens, most of Jev's 32k state budget,
and measures *worse* than a cheap pass over title/tags/status followed by a second pass over the top
20 with summaries (max 0.90 against 0.73 on the same prompt, and a tenth of the tokens). The pick
costs a few tenths of a cent; `TYPESAFE_API_KEY` is required and stays server-side.

The collection routes carry what Jev reads and nothing else: `category` (the shelf — an item without
one is dropped by `jevItem`), `rating` (the site's average, *not* the viewer's `score`) and
`summary`. Everything else the pick sends is already on `MediaItem`.

The old pick UI is still in a local `git stash` (`git stash list` → "pick pipeline (jev) + lift/row
animation") — machine-local, so do not build on it: `src/components/PickSection.vue` had the ask box
with result links, a `?ask=` URL round-trip, a retry, and the `qualified` side-channel the floor used
to draw near-misses. None of that was brought back; the row and the disc-click replaced it. Picking
from a list row is still missing.

## Local dev

- Node resolves `api.bgm.tv` to IPv6 first, and on this machine that route resets the connection
  (`ECONNRESET`) while IPv4 works. The symptom is misleading: whichever subject's response is not in
  the 24h cache fails with a 500, so it looks like "books and music are broken" while anime is fine.
  The `dev` script now sets `--dns-result-order=ipv4first`, so plain `pnpm dev` works.
- That setting has to be at process start. Putting `setDefaultResultOrder()` in `vite.config.ts` does
  nothing (nitro runs route handlers in another context, which keeps the default order), and putting
  it in the route itself is wrong because that code ships to the Worker, where networking is not
  Node's.
- Bangumi failures surface as `502 Bangumi request failed` (the cause is logged server-side) instead
  of a bare 500, and the client shows the server's message.

## Vendored dither-ui

`vendor/dither-ui` is a copy of https://github.com/drvova/dither-ui `dither-kit/`, installed as a `file:` dependency. Local modifications live as patch files in `patches/dither-ui/` (see its README). Never edit `vendor/dither-ui/` directly without regenerating a patch; refresh from upstream with `pnpm up:dither [ref]`, which re-applies all patches.

### Usage rules

- Always import from the `dither-ui` barrel (`import { BarChart } from 'dither-ui'`), never deep paths.
- The vendor is **pruned to what we use** (`scripts/prune-dither-ui.mjs`, runs inside `pnpm up:dither`): cartesian/pie charts (`BarChart`, `AreaChart`/`LineChart`, `PieChart` + `Grid`/`XAxis`/`YAxis`/`Legend`/`Tooltip`/series parts), `DitherAvatar`, `DitherButton`, `DitherGradient`, and their shared engine. The kit's other ~240 components (effects pack, form widgets, radar) are deleted; the barrel `index.ts` is regenerated by the prune script. To use a deleted component, add it to `ENTRIES` and the barrel in `scripts/prune-dither-ui.mjs` and re-run it.
- Charts are vertical-only by engine design; for horizontal bar lists use the app's own `src/components/DitherBarList.vue` (built on `DitherGradient`), not a kit fork.
- Theme: kit components consume the shadcn token CSS vars defined in `src/styles.css` (`--background`, `--foreground`, `--border`, …); never hardcode colors on kit components.
- Kit charts mount inside a sized container (`h-48` etc.) and render through canvas — verify visually via agent-browser after changes.
