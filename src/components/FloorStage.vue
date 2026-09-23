<script setup lang="ts" vapor>
import { defineSound } from '@web-kits/audio'
import Matter from 'matter-js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type { MediaItem, SubjectType } from '../composables/useBangumi'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  items: MediaItem[]
  subject: SubjectType
}>()

const { t } = useLocale()

// Measured on the real list — see scripts/pick-probe.ts. An absolute cutoff alone would report
// "nothing matches" for vague asks whose best answer only reaches ~0.4, so a pick must also stand
// up against the top one; the floor is what keeps a real no-match empty.
const FLOOR = 0.15
const RATIO = 0.6
const LIMIT = 5

interface Picks {
  considered: number
  max: number
  shortlist: { id: number | string, probability: number }[]
}

// The ask, and what became of the last one.
const ask = ref('')
const askState = ref<'empty' | 'error' | 'idle' | 'thinking'>('idle')
const askStatus = computed(() => {
  if (askState.value === 'thinking')
    return t.value.pickThinking
  if (askState.value === 'empty')
    return t.value.pickEmpty
  return askState.value === 'error' ? t.value.pickError : ''
})

// One ask is worth remembering: the same words over the same list must not cost twice.
const memo = new Map<string, Picks>()
let controller: AbortController | undefined

const hoverSound = defineSound({
  source: { type: 'triangle', frequency: { start: 880, end: 640 } },
  envelope: { decay: 0.03 },
  gain: 0.05,
})

const pickSound = defineSound({
  source: { type: 'sine', frequency: { start: 520, end: 940 } },
  envelope: { decay: 0.11 },
  gain: 0.06,
})

// What each kind of thing looks like on the floor: a disc for the media that is one, a book, a game
// cartridge, or a square card. `ratio` is height over width, and `thickness` is how deep the box is
// as a share of its width — a disc has no box at all, so it stays the flat plate it always was.
interface Shape {
  kind: 'book' | 'card' | 'disc' | 'vinyl'
  ratio: number
  thickness: number
}

const SHAPES: Record<SubjectType, Shape> = {
  1: { kind: 'book', ratio: 1.42, thickness: 0.21 },
  2: { kind: 'disc', ratio: 1, thickness: 0 },
  3: { kind: 'vinyl', ratio: 1, thickness: 0 },
  4: { kind: 'disc', ratio: 1, thickness: 0 },
  6: { kind: 'disc', ratio: 1, thickness: 0 },
  podcast: { kind: 'card', ratio: 1, thickness: 0.04 },
}

// How much of its cell a piece fills: 0.84 is the share of the cell the disc's diameter has always
// taken, so discs keep their exact size and everything else is cut to fit the same grid.
const CELL_FILL = 0.84

interface Piece {
  body: Matter.Body
  el: HTMLElement
  h: number
  home: { x: number, y: number }
  id: string
  item: MediaItem
  shape: Shape
  t: number
  w: number
}

// A floor of pieces, seen in perspective. matter-js keeps working in the plane's own
// coordinates — its (x, y) is the scene's (x, z) — so the physics stays 2D on a surface that
// is drawn tilted, and nothing here has to know about the projection except the pointer.
const stage = ref<HTMLElement>()
const hud = ref<HTMLElement>()

// Air above the floor, as a share of the stage: the floor's far edge is projected onto this
// line. Camera distance and how steeply the floor tilts away.
const HORIZON = 0.42
const PERSPECTIVE = 1000
const TILT_DEG = 55
// How far a picked piece floats toward the camera, in the same pixels as the plane's own
// coordinates: off its surface, and in front of anything else at the row's depth.
const LIFT = 56
// And how high the row hangs, as a share of the stage: clear of the floor, whose far edge and
// the pieces on it stop at the horizon line.
const ROW_Y = 0.28

const hovered = shallowRef<MediaItem>()
const hoverId = ref<string>()
// Nothing on the floor moves until it is grabbed: hovering only lights a piece up and labels it.
const heldId = ref<string>()
// Picked pieces leave the pile and stand in a row through the middle of the stage, in pick order.
const picked = ref<string[]>([])
// Mid-flight pieces hold a transform transition; the row and the floor both leave them alone
// until they land.
const flying = ref(new Set<string>())

const canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } })
engine.enableSleeping = true

let pieces: Piece[] = []
let walls: Matter.Body[] = []
let frame = 0
let width = 0
let height = 0
let planeHeight = 0
let tilt = 0
let awake = false
let onScreen = true

let dragConstraint: Matter.Constraint | undefined
let dragged = false
let pointerStart = { x: 0, y: 0 }
let hudId: string | undefined
let hudWidth = 0

// FNV-1a over the id — the only randomness in the pile, so the scatter never reshuffles.
function seed(value: string, salt: number) {
  let hash = 2166136261
  for (const char of `${salt}:${value}`)
    hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return ((hash >>> 0) % 100000) / 100000
}

function title(item: MediaItem) {
  return item.titleCn || item.title
}

// The footprint a shape covers on the floor once turned by `angle`: the bounding box of a rotated
// rectangle, in units of the piece's width. A disc is a square that a rotation cannot grow.
function footprint(shape: Shape, angle: number) {
  if (shape.kind === 'disc')
    return { x: 1, y: 1 }
  const cos = Math.abs(Math.cos(angle))
  const sin = Math.abs(Math.sin(angle))
  return { x: cos + shape.ratio * sin, y: shape.ratio * cos + sin }
}

