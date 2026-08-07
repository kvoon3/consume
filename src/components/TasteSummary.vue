<script setup lang="ts">
import { defineSound } from '@web-kits/audio'
import { Bar, BarChart, Grid, Legend, Pie, PieChart, Tooltip, XAxis, YAxis, type ChartConfig } from 'dither-ui'
import { computed } from 'vue'

import type { Collections, MediaItem, SubjectType } from '../composables/useBangumi'

import SpotifySummary from './SpotifySummary.vue'
import DitherBarList from './DitherBarList.vue'
import { CATEGORY_KEYS } from '../composables/useBangumi'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  items: MediaItem[]
  loading: boolean
  spotifyVisible?: boolean
  collections?: Collections
  subject?: SubjectType
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

const decadeConfig = computed<ChartConfig>(() => ({
  count: { label: t.value.titles, color: 'blue' },
}))
const tagRows = computed(() => tags.value.map(item => ({
  label: item.label,
  value: item.count,
  hint: item.rating,
})))

const categoryPalette = ['blue', 'purple', 'green', 'orange', 'red'] as const
const categoryData = computed(() => {
  if (!props.collections || props.subject === undefined)
    return []
  return CATEGORY_KEYS
    .map((key, i) => ({
      name: key,
      value: props.collections![key].filter(item => item.subjectType === props.subject).length,
      color: categoryPalette[i],
    }))
    .filter(row => row.value > 0)
})
const categoryConfig = computed<ChartConfig>(() => {
  const labels = t.value.subjectLabels as Partial<Record<SubjectType, Partial<Record<keyof Collections, string>>>>
  return Object.fromEntries(categoryData.value.map(row => [
    row.name,
    { label: (props.subject !== undefined && labels[props.subject]?.[row.name as keyof Collections]) || t.value[row.name as keyof Collections] || row.name, color: row.color },
  ]))
})

const scores = computed(() => {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ count: 0, label: String(i + 1) }))
  for (const item of props.items) {
    const score = Math.round(item.score)
    if (score >= 1 && score <= 10)
      buckets[score - 1].count++
  }
  return buckets
})
const scoreConfig = computed<ChartConfig>(() => ({
  count: { label: t.value.titles, color: 'red' },
}))
</script>

<template>
  <details open :aria-busy="loading" class="group mb-5 rounded-xl border border-neutral-200 dark:border-neutral-800">
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

    <div v-else class="taste-charts grid gap-6 border-t border-neutral-200 px-3 py-4 sm:grid-cols-2 dark:border-neutral-800">
      <section>
        <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
          {{ t.era }}
        </h2>
        <div class="h-48">
          <BarChart :data="decades" :config="decadeConfig" :margins="{ top: 8 }">
            <Grid />
            <XAxis data-key="label" />
            <YAxis />
            <Bar data-key="count" is-clickable />
            <Tooltip label-key="label" />
          </BarChart>
        </div>
      </section>

      <section>
        <DitherBarList :rows="tagRows" :hint-label="t.avg" color="green">
          {{ t.topTags }}
        </DitherBarList>
      </section>

      <section>
        <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
          {{ t.scoreDist }}
        </h2>
        <div class="h-48">
          <BarChart :data="scores" :config="scoreConfig" :margins="{ top: 8 }">
            <Grid />
            <XAxis data-key="label" />
            <YAxis />
            <Bar data-key="count" is-clickable />
            <Tooltip label-key="label" />
          </BarChart>
        </div>
      </section>

      <section v-if="categoryData.length">
        <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
          {{ t.categories }}
        </h2>
        <div class="h-48">
          <PieChart :data="categoryData" :config="categoryConfig" data-key="value" name-key="name" :inner-radius="0.55">
            <Pie is-clickable />
            <Legend align="center" is-clickable />
            <Tooltip />
          </PieChart>
        </div>
      </section>
    </div>

    <SpotifySummary :visible="Boolean(spotifyVisible)" />
  </details>
</template>

<style scoped>
/* lighten the kit's dotted grid on our near-white background;
   dark mode keeps the token (near-black dots blend into the dark bg) */
.taste-charts :deep(.stroke-border) {
  stroke: var(--color-neutral-100, #f5f5f5);
}

.dark .taste-charts :deep(.stroke-border) {
  stroke: rgb(var(--border));
}
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

@media (prefers-reduced-motion: reduce) {
  details::details-content {
    transition: opacity 160ms ease;
  }
}
</style>
