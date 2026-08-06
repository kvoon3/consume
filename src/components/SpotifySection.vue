<script setup lang="ts" vapor>
import { useLocale } from '../composables/useLocale'
import { useSpotify } from '../composables/useSpotify'

const { data, loading } = useSpotify()
const { t } = useLocale()
</script>

<template>
  <section v-if="!loading && data" class="mt-8">
    <h2 class="mb-3 text-[10px] font-medium tracking-widest text-neutral-400">
      {{ t.listening }} · SPOTIFY
    </h2>

    <div class="grid gap-6 sm:grid-cols-2">
      <div>
        <h3 class="mb-2 text-[10px] tracking-widest text-neutral-400">
          {{ t.topTracks }}
        </h3>
        <a
          v-for="track in data.topTracks.slice(0, 10)"
          :key="track.url"
          :href="track.url"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
        >
          <img :src="track.cover" :alt="track.title" class="size-9 rounded object-cover" loading="lazy">
          <div class="min-w-0">
            <p class="truncate text-sm">{{ track.title }}</p>
            <p class="truncate text-xs text-neutral-400">{{ track.artist }}</p>
          </div>
        </a>
      </div>

      <div>
        <h3 class="mb-2 text-[10px] tracking-widest text-neutral-400">
          {{ t.topArtists }}
        </h3>
        <a
          v-for="artist in data.topArtists.slice(0, 10)"
          :key="artist.url"
          :href="artist.url"
          target="_blank"
          rel="noopener"
          class="flex items-center gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
        >
          <img :src="artist.cover" :alt="artist.title" class="size-9 rounded-full object-cover" loading="lazy">
          <div class="min-w-0">
            <p class="truncate text-sm">{{ artist.title }}</p>
            <p class="truncate text-xs text-neutral-400">{{ artist.tags.slice(0, 2).join(' · ') }}</p>
          </div>
        </a>
      </div>
    </div>
  </section>
</template>