// Screen point (stage-relative) -> a point on the floor. Solving the perspective projection of
// the tilted plane is a closed form, which keeps hover and drag exact instead of hand-waved.
function planeFromScreen(sx: number, sy: number) {
  const dy = sy - height / 2
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  // Depth from the plane's near edge to the point below the screen point.
  const depth = PERSPECTIVE * (height / 2 - dy) / (PERSPECTIVE * cos + dy * sin)
  const scale = PERSPECTIVE / (PERSPECTIVE + depth * sin)
  return { x: width / 2 + (sx - width / 2) / scale, y: planeHeight - depth }
}

function toPlane(clientX: number, clientY: number) {
  const rect = stage.value!.getBoundingClientRect()
  const { x, y } = planeFromScreen(clientX - rect.left, clientY - rect.top)
  return { x, y: Math.max(0, Math.min(planeHeight, y)) }
}

function relayout() {
  const el = stage.value
  if (!el)
    return
  width = el.clientWidth
  height = el.clientHeight
  if (!width || !height)
    return

  tilt = TILT_DEG * Math.PI / 180
  // Plane size that projects its far edge onto the horizon line (see the stage CSS for how the
  // world element is anchored and rotated).
  const horizon = height * HORIZON
  const t = horizon - height / 2
  planeHeight = Math.round(PERSPECTIVE * (height / 2 - t) / (PERSPECTIVE * Math.cos(tilt) + t * Math.sin(tilt)))
  el.style.setProperty('--world-height', `${planeHeight}px`)
  el.style.setProperty('--tilt', `${TILT_DEG}deg`)

  const count = props.items.length || 1
  const columns = Math.max(1, Math.round(Math.sqrt(count * (width / planeHeight))))
  const rows = Math.ceil(count / columns)
  const cell = { x: width / columns, y: planeHeight / rows }

  // Size every piece before placing any: a turned book or case covers more than its own width, and
  // the margin all of them are kept away from the edge with has to clear the widest of them.
  let margin = 0
  const sizes = pieces.map((piece) => {
    const box = footprint(piece.shape, piece.body.angle)
    const w = Math.max(20, CELL_FILL * Math.min(cell.x / box.x, cell.y / box.y))
    margin = Math.max(margin, box.y * w / 2 + 6)
    return { h: w * piece.shape.ratio, t: w * piece.shape.thickness, w }
  })

  const inner = { x: width - margin * 2, y: planeHeight - margin * 2 }
  const resized: Piece[] = []

  pieces.forEach((piece, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    const size = sizes[index]
    piece.home = {
      x: margin + ((column + 0.5 + (seed(piece.id, 1) - 0.5) * 0.62) / columns) * inner.x,
      y: margin + ((row + 0.5 + (seed(piece.id, 2) - 0.5) * 0.62) / rows) * inner.y,
    }
    if (Math.abs(piece.w - size.w) > 0.5)
      resized.push(piece)
    else
      Matter.Body.setPosition(piece.body, piece.home)
    Matter.Body.setVelocity(piece.body, { x: 0, y: 0 })
    piece.h = size.h
    piece.t = size.t
    piece.w = size.w
    piece.el.style.setProperty('--piece-h', `${piece.h.toFixed(2)}px`)
    piece.el.style.setProperty('--piece-t', `${piece.t.toFixed(2)}px`)
    piece.el.style.setProperty('--piece-w', `${piece.w.toFixed(2)}px`)
  })

  for (const piece of resized)
    replaceBody(piece, piece.home.x, piece.home.y)

  // Let go of anything being dragged before its body is swapped out from under the constraint.
  if (resized.length && dragConstraint) {
    Matter.Composite.remove(engine.world, dragConstraint)
    dragConstraint = undefined
    heldId.value = undefined
  }

  for (const wall of walls)
    Matter.Composite.remove(engine.world, wall)
  walls = [
    Matter.Bodies.rectangle(width / 2, -40, width * 2, 80, { isStatic: true }),
    Matter.Bodies.rectangle(width / 2, planeHeight + 40, width * 2, 80, { isStatic: true }),
    Matter.Bodies.rectangle(-40, planeHeight / 2, 80, planeHeight * 2, { isStatic: true }),
    Matter.Bodies.rectangle(width + 40, planeHeight / 2, 80, planeHeight * 2, { isStatic: true }),
  ]
  Matter.Composite.add(engine.world, walls)

  sync()
}

// A piece's body is the box it is drawn as, so an angled book bumps like a book. Bodies are born
// asleep: the pile stands still until something wakes it.
function pieceBody(angle: number, w: number, h: number, x: number, y: number) {
  const body = Matter.Bodies.rectangle(x, y, w, h, {
    angle,
    friction: 0.25,
    frictionAir: 0.14,
    restitution: 0.12,
    sleepThreshold: 45,
  })
  Matter.Sleeping.set(body, true)
  return body
}

// A body's vertices are the size it was built at, so a piece that changed size gets a new body.
// (`Body.set(body, 'circleRadius')` was the old way to resize one, and it is a no-op.) A picked
// piece has no body in the world at all — the row is off the floor — and stays that way.
function replaceBody(piece: Piece, x: number, y: number) {
  const onFloor = !picked.value.includes(piece.id)
  Matter.Composite.remove(engine.world, piece.body)
  piece.body = pieceBody(piece.body.angle, piece.w, piece.h, x, y)
  if (onFloor)
    Matter.Composite.add(engine.world, piece.body)
}

