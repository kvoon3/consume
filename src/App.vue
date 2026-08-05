<script setup lang="ts" vapor>
import { computed, ref, watch } from 'vue'
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

watch(items, list => active.value ??= list[0])

const rootRef = useSuperHover({
  onEnter(event) {
    const el = event.detail.current as HTMLElement | null
    if (el)
      active.value = items.value[Number(el.dataset.index)]
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

      <div
        v-else
        class="flex h-[min(30rem,70vh)] overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800"
      >
        <div ref="rootRef" class="w-44 shrink-0 overflow-y-auto overscroll-contain sm:w-56">
          <div class="flex flex-col gap-0.5 p-1.5">
            <a
              v-for="(a, i) in items"
              :key="a.id"
              :href="a.url"
              target="_blank"
              rel="noopener"
              data-super-hover
              :data-index="i"
              class="rounded-md px-2 py-1.5 outline-none transition-colors data-[super-hover-active]:bg-neutral-100 dark:data-[super-hover-active]:bg-neutral-900"
            >
              <div class="truncate text-sm">
                {{ a.title }}
              </div>
              <div class="truncate text-[11px] text-neutral-400 tabular-nums">
                {{ sublabel(a) }}
              </div>
            </a>
          </div>
        </div>

        <div class="relative min-w-0 flex-1 border-l border-neutral-200 dark:border-neutral-800">
          <div v-if="active" :key="active.id" class="absolute inset-0 flex animate-fade-in flex-col overflow-hidden">
            <div class="flex items-start justify-between gap-3 px-4 pt-4 pb-2">
              <h2 class="min-w-0 truncate text-lg leading-tight font-medium sm:text-xl">
                {{ active.title }}
              </h2>
              <span class="shrink-0 rounded-full px-2 py-0.5 text-xs text-neutral-500 tabular-nums dark:text-neutral-400">
                {{ active.total ? `${active.progress} / ${active.total}` : `${active.progress} eps` }}
              </span>
            </div>

            <div class="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
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
                  <span v-if="active.score" class="text-amber-500"><span class="i-ph:star-fill" /> {{ active.score }}</span>
                  <span class="text-neutral-400"> · bgm {{ active.siteScore || '—' }}</span>
                </dd>
                <dt class="text-neutral-400">
                  aired
                </dt>
                <dd class="tabular-nums">
                  {{ active.date || '—' }}
                </dd>
              </dl>
              <p class="text-xs leading-relaxed text-neutral-500 dark:text-neutral-400">
                {{ active.summary }}
              </p>
            </div>
          </div>
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
  }
}
.animate-fade-in {
  animation: fade-in 0.2s ease-out;
}
</style>
