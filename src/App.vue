<script setup lang="ts" vapor>
import { computed, ref } from 'vue'
import { useSuperHover } from 'super-hover/vue'

import type { AnimeItem } from './composables/useBangumi'

import { useBangumi } from './composables/useBangumi'
import { useTheme } from './composables/useTheme'

const { completed, error, loading, watching } = useBangumi()
const { cycle, theme } = useTheme()

const themeIcons = {
  dark: 'i-ph:moon',
  light: 'i-ph:sun',
  system: 'i-ph:monitor',
}

const items = computed(() => [...watching.value, ...completed.value])
const active = ref<AnimeItem>()

const rootRef = useSuperHover({
  onEnter(event) {
    const el = event.detail.current
    if (el)
      active.value = items.value[Number((el as HTMLElement).dataset.index)]
  },
})
</script>

<template>
  <div class="min-h-screen bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
    <main class="mx-auto max-w-2xl px-6 py-20 sm:py-28">
      <header class="mb-10 flex items-baseline justify-between">
        <h1 class="text-xl font-medium tracking-tight">
          Kevin Kwong is watching…
        </h1>
        <button
          class="p-1 text-neutral-400 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
          :title="`Theme: ${theme}`"
          @click="cycle"
        >
          <span :class="themeIcons[theme]" class="block" />
        </button>
      </header>

      <p v-if="loading" class="text-sm text-neutral-400">
        Loading…
      </p>
      <p v-else-if="error" class="text-sm text-red-500">
        {{ error }}
      </p>

      <div v-else class="flex items-start gap-10">
        <div ref="rootRef" class="min-w-0 flex-1">
          <ul class="divide-y divide-neutral-100 border-y border-neutral-100 dark:divide-neutral-900 dark:border-neutral-900">
            <li v-for="(a, i) in watching" :key="a.id">
              <a
                :href="a.url"
                target="_blank"
                rel="noopener"
                data-super-hover
                :data-index="i"
                class="-mx-3 flex items-baseline justify-between gap-4 px-3 py-3 transition-colors data-[super-hover-active]:bg-neutral-100/70 dark:data-[super-hover-active]:bg-neutral-900/70"
              >
                <span class="truncate text-[15px]">
                  {{ a.title }}
                </span>
                <span class="shrink-0 font-mono text-xs tabular-nums text-neutral-400">
                  {{ a.progress }}{{ a.total ? `/${a.total}` : '' }}
                </span>
              </a>
            </li>
          </ul>

          <template v-if="completed.length">
            <h2 class="mt-12 mb-3 text-xs font-medium tracking-widest text-neutral-400 uppercase">
              Recently completed
            </h2>
            <ul class="divide-y divide-neutral-100 border-y border-neutral-100 dark:divide-neutral-900 dark:border-neutral-900">
              <li v-for="(a, j) in completed" :key="a.id">
                <a
                  :href="a.url"
                  target="_blank"
                  rel="noopener"
                  data-super-hover
                  :data-index="watching.length + j"
                  class="-mx-3 flex items-baseline justify-between gap-4 px-3 py-3 transition-colors data-[super-hover-active]:bg-neutral-100/70 dark:data-[super-hover-active]:bg-neutral-900/70"
                >
                  <span class="truncate text-[15px] text-neutral-500 dark:text-neutral-400">
                    {{ a.title }}
                  </span>
                  <span v-if="a.score" class="flex shrink-0 items-center gap-1 font-mono text-xs tabular-nums text-amber-500">
                    <span class="i-ph:star-fill" /> {{ a.score }}
                  </span>
                </a>
              </li>
            </ul>
          </template>
        </div>

        <div class="sticky top-24 hidden w-40 shrink-0 sm:block">
          <img
            v-if="active"
            :key="active.id"
            :src="active.cover"
            :alt="active.title"
            class="w-full animate-fade-in rounded-lg shadow-xl ring-1 ring-black/10 dark:ring-white/10"
          >
          <div v-else class="aspect-[2/3] w-full rounded-lg bg-neutral-100 dark:bg-neutral-900" />
        </div>
      </div>

      <footer class="mt-16 text-xs text-neutral-400">
        <a href="https://bgm.tv/user/1140496" target="_blank" rel="noopener" class="transition-colors hover:text-neutral-600 dark:hover:text-neutral-300">bgm.tv</a>
      </footer>
    </main>
  </div>
</template>

<style>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
}
.animate-fade-in {
  animation: fade-in 0.25s ease-out;
}
</style>
