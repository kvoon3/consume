# Local patches for vendor/dither-ui

Applied by `scripts/update-dither-ui.sh` (`pnpm up:dither`) after re-syncing
from upstream. Add new patches as `NNNN-name.patch` (diff against upstream
`dither-kit/`, paths `a/<file>` → `b/<file>`).

- `0001-straight-alpha-raster.patch` — raster fast paths (`setPixelInline`,
  `setOrBlendRasterPixel` transparent branch) stored premultiplied RGB, but
  `putImageData` and the blend path treat the buffer as straight alpha; every
  translucent dither pixel was double-darkened (grey speckle on light
  backgrounds). Store straight RGBA instead. **Should be upstreamed.**
- `0002-package-private.patch` — mark the vendored package `private` so it is
  never accidentally published.