function build() {
  clearWorld()
  const el = stage.value
  if (!el)
    return
  width = el.clientWidth
  height = el.clientHeight

  const nodes = el.querySelectorAll<HTMLElement>('[data-piece]')
  props.items.forEach((item, index) => {
    const node = nodes[index]
    if (!node)
      return
    const id = String(item.id)
    const shape = SHAPES[item.subjectType]
    if (shape.kind !== 'disc')
      node.style.setProperty('--piece-cover', `url("${item.cover}")`)
    // The pile's only randomness: a small in-plane angle, baked into the body so the physics turns
    // with the piece. A placeholder body — relayout sizes and rebuilds every one before it is seen.
    const body = pieceBody((seed(id, 3) - 0.5) * 14 * Math.PI / 180, 1, 1, width / 2, planeHeight / 2)
    Matter.Composite.add(engine.world, body)
    pieces.push({ body, el: node, h: 0, home: { x: width / 2, y: planeHeight / 2 }, id, item, shape, t: 0, w: 0 })
  })

  relayout()
}

function clearWorld() {
  Matter.Composite.clear(engine.world, false)
  pieces = []
  walls = []
  dragConstraint = undefined
  hovered.value = undefined
  hoverId.value = undefined
  heldId.value = undefined
  picked.value = []
  flying.value = new Set()
  hudId = undefined
}

// The row of picked pieces. A picked piece stands up out of the floor and floats toward the
// camera, which scales it about the perspective origin — so the row is laid out in unlifted
// screen space, at the one depth that projects onto the stage's own centre line, the point the
// lift cannot move. `dy` then carries the row up off that line: it is a lift in the piece's own
// frame, which the stand-up has already squared to the screen, so 1px of it is 1px of rise.
function rowPlan() {
  const depth = height / (2 * Math.cos(tilt))
  const scale = PERSPECTIVE / (PERSPECTIVE + depth * Math.sin(tilt))
  const grow = 1 / (1 - (LIFT * scale) / PERSPECTIVE)
  const lifted = scale * grow
  // The widest piece in the row sets the step, so a row of discs keeps the spacing it always had
  // and a row of books opens as wide as the books need.
  const widest = picked.value.reduce((w, id) => Math.max(w, pieces.find(piece => piece.id === id)?.w ?? 0), 0)
  const spread = Math.min(widest * lifted * 1.3, width / Math.max(1, picked.value.length))
  return {
    grow,
    dy: (ROW_Y * height - height / 2) / lifted,
    slot: (index: number) => planeFromScreen(
      width / 2 + ((index - (picked.value.length - 1) / 2) * spread) / grow,
      height / 2,
    ),
  }
}

// Where a piece belongs: its point on the plane, its offset in the plane's frame, and its lift.
function place(piece: Piece) {
  const row = picked.value.indexOf(piece.id)
  if (row < 0)
    return { dy: 0, grow: 1, up: false, ...piece.body.position }
  const plan = rowPlan()
  return { dy: plan.dy, grow: plan.grow, up: true, ...plan.slot(row) }
}

// Where a piece is drawn, in stage pixels: its centre, its half-size on screen, and whether it is
// standing in the row.
function screenOf(piece: Piece) {
  const { dy, grow, up, x, y } = place(piece)
  const depth = planeHeight - y
  const scale = (PERSPECTIVE / (PERSPECTIVE + depth * Math.sin(tilt))) * grow
  return {
    hh: piece.h / 2 * scale,
    hw: piece.w / 2 * scale,
    up,
    x: width / 2 + (x - width / 2) * scale,
    y: height / 2 + (height / 2 - depth * Math.cos(tilt) + dy) * scale,
  }
}

// One transform for both places a piece can be: on the floor, or standing in the row. The
// function list is the same either way, so the browser has something to interpolate between, and
// the piece's own angle is the in-plane spin on the floor. Standing in the row, a box squares up
// to the screen; a disc spins, it looks the same either way. Hovering never moves a piece, it only
// lights up; a grabbed one lifts a hair off the floor. Lying down, the cover rides a thickness
// above the floor, which is where the sides hanging off it end.
function transform(piece: Piece, { dy, up, x, y }: ReturnType<typeof place>) {
  const held = heldId.value === piece.id
  const hover = hoverId.value === piece.id
  const spin = (up && piece.shape.kind !== 'disc' ? 0 : piece.body.angle * 180 / Math.PI).toFixed(2)
  return `translate3d(${(x - piece.w / 2).toFixed(2)}px, ${(y - piece.h / 2).toFixed(2)}px, ${up ? 0 : 2 + piece.t}px)`
    + ` rotateX(${up ? -TILT_DEG : 0}deg) translateY(${dy.toFixed(2)}px) rotate(${spin}deg)`
    + ` translateZ(${up ? LIFT : held ? 7 : 0}px) scale(${held ? 1.1 : hover ? 1.06 : 1})`
}

// A flight is over: let physics have the piece back, where it left off.
function land(piece: Piece) {
  flying.value.delete(piece.id)
  if (picked.value.includes(piece.id) || Matter.Composite.allBodies(engine.world).includes(piece.body))
    return
  Matter.Composite.add(engine.world, piece.body)
  Matter.Sleeping.set(piece.body, false)
  wake()
}

