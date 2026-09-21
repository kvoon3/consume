<script setup lang="ts" vapor>
import { defineSound } from '@web-kits/audio'
import Matter from 'matter-js'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type { MediaItem } from '../composables/useBangumi'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  items: MediaItem[]
}>()

const { t } = useLocale()

// The ask that will go to the picker.
const ask = ref('')

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

interface Disc {
  body: Matter.Body
  el: HTMLElement
  home: { x: number, y: number }
  id: string
  item: MediaItem
  spin: number
}

// A floor of discs, seen in perspective. matter-js keeps working in the plane's own
// coordinates — its (x, y) is the scene's (x, z) — so the physics stays 2D on a surface that
// is drawn tilted, and nothing here has to know about the projection except the pointer.
const stage = ref<HTMLElement>()
const hud = ref<HTMLElement>()

// Air above the floor, as a share of the stage: the floor's far edge is projected onto this
// line. Camera distance and how steeply the floor tilts away.
const HORIZON = 0.42
const PERSPECTIVE = 1000
const TILT_DEG = 55
// How far a picked disc floats toward the camera, in the same pixels as the plane's own
// coordinates: off its surface, and in front of anything else at the row's depth.
const LIFT = 56
// And how high the row hangs, as a share of the stage: clear of the floor, whose far edge and
// the discs on it stop at the horizon line.
const ROW_Y = 0.28

const hovered = shallowRef<MediaItem>()
const hoverId = ref<string>()
// Nothing on the floor moves until it is grabbed: hovering only lights a disc up and labels it.
const heldId = ref<string>()
// Picked discs leave the pile and stand in a row through the middle of the stage, in pick order.
const picked = ref<string[]>([])
// Mid-flight discs hold a transform transition; the row and the floor both leave them alone
// until they land.
const flying = ref(new Set<string>())

const canDrag = window.matchMedia('(hover: hover) and (pointer: fine)').matches
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

const engine = Matter.Engine.create({ gravity: { x: 0, y: 0 } })
engine.enableSleeping = true

let discs: Disc[] = []
let walls: Matter.Body[] = []
let frame = 0
let radius = 24
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
  const next = Math.max(10, Math.min(cell.x, cell.y) * 0.42)
  const scale = radius ? next / radius : 1
  radius = next
  el.style.setProperty('--disc-size', `${radius * 2}px`)

  const margin = radius + 6
  const inner = { x: width - margin * 2, y: planeHeight - margin * 2 }

  discs.forEach((disc, index) => {
    const column = index % columns
    const row = Math.floor(index / columns)
    disc.home = {
      x: margin + ((column + 0.5 + (seed(disc.id, 1) - 0.5) * 0.62) / columns) * inner.x,
      y: margin + ((row + 0.5 + (seed(disc.id, 2) - 0.5) * 0.62) / rows) * inner.y,
    }
    if (scale !== 1)
      Matter.Body.set(disc.body, 'circleRadius', radius)
    Matter.Body.setPosition(disc.body, disc.home)
    Matter.Body.setVelocity(disc.body, { x: 0, y: 0 })
  })

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

function build() {
  clearWorld()
  const el = stage.value
  if (!el)
    return
  width = el.clientWidth
  height = el.clientHeight

  const nodes = el.querySelectorAll<HTMLElement>('[data-disc]')
  props.items.forEach((item, index) => {
    const node = nodes[index]
    if (!node)
      return
    const id = String(item.id)
    const body = Matter.Bodies.circle(width / 2, planeHeight / 2, radius, {
      friction: 0.25,
      frictionAir: 0.14,
      restitution: 0.12,
      sleepThreshold: 45,
    })
    Matter.Sleeping.set(body, true)
    Matter.Composite.add(engine.world, body)
    discs.push({ body, el: node, home: { x: width / 2, y: planeHeight / 2 }, id, item, spin: (seed(id, 3) - 0.5) * 14 })
  })

  relayout()
}

