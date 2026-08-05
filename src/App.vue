<script setup lang="ts" vapor>
import { defineSound } from '@web-kits/audio'
import { Monitor, Moon, Star, Sun } from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import { computed, ref, watch } from 'vue'
import { useSuperHover } from 'super-hover/vue'

import type { AnimeItem, Collections } from './composables/useBangumi'

import { CATEGORY_LABELS, useBangumi } from './composables/useBangumi'
import { useTheme } from './composables/useTheme'

const { collections, error, loading } = useBangumi()
const { cycle, theme } = useTheme()

const hoverSound = defineSound({
  source: { type: 'sine', frequency: { start: 700, end: 500 } },
  envelope: { decay: 0.035 },
  gain: 0.06,
})

const themeIcons = {
  dark: Moon,
  light: Sun,
  system: Monitor,
}

interface Section {
  key: keyof Collections
  label: string
  list: AnimeItem[]
  offset: number
}

const sections = computed<Section[]>(() => {
  const c = collections.value
  if (!c)
    return []
  let offset = 0
  return (Object.keys(CATEGORY_LABELS) as (keyof Collections)[])
    .map(key => ({ key, label: CATEGORY_LABELS[key], list: c[key] }))
    .filter(s => s.list.length > 0)
    .map((s) => {
      const withOffset = { ...s, offset }
      offset += s.list.length
      return withOffset
    })
})

// flat index across sections for hover lookup
const items = computed(() => sections.value.flatMap(s => s.list))
const active = ref<AnimeItem>()

watch(items, (list) => {
  active.value ??= list[0]
  // preload the first covers so the detail pane pops instantly
  for (const a of list.slice(0, 30))
    void (new Image().src = a.cover)
})

const trail = ref<{ h: number, section: keyof Collections, y: number }>()

