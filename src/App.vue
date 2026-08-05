<script setup lang="ts" vapor>
import AnimeCard from './components/AnimeCard.vue'
import { useBangumi } from './composables/useBangumi'
import { useTheme } from './composables/useTheme'

const { completed, error, loading, watching } = useBangumi()
const { cycle, theme } = useTheme()

const themeIcons = {
  dark: 'i-ph:moon',
  light: 'i-ph:sun',
  system: 'i-ph:monitor',
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
    <main class="mx-auto max-w-5xl px-6 py-12">
      <header class="mb-10 flex items-start justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight sm:text-4xl">
            Kevin Kwong is watching…
          </h1>
          <p class="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
            Live from <a href="https://bgm.tv/user/1140496" target="_blank" rel="noopener" class="underline underline-offset-2 hover:text-neutral-800 dark:hover:text-neutral-200">Bangumi</a>
          </p>
        </div>
        <button
          class="rounded-full p-2 text-xl text-neutral-500 hover:bg-neutral-200 dark:text-neutral-400 dark:hover:bg-neutral-800"
          :title="`Theme: ${theme}`"
          @click="cycle"
        >
          <span :class="themeIcons[theme]" class="block" />
        </button>
      </header>

      <p v-if="loading" class="text-neutral-500">
        Loading…
      </p>
      <p v-else-if="error" class="text-red-500">
        {{ error }}
      </p>
      <template v-else>
        <section>
          <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            <AnimeCard
              v-for="a in watching"
              :key="a.id"
              v-bind="a"
            />
          </div>
        </section>

        <section v-if="completed.length" class="mt-14">
          <h2 class="mb-4 text-lg font-semibold text-neutral-600 dark:text-neutral-300">
            Recently completed
          </h2>
          <div class="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            <AnimeCard
              v-for="a in completed"
              :key="a.id"
              v-bind="a"
              :progress="undefined"
            />
          </div>
        </section>
      </template>
    </main>
  </div>
</template>
