<script setup lang="ts" vapor>
import { defineSound } from '@web-kits/audio'
import Matter from 'matter-js'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import type { MediaItem } from '../composables/useBangumi'

const props = defineProps<{
  items: MediaItem[]
}>()

const hoverSound = defineSound({
  source: { type: 'triangle', frequency: { start: 880, end: 640 } },
  envelope: { decay: 0.03 },
  gain: 0.05,
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

const hovered = shallowRef<MediaItem>()
const hoverId = ref<string>()
// Nothing on the floor moves until it is grabbed: hovering only lights a disc up and labels it.
const heldId = ref<string>()

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

// Screen point -> a point on the floor. Solving the perspective projection of the tilted
// plane is a closed form, which keeps hover and drag exact instead of hand-waved.
function toPlane(clientX: number, clientY: number) {
  const rect = stage.value!.getBoundingClientRect()
  const dy = clientY - rect.top - height / 2
  const cos = Math.cos(tilt)
  const sin = Math.sin(tilt)
  // Depth from the plane's near edge to the point under the cursor.
  const depth = Math.max(0, Math.min(planeHeight, PERSPECTIVE * (height / 2 - dy) / (PERSPECTIVE * cos + dy * sin)))
  const scale = PERSPECTIVE / (PERSPECTIVE + depth * sin)
  return { x: width / 2 + (clientX - rect.left - width / 2) / scale, y: planeHeight - depth }
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
}

// Transforms go straight to the DOM, so Vue re-renders never fight the physics.
function sync() {
  if (hovered.value && hud.value) {
    const disc = discs.find(entry => entry.id === hoverId.value)
    if (disc) {
      const sin = Math.sin(tilt)
      const cos = Math.cos(tilt)
      const depth = planeHeight - disc.body.position.y
      const scale = PERSPECTIVE / (PERSPECTIVE + depth * sin)
      const px = width / 2 + (disc.body.position.x - width / 2) * scale
      const py = height / 2 + (height / 2 - depth * cos) * scale
      const x = Math.max(8, Math.min(width - 168, px - 10))
      const y = Math.max(4, Math.min(height - 24, py - radius * scale - 34))
      hud.value.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
    }
  }

  for (const disc of discs) {
    const { x, y } = disc.body.position
    // Hovering never moves a disc, it only lights up; a grabbed one lifts a hair off the floor.
    const feedback = heldId.value === disc.id
      ? ' translateZ(7px) scale(1.1)'
      : hoverId.value === disc.id ? ' scale(1.06)' : ''
    disc.el.style.transform = `translate3d(${(x - radius).toFixed(2)}px, ${(y - radius).toFixed(2)}px, 2px) rotate(${disc.spin.toFixed(2)}deg)${feedback}`
  }
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
  wake()
}

function under(point: { x: number, y: number }) {
  let best: Disc | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const disc of discs) {
    const { x, y } = disc.body.position
    const distance = Math.hypot(x - point.x, y - point.y)
    if (distance < radius * 1.3 && distance < bestDistance) {
      best = disc
      bestDistance = distance
    }
  }
  return best
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
  engage(under(point))
}

function onPointerDown(event: PointerEvent) {
  if (!canDrag || event.button !== 0)
    return
  const point = toPlane(event.clientX, event.clientY)
  pointerStart = point
  dragged = false
  const disc = under(point)
  if (!disc)
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

function onClick(event: MouseEvent) {
  if (!dragged)
    return
  event.preventDefault()
  dragged = false
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
  >
    <div class="disc-world">
      <div class="disc-floor" aria-hidden="true" />
      <a
        v-for="item in items"
        :key="item.id"
        :href="item.url"
        target="_blank"
        rel="noopener"
        data-disc
        class="disc"
        :class="{ 'is-held': heldId === String(item.id), 'is-hover': hoverId === String(item.id) }"
        :aria-label="title(item)"
        @click="onClick"
      >
        <span class="disc-face">
          <img :src="item.cover" alt="" draggable="false" loading="lazy" decoding="async">
          <span class="disc-sheen" aria-hidden="true" />
          <span class="disc-ring" aria-hidden="true" />
        </span>
      </a>
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

.disc {
  position: absolute;
  top: 0;
  left: 0;
  width: var(--disc-size, 3rem);
  height: var(--disc-size, 3rem);
  overflow: hidden;
  border-radius: 50%;
  box-shadow: 0 2px 5px rgb(0 0 0 / 0.22);
  transform-origin: center;
  transition: opacity 260ms ease, filter 260ms ease, box-shadow 200ms ease;
  will-change: transform;
  -webkit-user-drag: none;
  user-select: none;
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
  top: 0.5rem;
  left: 0.75rem;
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
  background: rgb(var(--background) / 0.88);
  color: rgb(212 212 212);
}

@media (prefers-reduced-motion: reduce) {
  .disc,
  .disc-stage {
    transition: none;
  }
}
</style>