function clearWorld() {
  Matter.Composite.clear(engine.world, false)
  discs = []
  walls = []
  dragConstraint = undefined
  hovered.value = undefined
  hoverId.value = undefined
  heldId.value = undefined
  picked.value = []
  flying.value = new Set()
  hudId = undefined
}

// The row of picked discs. A picked disc stands up out of the floor and floats toward the
// camera, which scales it about the perspective origin — so the row is laid out in unlifted
// screen space, at the one depth that projects onto the stage's own centre line, the point the
// lift cannot move. `dy` then carries the row up off that line: it is a lift in the disc's own
// frame, which the stand-up has already squared to the screen, so 1px of it is 1px of rise.
function rowPlan() {
  const depth = height / (2 * Math.cos(tilt))
  const scale = PERSPECTIVE / (PERSPECTIVE + depth * Math.sin(tilt))
  const grow = 1 / (1 - (LIFT * scale) / PERSPECTIVE)
  const lifted = scale * grow
  const spread = Math.min(radius * lifted * 2.6, width / Math.max(1, picked.value.length))
  return {
    grow,
    dy: (ROW_Y * height - height / 2) / lifted,
    slot: (index: number) => planeFromScreen(
      width / 2 + ((index - (picked.value.length - 1) / 2) * spread) / grow,
      height / 2,
    ),
  }
}

// Where a disc belongs: its point on the plane, its offset in the plane's frame, and its lift.
function place(disc: Disc) {
  const row = picked.value.indexOf(disc.id)
  if (row < 0)
    return { dy: 0, grow: 1, up: false, ...disc.body.position }
  const plan = rowPlan()
  return { dy: plan.dy, grow: plan.grow, up: true, ...plan.slot(row) }
}

// Where a disc is drawn, in stage pixels: its centre, its on-screen radius, and whether it is
// standing in the row.
function screenOf(disc: Disc) {
  const { dy, grow, up, x, y } = place(disc)
  const depth = planeHeight - y
  const scale = (PERSPECTIVE / (PERSPECTIVE + depth * Math.sin(tilt))) * grow
  return {
    r: radius * scale,
    up,
    x: width / 2 + (x - width / 2) * scale,
    y: height / 2 + (height / 2 - depth * Math.cos(tilt) + dy) * scale,
  }
}

// One transform for both places a disc can be: on the floor, or standing in the row. The
// function list is the same either way, so the browser has something to interpolate between,
// and the spin is in-plane on the floor and on the disc's face once it has stood up. Hovering
// never moves a disc, it only lights up; a grabbed one lifts a hair off the floor.
function transform(disc: Disc, { dy, up, x, y }: ReturnType<typeof place>) {
  const held = heldId.value === disc.id
  const hover = hoverId.value === disc.id
  return `translate3d(${(x - radius).toFixed(2)}px, ${(y - radius).toFixed(2)}px, ${up ? 0 : 2}px)`
    + ` rotateX(${up ? -TILT_DEG : 0}deg) translateY(${dy.toFixed(2)}px) rotate(${disc.spin.toFixed(2)}deg)`
    + ` translateZ(${up ? LIFT : held ? 7 : 0}px) scale(${held ? 1.1 : hover ? 1.06 : 1})`
}

// A flight is over: let physics have the disc back, where it left off.
function land(disc: Disc) {
  flying.value.delete(disc.id)
  if (picked.value.includes(disc.id) || Matter.Composite.allBodies(engine.world).includes(disc.body))
    return
  Matter.Composite.add(engine.world, disc.body)
  Matter.Sleeping.set(disc.body, false)
  wake()
}

// A click either lifts a disc out of the pile into the row, or drops it back on the floor, and
// either way it shifts every other disc in the row sideways — so they all fly, and the row closes
// up or opens out instead of snapping around the disc that left or arrived.
function toggle(disc: Disc) {
  void setRow(picked.value.includes(disc.id)
    ? picked.value.filter(id => id !== disc.id)
    : [...picked.value, disc.id])
}