// A click either lifts a piece out of the pile into the row, or drops it back on the floor, and
// either way it shifts every other piece in the row sideways — so they all fly, and the row closes
// up or opens out instead of snapping around the piece that left or arrived.
function toggle(piece: Piece) {
  void setRow(picked.value.includes(piece.id)
    ? picked.value.filter(id => id !== piece.id)
    : [...picked.value, piece.id])
}

// Move the row to `next`, whichever pieces that leaves in or out of it.
async function setRow(next: string[]) {
  const moved = [...picked.value, ...next]
  const arrivals = next.filter(id => !picked.value.includes(id))
  picked.value = next
  // Reduced motion has no transition to hold open, and no transitionend to close it.
  if (!reduced)
    moved.forEach(id => flying.value.add(id))
  if (arrivals.length) {
    pickSound()
    for (const piece of pieces) {
      if (arrivals.includes(piece.id))
        Matter.Composite.remove(engine.world, piece.body)
    }
  }
  // Vue puts `is-flying` on the elements in this same flush, so the transforms written right
  // after are ones the browser can see change: the pieces stand up as they fly.
  await nextTick()
  sync()
  if (reduced)
    for (const piece of pieces) {
      if (!picked.value.includes(piece.id))
        land(piece)
    }
}

// What Jev was measured with (scripts/pick-probe.ts), read off the items the user is looking at.
function payload(text: string) {
  return {
    items: props.items.map(item => ({
      category: item.category,
      id: item.id,
      progress: item.progress,
      rating: item.rating,
      summary: item.summary,
      tags: item.tags,
      title: item.title,
      titleZh: item.titleCn,
      total: item.total,
      year: item.date ? item.date.slice(0, 4) : '',
    })),
    prompt: text,
  }
}

// The measured rule: keep whatever comes close to the best answer, and let the floor decide a real
// no-match. The row is those ids in the order Jev ranked them.
function reveal(result: Picks) {
  const floor = Math.max(FLOOR, result.max * RATIO)
  const ids = result.shortlist
    .filter(pick => pick.probability >= floor)
    .slice(0, LIMIT)
    .map(pick => String(pick.id))
  askState.value = ids.length ? 'idle' : 'empty'
  void setRow(ids)
}

// Ask Jev for the row. The second stage of it runs over a shortlist with summaries
// (server/routes/api/pick.ts), which takes a few seconds, so the ask says what it is doing.
async function submit() {
  const text = ask.value.trim()
  if (!text)
    return
  const key = `${props.subject}|${text}`
  const remembered = memo.get(key)
  if (remembered) {
    reveal(remembered)
    return
  }

  controller?.abort()
  const local = new AbortController()
  controller = local
  askState.value = 'thinking'
  try {
    const res = await fetch('/api/pick', {
      body: JSON.stringify(payload(text)),
      headers: { 'Content-Type': 'application/json' },
      method: 'POST',
      signal: local.signal,
    })
    if (!res.ok)
      throw new Error(`API ${res.status}`)
    const result = await res.json() as Picks
    memo.set(key, result)
    reveal(result)
  }
  catch (error) {
    if (local.signal.aborted)
      return
    console.error('[pick]', error)
    askState.value = 'error'
  }
}

// A verdict belongs to the ask it was made for.
function onAskInput() {
  if (askState.value === 'empty' || askState.value === 'error')
    askState.value = 'idle'
}

// Transforms go straight to the DOM, so Vue re-renders never fight the physics.
function sync() {
  if (hovered.value && hud.value) {
    const piece = pieces.find(entry => entry.id === hoverId.value)
    if (piece) {
      const { hh, up, x: px, y: py } = screenOf(piece)
      // The label is centred on its piece, so it needs its own width — which only changes when the
      // hovered piece does, so this stays off the per-frame path.
      if (hudId !== piece.id || !hudWidth) {
        hudId = piece.id
        hudWidth = hud.value.offsetWidth
      }
      const half = hudWidth / 2
      const x = Math.max(8 + half, Math.min(width - 8 - half, px - half))
      // Under a piece in the row: the air above it belongs to the ask.
      const y = Math.max(4, Math.min(height - 24, up ? py + hh + 8 : py - hh - 34))
      hud.value.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    }
  }

  for (const piece of pieces)
    piece.el.style.transform = transform(piece, place(piece))
}

function tick() {
  frame = requestAnimationFrame(tick)
  if (!awake)
    return
  if (!onScreen && !dragConstraint) {
    awake = false
    return
  }
  Matter.Engine.update(engine, 1000 / 60)
  sync()
  if (dragConstraint)
    return
  if (pieces.every(piece => piece.body.isSleeping))
    awake = false
}

function wake() {
  if (!reduced)
    awake = true
}

function engage(piece: Piece | undefined) {
  if (piece?.id === hoverId.value)
    return
  hovered.value = piece?.item
  hoverId.value = piece?.id
  if (piece)
    hoverSound()
  // The lift and the label position are written by the loop, so hovering needs one frame.
  if (reduced)
    sync()
  wake()
}