// rAF lerp toward target row: fast sweeps trail, stops snap tight — no fixed-duration CSS transition
let targetY = 0
let rafId = 0
let leaveTimer = 0
function startLerp() {
  if (rafId)
    return
  const tick = () => {
    const t = trail.value
    if (!t) {
      rafId = 0
      return
    }
    const next = t.y + (targetY - t.y) * 0.75
    t.y = Math.abs(targetY - next) < 0.5 ? targetY : next
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

const rootRef = useSuperHover({
  onEnter(event) {
    clearTimeout(leaveTimer)
    const el = event.detail.current as HTMLElement | null
    if (!el)
      return
    const idx = Number(el.dataset.index)
    hoverSound()
    active.value = items.value[idx]
    const section = sections.value.find(s => idx >= s.offset && idx < s.offset + s.list.length)
    if (!section)
      return
    targetY = el.offsetTop
    if (trail.value?.section === section.key) {
      startLerp()
    } else {
      // jumped lists: snap instantly, no cross-list ghost
      trail.value = { h: el.offsetHeight, section: section.key, y: targetY }
    }
  },
  onLeave() {
    // rows have 2px gaps — pointer crosses them between hits; keep the trail alive briefly
    leaveTimer = setTimeout(() => trail.value = undefined, 200)
  },
})

function sublabel(a: AnimeItem) {
  const progress = a.total ? `${a.progress}/${a.total}` : `${a.progress} eps`
  return a.date ? `${a.date.slice(0, 4)} · ${progress}` : progress
}
</script>

<template>
  <div class="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
    <main class="mx-auto max-w-3xl px-6 py-20 sm:py-28">
      <header class="mb-10 flex items-center justify-between">
        <div class="flex items-center gap-3">
          <img
            src="https://kvoon.me/.netlify/images?q=70&url=%2Favatar_cropped.jpg"
            alt="Kevin Kwong"
            class="size-10 rounded-full ring-1 ring-black/10 dark:ring-white/10"
          >
          <h1 class="text-xl font-medium tracking-tight">
            Kevin Kwong is watching…
          </h1>
        </div>
        <button
          class="p-1 text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          :title="`Theme: ${theme}`"
          @click="cycle"
        >
          <MorphIcon :icon="themeIcons[theme]" :size="18" />
        </button>
      </header>

      <p v-if="loading" class="text-sm text-neutral-400">
        Loading…
      </p>
      <p v-else-if="error" class="text-sm text-red-500">
        {{ error }}
      </p>

      <div v-else ref="rootRef" class="flex items-start gap-6">
        <div class="w-44 shrink-0 space-y-6 sm:w-56">
          <section
            v-for="s in sections"
            :key="s.key"
            class="overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
          >
            <h3 class="border-b border-neutral-200 bg-neutral-50 px-3 py-2 text-[11px] font-medium tracking-widest text-neutral-400 dark:border-neutral-800 dark:bg-neutral-900">
              {{ s.label }} {{ s.list.length }}
            </h3>
            <div class="relative flex max-h-72 flex-col gap-0.5 overflow-y-auto overscroll-contain p-1.5">
              <div
                v-if="trail?.section === s.key"
                class="pointer-events-none absolute right-1.5 left-1.5 rounded-md bg-neutral-100 dark:bg-neutral-900"
                :style="{ transform: `translateY(${trail.y}px)`, height: `${trail.h}px` }"
              />
              <a
                v-for="(a, i) in s.list"
                :key="a.id"
                :href="a.url"
                target="_blank"
                rel="noopener"
                data-super-hover
                :data-index="s.offset + i"
                class="relative rounded-md px-2 py-1.5 outline-none"
              >
                <div class="flex items-baseline justify-between gap-2">
                  <span class="truncate text-sm">{{ a.title }}</span>
                  <span v-if="a.score" class="shrink-0 text-[11px] text-amber-500 tabular-nums">
                    ★{{ a.score }}
                  </span>
                </div>
                <div class="truncate text-[11px] text-neutral-400 tabular-nums">
                  {{ sublabel(a) }}
                </div>
              </a>
            </div>
          </section>
        </div>

        <div class="sticky top-24 min-w-0 flex-1 rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div v-if="active" class="flex max-h-[70vh] flex-col overflow-hidden">
            <div class="flex items-start justify-between gap-3 border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
              <h2 class="min-w-0 truncate text-lg leading-tight font-medium">
                {{ active.title }}
              </h2>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                {{ active.total ? `${active.progress} / ${active.total}` : `${active.progress} eps` }}
              </span>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <img
                :src="active.cover"
                :alt="active.title"
                class="mb-4 w-32 rounded-lg shadow-md ring-1 ring-black/10 sm:w-36 dark:ring-white/10"
              >
              <dl class="mb-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
                <dt class="text-neutral-400">
                  score
                </dt>
                <dd class="tabular-nums">
                  <span v-if="active.score" class="text-amber-500">★ {{ active.score }}</span>
                  <span class="text-neutral-400"> · bgm {{ active.siteScore || '—' }}</span>
                </dd>
                <dt class="text-neutral-400">
                  aired
                </dt>
                <dd class="tabular-nums">
                  {{ active.date || '—' }}
                </dd>
                <template v-if="active.tags.length">
                  <dt class="text-neutral-400">
                    tags
                  </dt>
                  <dd class="text-neutral-500 dark:text-neutral-400">
                    {{ active.tags.join(' · ') }}
                  </dd>
                </template>
              </dl>
              <p class="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {{ active.summary }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer class="mt-16 flex items-center gap-4 text-xs text-neutral-400">
        <a href="https://bgm.tv/user/1140496" target="_blank" rel="noopener" class="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300">bgm.tv</a>
        <a href="https://github.com/kvoon3/watch" target="_blank" rel="noopener" aria-label="GitHub" class="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300">
          <svg viewBox="0 0 24 24" class="size-4 fill-current" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>
        </a>
      </footer>
    </main>
  </div>
</template>
