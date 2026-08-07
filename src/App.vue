<script setup lang="ts" vapor>
import { defineSound } from '@web-kits/audio'
import { useIntervalFn, useUrlSearchParams } from '@vueuse/core'
import { Languages, Library, Monitor, Moon, Sun } from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import { computed, shallowRef, watch } from 'vue'

import type { Collections, MediaItem, SubjectType } from './composables/useBangumi'
import type { CollectionSection } from './components/CollectionTable.vue'

import CollectionTable from './components/CollectionTable.vue'
import CoverBackdrop from './components/CoverBackdrop.vue'
import DitherLab from './components/DitherLab.vue'
import RetroCover from './components/RetroCover.vue'
import TasteSummary from './components/TasteSummary.vue'
import { CATEGORY_KEYS, SUBJECT_TYPES, useBangumi } from './composables/useBangumi'
import { useNeoDB } from './composables/useNeoDB'
import { useLocale } from './composables/useLocale'
import { useTheme } from './composables/useTheme'

const { locale, t, toggle: setLocale } = useLocale()
const { cycle, isDark, theme } = useTheme()

const clickSound = defineSound({
  source: { type: 'triangle', frequency: { start: 520, end: 320 } },
  envelope: { decay: 0.045 },
  gain: 0.08,
})
const tabSound = defineSound({
  source: { type: 'sine', frequency: { start: 420, end: 680 } },
  envelope: { decay: 0.08 },
  gain: 0.07,
})

const themeIcons = {
  dark: Moon,
  light: Sun,
  system: Monitor,
}

const subjectSlugs: Record<SubjectType, string> = {
  1: 'book',
  2: 'anime',
  3: 'music',
  4: 'game',
  6: 'real',
  podcast: 'podcast',
}
const params = useUrlSearchParams('history', { writeMode: 'push' })
const lab = computed(() => 'lab' in params)
const activeSubject = computed<SubjectType>({
  get: () => SUBJECT_TYPES.find(type => subjectSlugs[type] === params.type) ?? 2,
  set: type => params.type = subjectSlugs[type],
})
const { collections: bangumi, error, loading } = useBangumi(activeSubject)
const { collections: neodb } = useNeoDB(activeSubject)
const collections = computed<Collections | undefined>(() => {
  if (!bangumi.value)
    return undefined
  const merged = { ...bangumi.value }
  for (const key of ['watching', 'wish', 'completed', 'dropped'] as const)
    merged[key] = [...merged[key], ...(neodb.value?.[key] ?? [])] as MediaItem[]
  return merged
})

const subjectLabels = computed<Record<SubjectType, string>>(() => ({
  1: t.value.book,
  2: t.value.anime,
  3: t.value.music,
  4: t.value.game,
  6: t.value.real,
  podcast: t.value.podcast,
}))

const subjectTabs = computed(() => SUBJECT_TYPES.map(type => ({
  label: subjectLabels.value[type],
  type,
})))

const sections = computed<CollectionSection[]>(() => {
  const c = collections.value
  if (!c)
    return []
  let offset = 0
  return CATEGORY_KEYS
    .map(key => ({ key, list: c[key].filter(item => item.subjectType === activeSubject.value) }))
    .filter(s => s.list.length > 0)
    .map((s) => {
      const withOffset = { ...s, offset }
      offset += s.list.length
      return withOffset
    })
})

const items = computed(() => sections.value.flatMap(s => s.list))
const watchingItems = computed(() => collections.value?.watching.filter(item => item.subjectType === activeSubject.value) ?? [])
const titleCoverIndex = shallowRef(0)
const titleCover = computed(() => watchingItems.value[titleCoverIndex.value % watchingItems.value.length])
useIntervalFn(() => titleCoverIndex.value++, 5000)
watch(watchingItems, () => titleCoverIndex.value = 0)

const tasteItems = computed(() => collections.value
  ? [...collections.value.watching, ...collections.value.completed].filter(item => item.subjectType === activeSubject.value)
  : [])

watch(items, (list) => {
  for (const item of list.slice(0, 30))
    void (new Image().src = item.cover)
})

function toggleLocale() {
  clickSound()
  setLocale()
}

function toggleTheme() {
  clickSound()
  cycle()
}

function selectSubject(type: SubjectType) {
  activeSubject.value = type
}

function displayTitle(item: MediaItem) {
  return locale.value === 'zh' && item.titleCn ? item.titleCn : item.title
}
</script>