// Where a point in front of the floor sits on a piece's cover, which is drawn a thickness above it.
// Both axes move — the height pulls a point away from the perspective origin on x and up the screen
// on y — and solving the two projections for one screen point is what keeps the pointer on the piece
// it is over. Without it only the bottom half of a book is grabbable, and its left edge picks
// whatever is behind it.
function onCover(point: { x: number, y: number }, piece: Piece) {
  const z = 2 + piece.t
  const oy = height / 2
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  const depth = planeHeight - point.y
  const flat = PERSPECTIVE / (PERSPECTIVE + depth * sin)
  // How far above the eye's line the cursor is on the floor plane, in screen pixels.
  const ry = (oy - depth * cos) * flat
  // The depth at which the same screen point sits on a cover `z` above the floor, then the rest of
  // the inverse in that point's own scale.
  const cover = (PERSPECTIVE * (oy - ry) + z * (ry * cos - PERSPECTIVE * sin)) / (PERSPECTIVE * cos + ry * sin)
  const scale = PERSPECTIVE / (PERSPECTIVE + cover * sin - z * cos)
  return { x: width / 2 + (point.x - width / 2) * flat / scale, y: planeHeight - cover }
}

function under(point: { x: number, y: number }) {
  let best: Piece | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const piece of pieces) {
    if (picked.value.includes(piece.id))
      continue
    const cover = onCover(point, piece)
    const dx = cover.x - piece.body.position.x
    const dy = cover.y - piece.body.position.y
    // The point in the piece's own frame, then inside its box — a slightly tighter reach than the
    // disc's old 1.3 × radius, since a half-size is what a box can measure itself by.
    const cos = Math.cos(piece.body.angle)
    const sin = Math.sin(piece.body.angle)
    const distance = Math.hypot(dx, dy)
    if (Math.abs(cos * dx + sin * dy) < piece.w * 0.575
      && Math.abs(cos * dy - sin * dx) < piece.h * 0.575
      && distance < bestDistance) {
      best = piece
      bestDistance = distance
    }
  }
  return best
}

// A piece in the row is off the floor, so it is hit in screen space instead. Standing, its angle
// is square to the screen, so its box is a plain rectangle there.
function underRow(clientX: number, clientY: number) {
  const rect = stage.value!.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  return pieces.find((piece) => {
    if (!picked.value.includes(piece.id))
      return false
    const screen = screenOf(piece)
    return Math.abs(screen.x - x) < Math.max(screen.hw, 12)
      && Math.abs(screen.y - y) < Math.max(screen.hh, 12)
  })
}

function onPointerMove(event: PointerEvent) {
  if (!canDrag)
    return
  const point = toPlane(event.clientX, event.clientY)
  if (dragConstraint) {
    // The piece follows the point on its own cover under the cursor, which is where it was grabbed —
    // dragging the floor point instead would pull a box up by a thickness the moment it is pressed.
    const piece = pieces.find(entry => entry.id === heldId.value)
    dragConstraint.pointA = piece ? onCover(point, piece) : point
    if (Math.hypot(point.x - pointerStart.x, point.y - pointerStart.y) > 5)
      dragged = true
    wake()
    return
  }
  engage(underRow(event.clientX, event.clientY) ?? under(point))
}

function onPointerDown(event: PointerEvent) {
  if (!canDrag || event.button !== 0)
    return
  const point = toPlane(event.clientX, event.clientY)
  pointerStart = point
  dragged = false
  // A piece in the row is not grabbable — a constraint would still pull its body, which is off
  // the floor — it goes back on click instead.
  const piece = underRow(event.clientX, event.clientY) ?? under(point)
  if (!piece || picked.value.includes(piece.id))
    return
  // Grabbed: it follows the cursor while held, and stays where it is dropped.
  heldId.value = piece.id
  event.preventDefault()
  Matter.Sleeping.set(piece.body, false)
  dragConstraint = Matter.Constraint.create({
    bodyB: piece.body,
    damping: 0.35,
    length: 0,
    pointA: onCover(point, piece),
    pointB: { x: 0, y: 0 },
    stiffness: 0.28,
  })
  Matter.Composite.add(engine.world, dragConstraint)
  wake()
}

function onPointerUp() {
  heldId.value = undefined
  if (!dragConstraint)
    return
  Matter.Composite.remove(engine.world, dragConstraint)
  dragConstraint = undefined
  wake()
}

function onClick(event: MouseEvent, id: string) {
  if (dragged) {
    event.preventDefault()
    dragged = false
    return
  }
  const piece = pieces.find(entry => entry.id === id)
  if (piece)
    void toggle(piece)
}

// A piece that has finished its flight either way is no longer mid-air.
function onTransitionEnd(event: TransitionEvent) {
  if (event.propertyName !== 'transform')
    return
  const id = (event.target as HTMLElement).dataset.piece
  const piece = id && pieces.find(entry => entry.id === id)
  if (piece)
    land(piece)
}

function onPointerLeave() {
  if (dragConstraint)
    return
  engage(undefined)
}

let resizeObserver: ResizeObserver | undefined
let intersectionObserver: IntersectionObserver | undefined

onMounted(() => {
  build()
  if (reduced) {
    sync()
    return
  }
  resizeObserver = new ResizeObserver(() => relayout())
  resizeObserver.observe(stage.value!)
  intersectionObserver = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting
    if (onScreen)
      wake()
  }, { threshold: 0 })
  intersectionObserver.observe(stage.value!)
  frame = requestAnimationFrame(tick)
})

