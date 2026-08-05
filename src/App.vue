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
  <div class="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
    <main class="mx-auto max-w-3xl px-6 py-16">
      <header class="mb-12 flex items-start justify-between">
        <h1 class="text-2xl font-semibold tracking-tight">
          Kevin Kwong is watching…
        </h1>
        <button
          class="rounded-full p-2 text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200"
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

      <div v-else class="flex items-start gap-12">
        <div ref="rootRef" class="min-w-0 flex-1">
          <ul>
            <li v-for="(a, i) in watching" :key="a.id">
              <a
                :href="a.url"
                target="_blank"
                rel="noopener"
                data-super-hover
                :data-index="i"
                class="group flex items-baseline justify-between gap-4 rounded-md px-3 py-2.5 transition-colors data-[super-hover-active]:bg-neutral-200/60 dark:data-[super-hover-active]:bg-neutral-800/60"
              >
                <span class="truncate text-sm">
                  {{ a.title }}
                </span>
                <span class="shrink-0 font-mono text-xs tabular-nums text-neutral-400">
                  {{ a.progress }}{{ a.total ? `/${a.total}` : '' }}
                </span>
              </a>
            </li>
          </ul>

          <template v-if="completed.length">
            <h2 class="mt-10 mb-1 px-3 text-xs font-medium tracking-widest text-neutral-400 uppercase">
              Recently completed
            </h2>
            <ul>
              <li v-for="(a, j) in completed" :key="a.id">
                <a
                  :href="a.url"
                  target="_blank"
                  rel="noopener"
                  data-super-hover
                  :data-index="watching.length + j"
                  class="flex items-baseline justify-between gap-4 rounded-md px-3 py-2.5 transition-colors data-[super-hover-active]:bg-neutral-200/60 dark:data-[super-hover-active]:bg-neutral-800/60"
                >
                  <span class="truncate text-sm text-neutral-600 dark:text-neutral-400">
                    {{ a.title }}
                  </span>
                  <span v-if="a.score" class="shrink-0 text-xs text-amber-500">
                    <span class="i-ph:star-fill inline-block" /> {{ a.score }}
                  </span>
                </a>
              </li>
            </ul>
          </template>
        </div>

        <div class="sticky top-16 hidden w-44 shrink-0 sm:block">
          <img
            v-if="active"
            :key="active.id"
            :src="active.cover"
            :alt="active.title"
            class="w-full rounded-lg shadow-lg"
          >
          <div v-else class="aspect-[2/3] w-full rounded-lg bg-neutral-200/60 dark:bg-neutral-800/60" />
        </div>
      </div>
    </main>
  </div>
</template>