<template>
  <DitherLab v-if="lab" />
  <div v-else class="relative min-h-screen bg-base text-base font-sans antialiased">
    <Transition name="backdrop-fade">
      <CoverBackdrop :key="activeSubject" :items="items" :dark="isDark" />
    </Transition>

    <main class="relative z-10 mx-auto max-w-5xl px-6 py-12 sm:py-16">
      <header class="mb-8 flex items-center justify-between gap-3">
        <div class="flex min-w-0 items-center gap-3">
          <a href="https://bgm.tv/user/1140496" aria-label="Kevin Kwong on Bangumi" class="shrink-0">
            <img
              src="/avatar_cropped.jpg"
              alt="Kevin Kwong"
              class="size-10 shrink-0 rounded-full ring-1 ring-black/10 dark:ring-white/10"
            >
          </a>
          <h1 class="hidden min-w-0 truncate text-xl font-medium tracking-tight sm:block" aria-label="Kevin Kwong is consuming…">
            <span class="title-word inline-block" aria-hidden="true">Kevin Kwong</span>
            <span class="title-word ml-1 hidden sm:inline-block" aria-hidden="true">is</span>
            <span class="title-word ml-1 hidden sm:inline-block" aria-hidden="true">consuming<span class="title-dot">.</span><span class="title-dot">.</span><span class="title-dot">.</span></span>
          </h1>
          <a v-if="titleCover" :href="titleCover.url" target="_blank" rel="noopener" class="hidden shrink-0 sm:block" :title="displayTitle(titleCover)">
            <RetroCover :item="titleCover" compact class="relative h-14 w-11" />
          </a>
        </div>
        <nav class="flex shrink-0 items-center gap-2 text-neutral-400 sm:gap-3" aria-label="Site links">
          <a href="https://bgm.tv/user/1140496" target="_blank" rel="noopener" aria-label="Bangumi" title="Bangumi" class="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
            <MorphIcon :icon="Library" :size="16" />
          </a>
          <a href="https://github.com/kvoon3/consume" target="_blank" rel="noopener" aria-label="GitHub" class="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
            <svg viewBox="0 0 24 24" class="size-4 fill-current" aria-hidden="true"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg>
          </a>
          <button
            class="p-1 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
            :title="locale === 'zh' ? '中文' : 'English'"
            @click="toggleLocale"
          >
            <MorphIcon :icon="Languages" :size="18" />
          </button>
          <button
            class="theme-toggle p-1 transition-colors hover:text-neutral-900 dark:hover:text-neutral-100"
            :title="`Theme: ${theme}`"
            @click="toggleTheme"
          >
            <MorphIcon :icon="themeIcons[theme]" :size="18" />
          </button>
        </nav>
      </header>

      <nav data-collection-session class="mb-5 flex gap-1 overflow-x-auto" aria-label="Media types" role="tablist">
        <button
          v-for="tab in subjectTabs"
          :key="tab.type"
          type="button"
          role="tab"
          :aria-selected="activeSubject === tab.type"
          class="shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors"
          :class="activeSubject === tab.type ? 'bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900' : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100'"
          @click="tabSound(); selectSubject(tab.type)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <p v-if="error" class="text-sm text-red-500">
        {{ error }}
      </p>
      <template v-else>
        <TasteSummary :items="tasteItems" :loading="loading" :spotify-visible="activeSubject === 3" :collections="collections" :subject="activeSubject" />
        <CollectionTable
          :loading="loading"
          :sections="sections"
          :subject="activeSubject"
          @navigate="clickSound()"
        />
      </template>

    </main>
  </div>
</template>

<style scoped>
.backdrop-fade-enter-active,
.backdrop-fade-leave-active {
  transition: opacity 280ms cubic-bezier(0.77, 0, 0.175, 1);
}

.backdrop-fade-enter-from,
.backdrop-fade-leave-to {
  opacity: 0;
}

.title-word {
  display: inline-block;
  animation: title-word-in 240ms cubic-bezier(0.23, 1, 0.32, 1) both;
}

.title-word:nth-child(2) {
  animation-delay: 40ms;
}

.title-word:nth-child(3) {
  animation-delay: 80ms;
}

@keyframes title-word-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
}

.title-dot {
  display: inline-block;
  animation: title-dot-pulse 1200ms linear infinite;
}

.title-dot:nth-child(2) {
  animation-delay: 200ms;
}

.title-dot:nth-child(3) {
  animation-delay: 400ms;
}

@keyframes title-dot-pulse {
  0%, 60%, 100% {
    opacity: 0.3;
  }

  30% {
    opacity: 1;
  }
}

@media (prefers-reduced-motion: reduce) {
  .backdrop-fade-enter-active,
  .backdrop-fade-leave-active {
    transition-duration: 160ms;
  }

  .title-word {
    animation: title-word-fade-in 160ms ease both;
  }

  .title-dot {
    animation: none;
    opacity: 1;
  }

}

@keyframes title-word-fade-in {
  from {
    opacity: 0;
  }
}
</style>