// Move the row to `next`, whichever discs that leaves in or out of it.
async function setRow(next: string[]) {
  const moved = [...picked.value, ...next]
  const arrivals = next.filter(id => !picked.value.includes(id))
  picked.value = next
  // Reduced motion has no transition to hold open, and no transitionend to close it.
  if (!reduced)
    moved.forEach(id => flying.value.add(id))
  if (arrivals.length) {
    pickSound()
    for (const disc of discs) {
      if (arrivals.includes(disc.id))
        Matter.Composite.remove(engine.world, disc.body)
    }
  }
  // Vue puts `is-flying` on the elements in this same flush, so the transforms written right
  // after are ones the browser can see change: the discs stand up as they fly.
  await nextTick()
  sync()
  if (reduced)
    for (const disc of discs) {
      if (!picked.value.includes(disc.id))
        land(disc)
    }
}

// The ask, for now, is thrown away: five random discs is enough to watch the row move.
// ponytail: this is where the Jev pick goes — POST `ask`, then `setRow` the ids it answers with.
function submit() {
  const pool = props.items.map(item => String(item.id))
  const next: string[] = []
  while (next.length < Math.min(5, pool.length)) {
    const id = pool[Math.floor(Math.random() * pool.length)]
    if (!next.includes(id))
      next.push(id)
  }
  void setRow(next)
}

// Transforms go straight to the DOM, so Vue re-renders never fight the physics.
function sync() {
  if (hovered.value && hud.value) {
    const disc = discs.find(entry => entry.id === hoverId.value)
    if (disc) {
      const { r, up, x: px, y: py } = screenOf(disc)
      // The label is centred on its disc, so it needs its own width — which only changes when the
      // hovered disc does, so this stays off the per-frame path.
      if (hudId !== disc.id || !hudWidth) {
        hudId = disc.id
        hudWidth = hud.value.offsetWidth
      }
      const half = hudWidth / 2
      const x = Math.max(8 + half, Math.min(width - 8 - half, px - half))
      // Under a disc in the row: the air above it belongs to the ask.
      const y = Math.max(4, Math.min(height - 24, up ? py + r + 8 : py - r - 34))
      hud.value.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    }
  }

  for (const disc of discs)
    disc.el.style.transform = transform(disc, place(disc))
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
  if (discs.every(disc => disc.body.isSleeping))
    awake = false
}

function wake() {
  if (!reduced)
    awake = true
}

function engage(disc: Disc | undefined) {
  if (disc?.id === hoverId.value)
    return
  hovered.value = disc?.item
  hoverId.value = disc?.id
  if (disc)
    hoverSound()
  // The lift and the label position are written by the loop, so hovering needs one frame.
  if (reduced)
    sync()
  wake()
}

function under(point: { x: number, y: number }) {
  let best: Disc | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const disc of discs) {
    if (picked.value.includes(disc.id))
      continue
    const { x, y } = disc.body.position
    const distance = Math.hypot(x - point.x, y - point.y)
    if (distance < radius * 1.3 && distance < bestDistance) {
      best = disc
      bestDistance = distance
    }
  }
  return best
}

// A disc in the row is off the floor, so it is hit in screen space instead.
function underRow(clientX: number, clientY: number) {
  const rect = stage.value!.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  return discs.find((disc) => {
    if (!picked.value.includes(disc.id))
      return false
    const screen = screenOf(disc)
    return Math.hypot(screen.x - x, screen.y - y) < Math.max(screen.r, 12)
  })
}