onBeforeUnmount(() => {
  cancelAnimationFrame(frame)
  controller?.abort()
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  clearWorld()
  Matter.Engine.clear(engine)
})

watch(() => props.items, () => {
  controller?.abort()
  askState.value = 'idle'
  clearWorld()
  build()
  if (reduced)
    sync()
}, { flush: 'post' })
</script>

<template>
  <div
    ref="stage"
    class="stage"
    @pointerdown="onPointerDown"
    @pointerleave="onPointerLeave"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @transitionend="onTransitionEnd"
  >
    <form
      class="ask"
      :class="{ 'is-error': askState === 'error' }"
      @pointerdown.stop
      @submit.prevent="submit"
    >
      <input
        v-model="ask"
        type="text"
        enterkeyhint="go"
        :placeholder="t.pick"
        :aria-label="t.pick"
        @input="onAskInput"
      >
      <span
        v-if="askStatus"
        class="ask-state"
        :class="{ 'is-thinking': askState === 'thinking' }"
        aria-live="polite"
      >
        {{ askStatus }}
      </span>
    </form>
    <div class="world">
      <div class="floor" aria-hidden="true" />
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="piece"
        :class="[
          `is-${SHAPES[item.subjectType].kind}`,
          {
            'is-held': heldId === String(item.id),
            'is-hover': hoverId === String(item.id),
            'is-picked': picked.includes(String(item.id)),
            'is-flying': flying.has(String(item.id)),
          },
        ]"
        :data-piece="String(item.id)"
        :aria-label="title(item)"
        :aria-pressed="picked.includes(String(item.id))"
        @click="onClick($event, String(item.id))"
      >
        <span class="piece-cover">
          <img :src="item.cover" alt="" draggable="false" loading="lazy" decoding="async">
          <span class="piece-sheen" aria-hidden="true" />
          <span class="piece-ring" aria-hidden="true" />
        </span>
        <template v-if="SHAPES[item.subjectType].kind !== 'disc'">
          <span class="piece-edge is-near" aria-hidden="true" />
          <span class="piece-edge is-far" aria-hidden="true" />
          <span class="piece-edge is-left" aria-hidden="true" />
          <span class="piece-edge is-right is-spine" aria-hidden="true" />
        </template>
      </button>
    </div>

    <Transition name="hud">
      <p v-if="hovered" ref="hud" class="hud">
        {{ title(hovered) }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.stage {
  position: relative;
  height: min(56vh, 28rem);
  overflow: hidden;
  border: 1px solid rgb(var(--border));
  border-radius: 0.75rem;
  background:
    radial-gradient(ellipse at 50% 92%, rgb(255 255 255 / 0.95), transparent 68%),
    rgb(248 248 248);
  perspective: 1000px;
  perspective-origin: 50% 50%;
  touch-action: pan-y;
}

/* The floor plane. Anchored on its near edge and tilted away, so its far edge projects onto
   the horizon line and everything inside it inherits the perspective. */
.world {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: var(--world-height, 60%);
  transform: rotateX(var(--tilt, 55deg));
  transform-origin: 50% 100%;
  transform-style: preserve-3d;
}

.floor {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(0deg, transparent 0 3px, rgb(23 23 23 / 0.03) 3px 4px),
    repeating-linear-gradient(90deg, transparent 0 79px, rgb(23 23 23 / 0.035) 79px 80px),
    repeating-linear-gradient(0deg, transparent 0 79px, rgb(23 23 23 / 0.035) 79px 80px),
    linear-gradient(to bottom, rgb(252 252 252), rgb(242 242 242) 60%, rgb(236 236 236));
  box-shadow: inset 0 12px 18px rgb(0 0 0 / 0.05);
  pointer-events: none;
}

/* Sits in the air above the row, which hangs below the horizon and never reaches this far up. */
.ask {
  position: absolute;
  top: 0.75rem;
  left: 50%;
  z-index: 6;
  display: flex;
  gap: 0.5rem;
  align-items: center;
  width: min(16rem, 60vw);
  padding: 0.35rem 0.85rem;
  border: 1px solid rgb(var(--border));
  border-radius: 999px;
  background: rgb(var(--background) / 0.72);
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.08);
  transform: translateX(-50%);
  transition: border-color 200ms ease;
  backdrop-filter: blur(8px);
}

.ask:focus-within {
  border-color: rgb(23 23 23 / 0.5);
}

.ask.is-error {
  border-color: rgb(220 38 38 / 0.6);
}

.ask input {
  min-width: 0;
  flex: 1;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font-size: 0.75rem;
  line-height: 1.4;
  letter-spacing: 0.02em;
  outline: none;
}

.ask input::placeholder {
  color: rgb(115 115 115);
}

