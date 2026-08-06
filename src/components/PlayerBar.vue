<script setup lang="ts" vapor>
import { ChevronsDownUp, ChevronsUpDown, ListMusic, Pause, Play, SkipBack, SkipForward } from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import { computed, shallowRef } from 'vue'
import { nextTrack, playerDuration, playerMinimized, playerPaused, playerPosition, playerQueue, playerTrack, playerVolume, playQueue, previousTrack, setVolume, togglePlayer } from '../composables/useSpotifyPlayer'
import { useTheme } from '../composables/useTheme'

const { isDark } = useTheme()

const queueOpen = shallowRef(false)

const progress = computed(() => playerDuration.value ? (playerPosition.value / playerDuration.value) * 100 : 0)

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}
</script>

<template>
  <Transition name="player-pop" mode="out-in">
    <div v-if="playerTrack" :key="String(playerMinimized)" class="fixed z-50" :class="playerMinimized ? 'bottom-4 right-4' : 'inset-x-0 bottom-0'">
      <!-- minimized pill -->
      <div
        v-if="playerMinimized"
        class="player-card flex items-center gap-2 rounded-full border border-neutral-200/80 bg-white/80 py-1.5 pl-1.5 pr-2 shadow-lg shadow-neutral-900/5 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/80 dark:shadow-black/40"
      >
        <button class="relative shrink-0 transition-transform duration-100 active:scale-90" :aria-label="playerPaused ? 'Play' : 'Pause'" @click="togglePlayer">
          <span
            class="absolute inset-0 rounded-full"
            :style="{ background: `conic-gradient(currentColor ${progress}%, transparent 0)`, opacity: 0.25 }"
          />
          <img
            :src="playerTrack.cover"
            :alt="playerTrack.title"
            class="relative m-[3px] size-7 rounded-full object-cover"
            :class="{ 'player-spin': !playerPaused }"
          >
        </button>
        <div class="mr-1 max-w-32 leading-tight">
          <p class="truncate text-xs font-medium">{{ playerTrack.title }}</p>
          <p class="truncate text-[10px] text-neutral-400">{{ playerTrack.artist }}</p>
        </div>
        <button class="icon-btn" aria-label="Next track" @click="nextTrack">
          <MorphIcon :icon="SkipForward" :size="14" />
        </button>
        <button class="icon-btn" aria-label="Expand player" @click="playerMinimized = false">
          <MorphIcon :icon="ChevronsUpDown" :size="14" />
        </button>
      </div>

      <!-- expanded bar -->
      <div
        v-else
        class="player-card border-t border-neutral-200/80 bg-white/80 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-950/80"
      >
        <Transition name="queue-pop">
          <div v-if="queueOpen" class="max-h-64 overflow-y-auto border-b border-neutral-200/80 dark:border-neutral-800">
            <button
              v-for="(track, index) in playerQueue"
              :key="track.uri"
              class="queue-row flex w-full items-center gap-3 px-6 py-1.5 text-left transition-colors"
              :class="track.uri === playerTrack?.uri ? 'bg-neutral-100/80 dark:bg-neutral-900' : 'hover:bg-neutral-50 dark:hover:bg-neutral-900/60'"
              :style="{ '--delay': `${index * 30}ms` }"
              @click="playQueue(playerQueue, index)"
            >
              <img :src="track.cover" :alt="track.title" class="size-7 rounded object-cover" loading="lazy">
              <span class="min-w-0 flex-1 truncate text-xs" :class="track.uri === playerTrack?.uri ? 'font-medium' : ''">{{ track.title }}</span>
              <span class="truncate text-xs text-neutral-400">{{ track.artist }}</span>
            </button>
          </div>
        </Transition>

        <div class="relative">
          <div class="player-progress" :style="{ width: `${progress}%` }" />
          <div class="mx-auto flex max-w-5xl items-center gap-3 px-6 py-2.5">
          <img :src="playerTrack.cover" :alt="playerTrack.title" class="size-9 rounded-md object-cover shadow-sm">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm">{{ playerTrack.title }}</p>
            <p class="truncate text-xs text-neutral-400">{{ playerTrack.artist }}</p>
          </div>
          <span class="hidden text-xs text-neutral-400 tabular-nums sm:inline">
            {{ formatMs(playerPosition) }} / {{ formatMs(playerDuration) }}
          </span>
          <button class="icon-btn" aria-label="Previous track" @click="previousTrack">
            <MorphIcon :icon="SkipBack" :size="16" />
          </button>
          <button
            class="flex size-8 items-center justify-center rounded-full bg-neutral-900 text-white transition-all duration-100 hover:opacity-80 active:scale-90 dark:bg-neutral-100 dark:text-neutral-900"
            :aria-label="playerPaused ? 'Play' : 'Pause'"
            @click="togglePlayer"
          >
            <MorphIcon :icon="playerPaused ? Play : Pause" :size="14" />
          </button>
          <button class="icon-btn" aria-label="Next track" @click="nextTrack">
            <MorphIcon :icon="SkipForward" :size="16" />
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            :value="playerVolume"
            aria-label="Volume"
            class="player-volume hidden w-20 sm:block"
            :style="{ '--thumb': isDark ? 'rgb(245 245 245)' : 'rgb(23 23 23)' }"
            @input="setVolume(Number(($event.target as HTMLInputElement).value))"
          >
          <button class="icon-btn" aria-label="Toggle queue" :class="queueOpen ? 'text-neutral-900 dark:text-neutral-100' : ''" @click="queueOpen = !queueOpen">
            <MorphIcon :icon="ListMusic" :size="16" />
          </button>
          <button class="icon-btn" aria-label="Minimize player" @click="playerMinimized = true">
            <MorphIcon :icon="ChevronsDownUp" :size="14" />
          </button>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.player-card {
  transform-origin: bottom right;
}

