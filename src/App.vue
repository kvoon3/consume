<script setup lang="ts" vapor>
import { defineSound } from '@web-kits/audio'
import { Monitor, Moon, Sun } from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import { computed, shallowRef, watch } from 'vue'
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

const items = computed(() => sections.value.flatMap(s => s.list))
const active = shallowRef<AnimeItem>()
const previewY = shallowRef(8)

watch(items, (list) => {
  for (const item of list.slice(0, 30))
    void (new Image().src = item.cover)
})

function movePreview(y: number) {
  const root = rootRef.value
  if (!root)
    return
  const rect = root.getBoundingClientRect()
  previewY.value = root.scrollTop + Math.max(8, Math.min(y - rect.top + 12, rect.height - 144))
}

const rootRef = useSuperHover({
  onEnter(event) {
    const el = event.detail.current as HTMLElement | null
    if (!el)
      return
    active.value = items.value[Number(el.dataset.index)]
    movePreview(event.detail.y)
    hoverSound()
  },
  onLeave() {
    active.value = undefined
  },
  onMove(event) {
    movePreview(event.detail.y)
  },
})

function sublabel(a: AnimeItem) {
  return a.date ? a.date.slice(0, 4) : '—'
}
</script>

<template>
  <div class="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
    <main class="mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <header class="mb-8 flex items-center justify-between">
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

      <div v-else>
        <nav class="mb-3 flex flex-wrap gap-1" aria-label="Collection categories">
          <a
            v-for="s in sections"
            :key="s.key"
            :href="`#collection-${s.key}`"
            class="rounded-full px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
          >
            {{ s.label }} <span class="text-neutral-400 tabular-nums">{{ s.list.length }}</span>
          </a>
        </nav>

        <div
          ref="rootRef"
          class="relative h-[min(60vh,32rem)] min-h-80 overflow-y-auto overscroll-contain rounded-xl border border-neutral-200 dark:border-neutral-800"
        >
          <div class="list-grid sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-3 py-1.5 text-[10px] tracking-widest text-neutral-400 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
            <span>title</span>
            <span class="preview-column" />
            <span class="detail-column">aired</span>
            <span class="detail-column">progress</span>
            <span class="text-right">rating</span>
          </div>

          <section v-for="s in sections" :key="s.key">
            <h2
              :id="`collection-${s.key}`"
              class="sticky top-[27px] z-10 border-b border-neutral-200 bg-neutral-50/95 px-3 py-1 text-[10px] font-medium tracking-widest text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-400"
            >
              {{ s.label }} · {{ s.list.length }}
            </h2>
            <a
              v-for="(a, i) in s.list"
              :key="a.id"
              :href="a.url"
              target="_blank"
              rel="noopener"
              data-super-hover
              :data-index="s.offset + i"
              class="list-grid border-b border-neutral-100 px-3 py-1 text-xs outline-none transition-colors last:border-b-0 hover:bg-neutral-50 focus-visible:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/60 dark:focus-visible:bg-neutral-900/60"
            >
              <span class="truncate text-sm">{{ a.title }}</span>
              <span class="preview-column" />
              <span class="detail-column text-neutral-400 tabular-nums">{{ sublabel(a) }}</span>
              <span class="detail-column text-neutral-400 tabular-nums">{{ a.total ? `${a.progress}/${a.total}` : `${a.progress} eps` }}</span>
              <span class="text-right text-amber-500 tabular-nums">{{ a.score || '—' }}</span>
            </a>
          </section>

          <div class="anchor-space" aria-hidden="true" />

          <img
            v-if="active"
            :src="active.cover"
            :alt="active.title"
            class="preview-card pointer-events-none absolute z-30 hidden h-28 w-20 rounded object-cover shadow-xl ring-1 ring-black/10 sm:block dark:ring-white/10"
            :style="{ transform: `translateY(${previewY}px)` }"
          >
        </div>
      </div>

      <footer class="mt-8 flex items-center gap-4 text-xs text-neutral-400">
        <a href="https://bgm.tv/user/1140496" target="_blank" rel="noopener" class="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300">bgm.tv</a>
        <a href="https://github.com/kvoon3/watch" target="_blank" rel="noopener" aria-label="GitHub" class="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300">
          <svg viewBox="0 0 24 24" class="size-4 fill-current" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
        </a>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.list-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 13rem 4rem 4.5rem 3rem;
  align-items: center;
  gap: 0.5rem;
}

.preview-card {
  top: 0;
  right: 17.75rem;
}

.anchor-space {
  height: calc(100% - 4rem);
}

@media (max-width: 639px) {
  .list-grid {
    grid-template-columns: minmax(0, 1fr) 3rem;
  }

  .preview-column,
  .detail-column {
    display: none;
  }
}
</style>
