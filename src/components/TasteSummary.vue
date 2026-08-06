<script setup lang="ts">
import { computed, shallowRef } from 'vue'

import type { MediaItem } from '../composables/useBangumi'
import type { SpotifyTrack } from '../composables/useSpotify'

import { useLocale } from '../composables/useLocale'
import { useSpotify } from '../composables/useSpotify'

const props = defineProps<{
  items: MediaItem[]
  spotifyVisible?: boolean
}>()

const { t } = useLocale()
const { data: spotify } = useSpotify()
const selectedTrack = shallowRef<SpotifyTrack>()
const embedUrl = computed(() => selectedTrack.value?.url.replace('open.spotify.com/', 'open.spotify.com/embed/'))

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
  <details class="group mb-5 rounded-xl border border-neutral-200 dark:border-neutral-800">
    <summary class="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium tracking-widest text-neutral-500 dark:text-neutral-400">
      <span>{{ t.taste }} · {{ items.length }} {{ t.titles }}</span>
      <span class="text-neutral-300 transition-transform group-open:rotate-45 dark:text-neutral-600">＋</span>
    </summary>

    <div class="grid gap-6 border-t border-neutral-200 px-3 py-4 sm:grid-cols-2 dark:border-neutral-800">
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

    <section v-if="spotifyVisible && spotify?.topTracks.length" class="border-t border-neutral-200 px-3 py-4 dark:border-neutral-800">
      <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
        {{ t.topTracks }} · SPOTIFY
      </h2>
      <iframe
        v-if="embedUrl"
        :src="embedUrl"
        :title="`Spotify: ${selectedTrack!.title}`"
        class="mb-3 h-20 w-full rounded-xl border-0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
      <div>
        <button
          v-for="(track, index) in spotify.topTracks.slice(0, 10)"
          :key="track.uri"
          type="button"
          class="taste-row flex w-full items-center gap-3 rounded px-1 py-1 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
          :style="{ '--delay': `${index * 30}ms` }"
          @click="selectedTrack = track"
        >
          <img :src="track.cover" :alt="track.title" class="size-7 rounded object-cover" loading="lazy">
          <span class="min-w-0 flex-1 truncate text-xs">{{ track.title }}</span>
          <span class="truncate text-xs text-neutral-400">{{ track.artist }}</span>
        </button>
      </div>
    </section>

    <section v-if="spotifyVisible && spotify?.topArtists.length" class="border-t border-neutral-200 px-3 py-4 dark:border-neutral-800">
      <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
        {{ t.topArtists }} · SPOTIFY
      </h2>
      <div class="grid gap-1 sm:grid-cols-2">
        <a
          v-for="(artist, index) in spotify.topArtists.slice(0, 10)"
          :key="artist.url"
          :href="artist.url"
          target="_blank"
          rel="noopener"
          class="taste-row flex items-center gap-3 rounded px-1 py-1 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
          :style="{ '--delay': `${index * 30}ms` }"
        >
          <img :src="artist.cover" :alt="artist.title" class="size-7 rounded-full object-cover" loading="lazy">
          <span class="min-w-0 flex-1 truncate text-xs">{{ artist.title }}</span>
          <span class="truncate text-xs text-neutral-400">{{ (artist.tags ?? []).slice(0, 2).join(' · ') }}</span>
        </a>
      </div>
    </section>
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