function onPointerMove(event: PointerEvent) {
  if (!canDrag)
    return
  const point = toPlane(event.clientX, event.clientY)
  if (dragConstraint) {
    dragConstraint.pointA = point
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
  // A disc in the row is not grabbable — a constraint would still pull its body, which is off
  // the floor — it goes back on click instead.
  const disc = underRow(event.clientX, event.clientY) ?? under(point)
  if (!disc || picked.value.includes(disc.id))
    return
  // Grabbed: it follows the cursor while held, and stays where it is dropped.
  heldId.value = disc.id
  event.preventDefault()
  Matter.Sleeping.set(disc.body, false)
  dragConstraint = Matter.Constraint.create({
    bodyB: disc.body,
    damping: 0.35,
    length: 0,
    pointA: point,
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
  const disc = discs.find(entry => entry.id === id)
  if (disc)
    void toggle(disc)
}

// A disc that has finished its flight either way is no longer mid-air.
function onTransitionEnd(event: TransitionEvent) {
  if (event.propertyName !== 'transform')
    return
  const id = (event.target as HTMLElement).dataset.disc
  const disc = id && discs.find(entry => entry.id === id)
  if (disc)
    land(disc)
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
  resizeObserver?.disconnect()
  intersectionObserver?.disconnect()
  clearWorld()
  Matter.Engine.clear(engine)
})

watch(() => props.items, () => {
  clearWorld()
  build()
  if (reduced)
    sync()
}, { flush: 'post' })
</script>

<template>
  <div
    ref="stage"
    class="disc-stage"
    @pointerdown="onPointerDown"
    @pointerleave="onPointerLeave"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
    @transitionend="onTransitionEnd"
  >
    <form class="disc-ask" @pointerdown.stop @submit.prevent="submit">
      <input v-model="ask" type="text" enterkeyhint="go" :placeholder="t.pick" :aria-label="t.pick">
    </form>
    <div class="disc-world">
      <div class="disc-floor" aria-hidden="true" />
      <button
        v-for="item in items"
        :key="item.id"
        type="button"
        class="disc"
        :class="{
          'is-held': heldId === String(item.id),
          'is-hover': hoverId === String(item.id),
          'is-picked': picked.includes(String(item.id)),
          'is-flying': flying.has(String(item.id)),
        }"
        :data-disc="String(item.id)"
        :aria-label="title(item)"
        :aria-pressed="picked.includes(String(item.id))"
        @click="onClick($event, String(item.id))"
      >
        <span class="disc-face">
          <img :src="item.cover" alt="" draggable="false" loading="lazy" decoding="async">
          <span class="disc-sheen" aria-hidden="true" />
          <span class="disc-ring" aria-hidden="true" />
        </span>
      </button>
    </div>

    <Transition name="hud">
      <p v-if="hovered" ref="hud" class="disc-hud">
        {{ title(hovered) }}
      </p>
    </Transition>
  </div>
</template>

<style scoped>
.disc-stage {
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
.disc-world {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  height: var(--world-height, 60%);
  transform: rotateX(var(--tilt, 55deg));
  transform-origin: 50% 100%;
  transform-style: preserve-3d;
}

.disc-floor {
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
.disc-ask {
  position: absolute;
  top: 0.75rem;
  left: 50%;
  z-index: 6;
  transform: translateX(-50%);
}

.disc-ask input {
  width: min(16rem, 60vw);
  padding: 0.3rem 0.85rem;
  border: 1px solid rgb(var(--border));
  border-radius: 999px;
  background: rgb(var(--background) / 0.72);
  box-shadow: 0 2px 10px rgb(0 0 0 / 0.08);
  color: inherit;
  font-size: 0.75rem;
  letter-spacing: 0.02em;
  backdrop-filter: blur(8px);
}

.disc-ask input::placeholder {
  color: rgb(115 115 115);
}

.disc-ask input:focus-visible {
  border-color: rgb(23 23 23 / 0.5);
  outline: none;
}

.dark .disc-ask input {
  background: rgb(255 255 255 / 0.06);
}

.dark .disc-ask input::placeholder {
  color: rgb(163 163 163);
}

.dark .disc-ask input:focus-visible {
  border-color: rgb(212 212 212 / 0.5);
}

.disc {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--disc-size, 3rem);
  height: var(--disc-size, 3rem);
  padding: 0;
  border: 0;
  border-radius: 50%;
  overflow: hidden;
  background: none;
  cursor: pointer;
  box-shadow: 0 2px 5px rgb(0 0 0 / 0.22);
  transform-origin: center;
  /* `--disc-fly` holds the flight's own easing: 0ms unless the disc is moving between the
     floor and the row. */
  transition: opacity 260ms ease, filter 260ms ease, box-shadow 200ms ease, transform var(--disc-fly, 0ms);
  will-change: transform;
  -webkit-user-drag: none;
  user-select: none;
}

.disc.is-flying {
  --disc-fly: 520ms cubic-bezier(0.22, 1, 0.36, 1);
}

.disc.is-picked {
  box-shadow: 0 10px 20px rgb(0 0 0 / 0.28);
}

.disc-face {
  position: absolute;
  inset: 0;
  overflow: hidden;
  border-radius: 50%;
  /* The hub is punched through, so whatever lies under the disc shows in the hole.
     The mask sits here, not on .disc: a mask clips to the border box, so hoisting it
     would also erase the disc's shadow and its ring. */
  -webkit-mask-image: radial-gradient(circle at center, transparent 0 10.5%, #000 11.5%);
  mask-image: radial-gradient(circle at center, transparent 0 10.5%, #000 11.5%);
}

.disc img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scale(1.12);
  pointer-events: none;
}

.disc-sheen {
  position: absolute;
  inset: 0;
  background: linear-gradient(118deg, rgb(255 255 255 / 0.26) 0%, rgb(255 255 255 / 0.04) 38%, transparent 55%);
  pointer-events: none;
}

/* Rim around the punch: without it a hole in a white floor reads as a white dot. */
.disc-ring {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, transparent 0 10.8%, rgb(0 0 0 / 0.22) 11.6%, transparent 13.5%);
  pointer-events: none;
}

.disc.is-held {
  z-index: 5;
  box-shadow: 0 12px 22px rgb(0 0 0 / 0.32), 0 0 0 1px rgb(255 255 255 / 0.85);
}

.disc.is-hover {
  z-index: 4;
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.24), 0 0 0 1px rgb(255 255 255 / 0.7);
}

.disc:focus-visible {
  outline: 2px solid rgb(23 23 23 / 0.6);
  outline-offset: 3px;
}

.disc-hud {
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
.dark .disc-stage {
  background:
    radial-gradient(ellipse at 50% 92%, rgb(255 255 255 / 0.07), transparent 68%),
    rgb(9 9 9);
}

.dark .disc-floor {
  background:
    repeating-linear-gradient(0deg, transparent 0 3px, rgb(255 255 255 / 0.025) 3px 4px),
    repeating-linear-gradient(90deg, transparent 0 79px, rgb(255 255 255 / 0.03) 79px 80px),
    repeating-linear-gradient(0deg, transparent 0 79px, rgb(255 255 255 / 0.03) 79px 80px),
    linear-gradient(to bottom, rgb(24 24 24), rgb(17 17 17) 60%, rgb(12 12 12));
  box-shadow: inset 0 12px 18px rgb(0 0 0 / 0.45);
}

.dark .disc-ring {
  background: radial-gradient(circle at center, transparent 0 10.8%, rgb(255 255 255 / 0.16) 11.6%, transparent 13.5%);
}

.dark .disc-hud {
  /* The same faint wash the ask input wears, so both read as raised surfaces in the dark. */
  background: rgb(255 255 255 / 0.06);
  color: rgb(212 212 212);
}

@media (prefers-reduced-motion: reduce) {
  .disc,
  .disc-stage {
    transition: none;
  }
}
</style>