/* What the last ask is doing: thinking, nothing found, or failed. */
.ask-state {
  flex-shrink: 0;
  color: rgb(115 115 115);
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.ask.is-error .ask-state {
  color: rgb(220 38 38);
}

/* Waiting has nothing to move, so it only breathes. */
.ask-state.is-thinking {
  animation: ask-wait 1.1s ease-in-out infinite;
}

@keyframes ask-wait {
  50% {
    opacity: 0.35;
  }
}

.dark .ask {
  background: rgb(255 255 255 / 0.06);
}

.dark .ask:focus-within {
  border-color: rgb(212 212 212 / 0.5);
}

.dark .ask input::placeholder,
.dark .ask-state {
  color: rgb(163 163 163);
}

.dark .ask.is-error {
  border-color: rgb(248 113 113 / 0.6);
}

.dark .ask.is-error .ask-state {
  color: rgb(248 113 113);
}

.piece {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--piece-w, 3rem);
  height: var(--piece-h, 3rem);
  padding: 0;
  border: 0;
  background: none;
  cursor: pointer;
  /* Everything but a disc is a box: the cover is its near face and four sides hang off it into the
     plane's depth, which is why nothing here may clip — an `overflow: hidden` would flatten the box
     and cut its sides off. (Keeping the 3D is the one thing a disc must not do: flattened, it
     renders exactly as it did before there were boxes.) */
  box-shadow: 0 0 6px rgb(0 0 0 / 0.28);
  transform-origin: center;
  /* `--piece-fly` holds the flight's own easing: 0ms unless the piece is moving between the
     floor and the row. */
  transition: opacity 260ms ease, filter 260ms ease, box-shadow 200ms ease, transform var(--piece-fly, 0ms);
  will-change: transform;
  -webkit-user-drag: none;
  user-select: none;
}

.piece.is-book,
.piece.is-card {
  transform-style: preserve-3d;
}

/* A disc is the flat plate it always was: round, the hub punched through, and a shadow that leans
   away from the light because the disc never turns. It can keep the clip it always had, too — it has
   no sides to flatten. */
.piece.is-disc {
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 2px 5px rgb(0 0 0 / 0.22);
}

