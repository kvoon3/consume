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

## The disc floor (`src/components/DiscStage.vue`)

A pile of discs: `items` scattered on a real plane seen in perspective, hover to light a disc up
and label it, press and hold to move one, click to lift it out of the pile into a centered row.
matter-js 2D does the physics, laid on a plane tilted `rotateX(55deg)` about its near edge and sized
so its far edge projects onto the horizon line — so the physics plane's `(x, y)` is the scene's
`(x, z)`, and a later WebGL renderer could reuse the physics, hover, and drag logic unchanged.

- Nothing on the floor follows the cursor: hover only highlights and labels. A disc moves when it is
  grabbed (pointerdown) and stays where it is dropped; a click is anything under 5px of movement.
- A clicked disc leaves the pile for the row: its body leaves the physics world (so the hole it left
  stays a hole), it stands up (`rotateX(-55deg)`, which cancels the floor's tilt), it is lifted
  `LIFT` toward the camera and raised `ROW_Y` up the stage. That lift scales the disc about the
  perspective origin, so the row is laid out in *unlifted* screen space, at the one depth that
  projects onto the stage's centre line; the raise is one `translateY` in the disc's own frame,
  which the stand-up has already squared to the screen, so a pixel there is a pixel of rise. The
  row has to clear the horizon (`HORIZON`), or the discs on the far floor read as one row with it.
  Both states use one transform with the same function list, and only `.is-flying` transitions it —
  that is what animates the disc standing up mid-flight, and a `transitionend` on the stage puts the
  body back once a disc has landed on the floor again. Picking or dropping one disc shifts every
  other slot, so a change gives *every* disc in the row `is-flying`: the row slides open and closed
  instead of the discs round the changed one snapping into place.
- Screen point -> floor point is solved in closed form, and the projection is the same one the
  horizon uses. Two checks have caught every mistake here, so keep both when touching it: (a)
  predict each disc's screen centre from its transform and compare with `getBoundingClientRect`
  (agrees within ~3px over all 79), and (b) actually hover and drag with the pointer — a drifted
  mapping fails loudly there. For the row, check a picked disc's box is square (upright), centred on
  the stage's centre line, evenly spaced in pick order, and clear of the pile's own top edge —
  `elementFromPoint` across each picked disc's box catches a floor disc painted over it.
- The hub is a real punch-through: the mask lives on `.disc-face`, not on `.disc`, because a mask
  clips to the border box and would erase the disc's shadow and ring as well.
- Plain `.dark …` selectors only — this build drops `:global(...)` outright, which also silently
  killed `CollectionTable`'s dark highlight rules.

## Pick (removed, recoverable)

The Jev pick pipeline (the ask input, `POST /api/pick`, the shared Jev request shape in
`server/utils/jev.ts`, the `scripts/pick-probe.ts` measuring tool) and the lift-into-a-row animation
were removed from the tree. A copy is kept in a local `git stash` (`git stash list` → "pick pipeline
(jev) + lift/row animation") — machine-local, so do not build on it — together with the
`summary`/`rating` additions to the Bangumi mapping and the pick-related locale strings.

The manual pick replaced it: a clicked disc now stands up into the row (see above) with no Jev in
the loop. Picking from a list row is still missing, and the row is display-only — nothing consumes
the picks yet. Note the old animation was the part being reworked; the floor and the scatter were
the parts worth keeping.

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