.player-progress {
  position: absolute;
  top: -1px;
  left: 0;
  height: 2px;
  background: currentColor;
  opacity: 0.35;
  transition: width 250ms linear;
}

.player-spin {
  animation: player-spin 8s linear infinite;
}

@keyframes player-spin {
  to {
    transform: rotate(360deg);
  }
}

.player-volume {
  --thumb: rgb(23 23 23);
  appearance: none;
  height: 3px;
  border-radius: 9999px;
  background: rgb(229 229 229);
  outline: none;
  cursor: pointer;
}

.player-volume::-webkit-slider-thumb {
  appearance: none;
  width: 10px;
  height: 10px;
  border-radius: 9999px;
  background: var(--thumb);
  transition: transform 120ms ease;
}

.player-volume:hover::-webkit-slider-thumb,
.player-volume:active::-webkit-slider-thumb {
  transform: scale(1.4);
}

.player-volume::-moz-range-thumb {
  width: 10px;
  height: 10px;
  border: none;
  border-radius: 9999px;
  background: var(--thumb);
}

:global(.dark) .player-volume {
  --thumb: rgb(245 245 245);
  background: rgb(64 64 64);
}

.player-pop-enter-active,
.player-pop-leave-active {
  transition: opacity 180ms ease, transform 220ms cubic-bezier(0.23, 1, 0.32, 1);
}

.player-pop-enter-from,
.player-pop-leave-to {
  opacity: 0;
  transform: translateY(10px) scale(0.96);
}

.queue-row {
  animation: queue-row-in 200ms cubic-bezier(0.23, 1, 0.32, 1) both;
  animation-delay: var(--delay);
}

@keyframes queue-row-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}

.queue-pop-enter-active,
.queue-pop-leave-active {
  transition: opacity 180ms ease, transform 200ms cubic-bezier(0.23, 1, 0.32, 1);
}

.queue-pop-enter-from,
.queue-pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}

@media (prefers-reduced-motion: reduce) {
  .player-progress,
  .player-pop-enter-active,
  .player-pop-leave-active,
  .queue-pop-enter-active,
  .queue-pop-leave-active {
    transition: none;
  }

  .queue-row {
    animation: none;
  }

  .player-spin {
    animation: none;
  }
}
</style>