.piece.is-flying {
  --piece-fly: 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

.piece.is-picked {
  box-shadow: 0 10px 20px rgb(0 0 0 / 0.28);
}

.piece-cover {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 2px;
  background: rgb(245 245 244);
}

.piece.is-disc .piece-cover {
  border-radius: 50%;
  background: none;
  /* The hub is punched through, so whatever lies under the piece shows in the hole.
     The mask sits here, not on .piece: a mask clips to the border box, so hoisting it
     would also erase the piece's shadow and its ring. */
  -webkit-mask-image: radial-gradient(circle at center, transparent 0 10.5%, #000 11.5%);
  mask-image: radial-gradient(circle at center, transparent 0 10.5%, #000 11.5%);
}

/* The four sides of a box: each is hinged on one of the cover's edges and folded back by one
   thickness into the plane's depth. They are one-sided — the inside of a box is never on screen —
   and `backface-visibility` is what leaves it out. */
.piece-edge {
  position: absolute;
  backface-visibility: hidden;
}

.piece-edge.is-near {
  top: 100%;
  left: 0;
  width: var(--piece-w);
  height: var(--piece-t);
  transform: rotateX(-90deg);
  transform-origin: 50% 0;
}

.piece-edge.is-far {
  bottom: 100%;
  left: 0;
  width: var(--piece-w);
  height: var(--piece-t);
  transform: rotateX(90deg);
  transform-origin: 50% 100%;
}

.piece-edge.is-left {
  top: 0;
  right: 100%;
  width: var(--piece-t);
  height: var(--piece-h);
  transform: rotateY(-90deg);
  transform-origin: 100% 50%;
}

.piece-edge.is-right {
  top: 0;
  left: 100%;
  width: var(--piece-t);
  height: var(--piece-h);
  transform: rotateY(90deg);
  transform-origin: 0 50%;
}

/* A book's thickness is a page block: warm paper, the grain of the pages running along it, and a
   fold that darkens from the crease at the cover down to the cut edge. It has to be a good deal
   darker than the floor or the depth of a lying book vanishes into it, and it must not read as one
   hard black band either — so the light falls off across the whole strip, the boards shadow its
   ends, and the leaf lines are laid at two periods so they never quite line up. */
.piece.is-book .piece-edge {
  background-color: rgb(242 238 230);
  background-image:
    linear-gradient(to right, rgb(0 0 0 / 0.3) 0 4%, rgb(0 0 0 / 0.12) 15%, transparent 32% 68%, rgb(0 0 0 / 0.12) 85%, rgb(0 0 0 / 0.3) 96%),
    repeating-linear-gradient(to bottom, transparent 0 1px, rgb(0 0 0 / 0.025) 1px 2px),
    linear-gradient(to bottom, rgb(0 0 0 / 0.12), rgb(0 0 0 / 0.26));
  border-radius: 0 0 3px 3px;
}

.piece.is-book .piece-edge.is-left,
.piece.is-book .piece-edge.is-right {
  background-image:
    repeating-linear-gradient(to right, transparent 0 1px, rgb(0 0 0 / 0.025) 1px 2px),
    linear-gradient(to bottom, rgb(0 0 0 / 0.12), rgb(0 0 0 / 0.26));
}

/* Board covers are not knives: the corners are eased, and the board hinges just inside the spine. */
.piece.is-book .piece-cover {
  border-radius: 4px;
}

.piece.is-book .piece-cover::after {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 8%;
  background-image: linear-gradient(to left, transparent 0 20%, rgb(0 0 0 / 0.2) 30%, rgb(0 0 0 / 0.04) 55%, rgb(255 255 255 / 0.14) 72%, transparent 100%);
  content: '';
}

/* A card is barely thicker than its print. */
.piece.is-card .piece-edge {
  background-color: rgb(208 208 206);
  background-image: linear-gradient(to bottom, transparent, rgb(0 0 0 / 0.3));
}

/* A Japanese book opens the other way, so its spine is on the right, and the spine wears the
   cover's own right edge stretched down the thickness. It sets the image only, so the dark-mode
   colours land on the same face without cleaving it off. */
.piece.is-book .piece-edge.is-right.is-spine {
  background-image: var(--piece-cover, none);
  background-position: right center;
  background-repeat: no-repeat;
  background-size: 1666% 100%;
}

.piece img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

/* A disc's label is a print on the plate, a hair wider than the rim it sits inside. */
.piece.is-disc img {
  transform: scale(1.12);
}

.piece-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(118deg, rgb(255 255 255 / 0.26) 0%, rgb(255 255 255 / 0.04) 38%, transparent 55%);
  pointer-events: none;
}

/* Rim around the punch: without it a hole in a white floor reads as a white dot. */
.piece.is-disc .piece-ring {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, transparent 0 10.8%, rgb(0 0 0 / 0.22) 11.6%, transparent 13.5%);
  pointer-events: none;
}

/* A record: the vinyl is the plate, the cover is printed on the label in the middle of it, and the
   spindle is punched through both. The grooves are what keep a black disc from reading as a hole in
   the floor. */
.piece.is-vinyl .piece-cover {
  border-radius: 50%;
  background-color: rgb(13 13 15);
  background-image:
    repeating-radial-gradient(circle at center, transparent 0 1px, rgb(255 255 255 / 0.05) 1px 2px, transparent 2px 4px),
    radial-gradient(circle at center, rgb(38 38 42), rgb(8 8 10) 72%);
  -webkit-mask-image: radial-gradient(circle at center, transparent 0 2.6%, #000 3.4%);
  mask-image: radial-gradient(circle at center, transparent 0 2.6%, #000 3.4%);
}

.piece.is-vinyl img {
  /* the label. `inset` with `width: auto` does not stretch a replaced element — size it. */
  position: absolute;
  top: 33%;
  left: 33%;
  width: 34%;
  height: 34%;
  border-radius: 50%;
  box-shadow: 0 0 0 1px rgb(255 255 255 / 0.08);
}

.piece.is-held {
  z-index: 5;
  box-shadow: 0 12px 22px rgb(0 0 0 / 0.32), 0 0 0 1px rgb(255 255 255 / 0.85);
}

.piece.is-hover {
  z-index: 4;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.24), 0 0 0 1px rgb(255 255 255 / 0.7);
}

.piece:focus-visible {
  outline: 2px solid rgb(23 23 23 / 0.6);
  outline-offset: 3px;
}

.hud {
  position: absolute;
  /* At the stage's origin: the transform written per frame is where the label actually goes. */
  top: 0;
  left: 0;
  z-index: 4;
  max-width: calc(100% - 1.5rem);
  overflow: hidden;
  padding: 1px 7px;
  border: 1px solid rgb(var(--border));
  border-radius: 999px;
  background: rgb(var(--background) / 0.88);
  box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
  color: rgb(64 64 64);
  font-size: 0.7rem;
  letter-spacing: 0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
  pointer-events: none;
}

.hud-enter-active,
.hud-leave-active {
  transition: opacity 140ms ease;
}

.hud-enter-from,
.hud-leave-to {
  opacity: 0;
}

/* Plain `.dark …`, not `:global(.dark) …`: this build drops `:global(...)` selectors outright,
   which also silently kills CollectionTable's dark highlight rules. `.dark` matches <html>
   (useTheme), so the scoped attribute on the selector's tail is all that is needed. */
.dark .stage {
  background:
    radial-gradient(ellipse at 50% 92%, rgb(255 255 255 / 0.07), transparent 68%),
    rgb(9 9 9);
}

.dark .floor {
  background:
    repeating-linear-gradient(0deg, transparent 0 3px, rgb(255 255 255 / 0.025) 3px 4px),
    repeating-linear-gradient(90deg, transparent 0 79px, rgb(255 255 255 / 0.03) 79px 80px),
    repeating-linear-gradient(0deg, transparent 0 79px, rgb(255 255 255 / 0.03) 79px 80px),
    linear-gradient(to bottom, rgb(24 24 24), rgb(17 17 17) 60%, rgb(12 12 12));
  box-shadow: inset 0 12px 18px rgb(0 0 0 / 0.45);
}

/* A book's cover is paper too, so the slate behind a cover that has not loaded yet cannot stay
   white in the dark. A disc's cover has none. */
.dark .piece.is-book .piece-cover,
.dark .piece.is-card .piece-cover {
  background-color: rgb(38 38 38);
}

.dark .piece.is-card .piece-edge {
  background-color: rgb(70 70 70);
}

.dark .piece.is-disc .piece-ring {
  background: radial-gradient(circle at center, transparent 0 10.8%, rgb(255 255 255 / 0.16) 11.6%, transparent 13.5%);
}

.dark .hud {
  /* The same faint wash the ask input wears, so both read as raised surfaces in the dark. */
  background: rgb(255 255 255 / 0.06);
  color: rgb(212 212 212);
}

@media (prefers-reduced-motion: reduce) {
  .piece,
  .stage {
    transition: none;
  }

  .ask-state {
    animation: none;
  }
}
</style>
