<script setup lang="ts">
import { defineSound } from '@web-kits/audio'
import { computed } from 'vue'

import type { MediaItem } from '../composables/useBangumi'

import SpotifySummary from './SpotifySummary.vue'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  items: MediaItem[]
  loading: boolean
  spotifyVisible?: boolean
}>()

const { t } = useLocale()
const clickSound = defineSound({
  source: { type: 'triangle', frequency: { start: 560, end: 360 } },
  envelope: { decay: 0.045 },
  gain: 0.08,
})

const ignoredTags = new Set(['Anime', 'TV', '动画', '日本', '神作'])
const tagAliases: Record<string, string> = { 漫改: '漫画改' }

const decades = computed(() => {
  const counts = new Map<number, number>()
  for (const item of props.items) {
    const year = Number(item.date.slice(0, 4))
    if (year)
      counts.set(Math.floor(year / 10) * 10, (counts.get(Math.floor(year / 10) * 10) ?? 0) + 1)
  }
  return [...counts].sort(([a], [b]) => a - b).map(([decade, count]) => ({ count, label: `${decade}s` }))
})

const tags = computed(() => {
  const stats = new Map<string, { count: number, rating: number, rated: number }>()
  for (const item of props.items) {
    const itemTags = new Set(item.tags.map(tag => tagAliases[tag] ?? tag))
    for (const tag of itemTags) {
      if (/^\d{4}$/.test(tag) || ignoredTags.has(tag))
        continue
      const stat = stats.get(tag) ?? { count: 0, rated: 0, rating: 0 }
      stat.count++
      if (item.score) {
        stat.rated++
        stat.rating += item.score
      }
      stats.set(tag, stat)
    }
  }
  return [...stats]
    .map(([label, stat]) => ({
      count: stat.count,
      label,
      rating: stat.rated ? stat.rating / stat.rated : 0,
    }))
    .sort((a, b) => b.count - a.count || b.rating - a.rating)
    .slice(0, 10)
})

const maxDecade = computed(() => Math.max(...decades.value.map(item => item.count), 1))
const maxTag = computed(() => Math.max(...tags.value.map(item => item.count), 1))
</script>

<template>
  <details :open="loading" :aria-busy="loading" class="group mb-5 rounded-xl border border-neutral-200 dark:border-neutral-800">
    <summary class="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400" @click="clickSound()">
      <span class="flex items-center gap-2">
        {{ t.taste }}
        <span v-if="loading" class="h-2.5 w-16 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" />
        <template v-else>· {{ items.length }} {{ t.titles }}</template>
      </span>
      <span class="text-neutral-300 transition-transform group-open:rotate-45 dark:text-neutral-600">＋</span>
    </summary>

    <div v-if="loading" role="status" class="grid gap-6 border-t border-neutral-200 px-3 py-4 sm:grid-cols-2 dark:border-neutral-800">
      <section v-for="column in 2" :key="column">
        <div class="mb-3 h-2.5 w-20 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" />
        <div class="space-y-2">
          <div v-for="row in 6" :key="row" class="grid grid-cols-[3rem_1fr_2rem] items-center gap-2">
            <span class="h-2.5 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900" />
            <span class="h-2 animate-pulse rounded-full bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" :class="row % 3 === 0 ? 'w-2/3' : 'w-full'" />
            <span class="h-2.5 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900" />
          </div>
        </div>
      </section>
      <span class="sr-only">Loading taste profile…</span>
    </div>

    <div v-else class="grid gap-6 border-t border-neutral-200 px-3 py-4 sm:grid-cols-2 dark:border-neutral-800">
      <section>
        <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
          {{ t.era }}
        </h2>
        <div class="space-y-2">
          <div
            v-for="(item, index) in decades"
            :key="item.label"
            class="taste-row grid grid-cols-[3rem_1fr_2rem] items-center gap-2 text-xs"
            :style="{ '--delay': `${index * 30}ms` }"
          >
            <span class="text-neutral-500 tabular-nums dark:text-neutral-400">{{ item.label }}</span>
            <span class="h-2 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-900">
              <span class="taste-bar block h-full origin-left rounded-full bg-neutral-800 dark:bg-neutral-200" :style="{ width: `${item.count / maxDecade * 100}%` }" />
            </span>
            <span class="text-right text-neutral-400 tabular-nums">{{ item.count }}</span>
          </div>
        </div>
      </section>

      <section>
        <h2 class="mb-3 grid grid-cols-[1fr_2rem_2.5rem] gap-2 text-[10px] tracking-widest text-neutral-400">
          <span>{{ t.topTags }}</span><span class="text-right">N</span><span class="text-right">{{ t.avg }}</span>
        </h2>
        <div class="space-y-1.5">
          <div
            v-for="(item, index) in tags"
            :key="item.label"
            class="taste-row relative grid grid-cols-[1fr_2rem_2.5rem] gap-2 overflow-hidden rounded px-1 py-0.5 text-xs"
            :style="{ '--delay': `${index * 30}ms` }"
          >
            <span class="taste-bar absolute inset-y-0 left-0 origin-left bg-neutral-100 dark:bg-neutral-900" :style="{ width: `${item.count / maxTag * 100}%` }" />
            <span class="relative truncate">{{ item.label }}</span>
            <span class="relative text-right text-neutral-400 tabular-nums">{{ item.count }}</span>
            <span class="relative text-right text-amber-500 tabular-nums">{{ item.rating ? item.rating.toFixed(1) : '—' }}</span>
          </div>
        </div>
      </section>
    </div>

    <SpotifySummary :visible="Boolean(spotifyVisible)" />
  </details>
</template>

<style scoped>
details {
  interpolate-size: allow-keywords;
}

details::details-content {
  block-size: 0;
  overflow: hidden;
  opacity: 0;
  transition:
    block-size 200ms cubic-bezier(0.23, 1, 0.32, 1),
    content-visibility 200ms allow-discrete,
    opacity 160ms cubic-bezier(0.23, 1, 0.32, 1);
}

details[open]::details-content {
  block-size: auto;
  opacity: 1;
}

details[open] .taste-row {
  animation: taste-row-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
  animation-delay: var(--delay);
}

details[open] .taste-bar {
  animation: taste-bar-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
  animation-delay: var(--delay);
}

@keyframes taste-row-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

@keyframes taste-bar-in {
  from {
    opacity: 0.4;
    transform: scaleX(0.75);
  }
}

@media (prefers-reduced-motion: reduce) {
  details::details-content {
    transition: opacity 160ms ease;
  }

  details[open] .taste-row,
  details[open] .taste-bar {
    animation: taste-fade-in 160ms ease both;
  }
}

@keyframes taste-fade-in {
  from {
    opacity: 0;
  }
}
</style>
