<script setup lang="ts">
import { defineSound } from '@web-kits/audio'
import { computed, shallowRef, watch } from 'vue'

import type { SpotifyTrack } from '../composables/useSpotify'

import { useLocale } from '../composables/useLocale'
import { useSpotify } from '../composables/useSpotify'

const props = defineProps<{
  visible: boolean
}>()

const { t } = useLocale()
const enabled = computed(() => props.visible)
const { data: spotify, loading } = useSpotify(enabled)
const selectedTrack = shallowRef<SpotifyTrack>()
const playerCollapsed = shallowRef(true)
const playerLoading = shallowRef(false)
const playerKey = shallowRef(0)
const clickSound = defineSound({
  source: { type: 'triangle', frequency: { start: 560, end: 360 } },
  envelope: { decay: 0.045 },
  gain: 0.08,
})
const embedUrl = computed(() => selectedTrack.value?.url.replace('open.spotify.com/', 'open.spotify.com/embed/'))

watch(spotify, (data) => {
  if (!selectedTrack.value && data?.topTracks[0])
    selectTrack(data.topTracks[0])
}, { immediate: true })

function selectTrack(track: SpotifyTrack) {
  playerCollapsed.value = true
  playerLoading.value = true
  playerKey.value++
  selectedTrack.value = track
}

function playerLoaded() {
  playerLoading.value = false
  playerCollapsed.value = false
}
</script>

<template>
  <template v-if="visible">
    <section v-if="loading" role="status" class="border-t border-neutral-200 px-3 py-4 dark:border-neutral-800">
      <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
        {{ t.topTracks }} · SPOTIFY
      </h2>
      <div class="space-y-2">
        <div v-for="row in 6" :key="row" class="flex items-center gap-3 px-1 py-1">
          <span class="size-7 shrink-0 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" />
          <span class="h-3 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" :class="row % 2 ? 'w-2/5' : 'w-1/3'" />
          <span class="ml-auto h-3 w-1/4 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900" />
        </div>
      </div>
      <span class="sr-only">Loading top Spotify tracks…</span>
    </section>

    <section v-else-if="spotify?.topTracks.length" class="border-t border-neutral-200 px-3 py-4 dark:border-neutral-800">
      <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
        {{ t.topTracks }} · SPOTIFY
      </h2>
      <div>
        <button
          v-for="(track, index) in spotify.topTracks.slice(0, 10)"
          :key="track.uri"
          type="button"
          class="taste-row flex w-full items-center gap-3 rounded px-1 py-1 text-left transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-900/60"
          :style="{ '--delay': `${index * 30}ms` }"
          @click="clickSound(); selectTrack(track)"
        >
          <img :src="track.cover" :alt="track.title" class="size-7 rounded object-cover" loading="lazy">
          <span class="min-w-0 flex-1 truncate text-xs">{{ track.title }}</span>
          <span class="truncate text-xs text-neutral-400">{{ track.artist }}</span>
        </button>
      </div>
    </section>

    <section v-if="loading" role="status" class="border-t border-neutral-200 px-3 py-4 dark:border-neutral-800">
      <h2 class="mb-3 text-[10px] tracking-widest text-neutral-400">
        {{ t.topArtists }} · SPOTIFY
      </h2>
      <div class="grid gap-2 sm:grid-cols-2">
        <div v-for="row in 6" :key="row" class="flex items-center gap-3 px-1 py-1">
          <span class="size-7 shrink-0 animate-pulse rounded-full bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" />
          <span class="h-3 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" :class="row % 2 ? 'w-1/2' : 'w-2/5'" />
        </div>
      </div>
      <span class="sr-only">Loading top Spotify artists…</span>
    </section>

    <section v-else-if="spotify?.topArtists.length" class="border-t border-neutral-200 px-3 py-4 dark:border-neutral-800">
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
  </template>

  <Teleport to="body">
    <Transition name="player-pop">
      <div
        v-if="embedUrl"
        class="spotify-player fixed bottom-2 right-2 z-50 w-[min(calc(100vw-3rem),22rem)] sm:right-4"
        :class="{ 'is-collapsed': playerCollapsed }"
      >
        <button
          type="button"
          class="player-collapse absolute -left-4 top-4 z-10 flex h-12 w-4 items-center justify-center rounded-l-lg border border-r-0 border-neutral-200 bg-white/90 text-sm text-neutral-500 shadow-md backdrop-blur transition-colors hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900/90 dark:text-neutral-400 dark:hover:text-white"
          :aria-label="playerLoading ? 'Spotify player loading' : playerCollapsed ? 'Expand Spotify player' : 'Collapse Spotify player'"
          :aria-expanded="!playerCollapsed"
          :disabled="playerLoading"
          @click="clickSound(); playerCollapsed = !playerCollapsed"
        >
          {{ playerCollapsed ? '‹' : '›' }}
        </button>
        <button
          type="button"
          class="absolute -right-2 -top-2 z-10 flex size-6 items-center justify-center rounded-full border border-neutral-200 bg-white text-sm text-neutral-500 shadow-md transition-colors hover:text-neutral-900 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:text-white"
          aria-label="Close Spotify player"
          @click="clickSound(); selectedTrack = undefined"
        >
          ×
        </button>
        <iframe
          :key="playerKey"
          :src="embedUrl"
          :title="`Spotify: ${selectedTrack!.title}`"
          class="h-20 w-full rounded-xl border-0 shadow-xl shadow-neutral-900/15 dark:shadow-black/50"
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          @load="playerLoaded"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.spotify-player {
  bottom: max(0.5rem, env(safe-area-inset-bottom));
  transition: transform 240ms cubic-bezier(0.77, 0, 0.175, 1);
  will-change: transform;
}

.spotify-player.is-collapsed {
  transform: translateX(calc(100% + 0.5rem));
}

.player-collapse::before {
  position: absolute;
  inset: -0.5rem -0.75rem;
  content: '';
}

:global(details[open]) .taste-row {
  animation: taste-row-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
  animation-delay: var(--delay);
}

.player-pop-enter-active,
.player-pop-leave-active {
  transition: opacity 180ms cubic-bezier(0.23, 1, 0.32, 1), transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
}

.player-pop-enter-from,
.player-pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

@keyframes taste-row-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}

@media (min-width: 640px) {
  .spotify-player {
    bottom: max(1rem, env(safe-area-inset-bottom));
  }

  .spotify-player.is-collapsed {
    transform: translateX(calc(100% + 1rem));
  }
}

@media (prefers-reduced-motion: reduce) {
  :global(details[open]) .taste-row {
    animation: taste-fade-in 160ms ease both;
  }

  .player-pop-enter-active,
  .player-pop-leave-active {
    transition: opacity 160ms cubic-bezier(0.23, 1, 0.32, 1);
  }

  .player-pop-enter-from,
  .player-pop-leave-to {
    transform: none;
  }

  .spotify-player {
    transition: none;
  }
}

@keyframes taste-fade-in {
  from {
    opacity: 0;
  }
}
</style>
