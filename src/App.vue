<script setup lang="ts" vapor>
import { defineSound } from '@web-kits/audio'
import { useTimeoutFn, useUrlSearchParams } from '@vueuse/core'
import { Languages, Library, Monitor, Moon, Sun } from 'lucide'
import { MorphIcon } from 'morphicons/vue'
import { computed, shallowRef, watch } from 'vue'
import { useSuperHover } from 'super-hover/vue'

import type { Collections, MediaItem, SubjectType } from './composables/useBangumi'

import CoverBackdrop from './components/CoverBackdrop.vue'
import TasteSummary from './components/TasteSummary.vue'
import { CATEGORY_KEYS, SUBJECT_TYPES, useBangumi } from './composables/useBangumi'
import { useNeoDB } from './composables/useNeoDB'
import { useLocale } from './composables/useLocale'
import { useTheme } from './composables/useTheme'

const { locale, t, toggle: setLocale } = useLocale()
const { cycle, isDark, theme } = useTheme()

const hoverSound = defineSound({
  source: { type: 'sine', frequency: { start: 700, end: 500 } },
  envelope: { decay: 0.035 },
  gain: 0.06,
})
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

interface Section {
  key: keyof Collections
  label: string
  list: MediaItem[]
  offset: number
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

const sections = computed<Section[]>(() => {
  const c = collections.value
  if (!c)
    return []
  let offset = 0
  return CATEGORY_KEYS
    .map(key => ({ key, label: '', list: c[key].filter(item => item.subjectType === activeSubject.value) }))
    .filter(s => s.list.length > 0)
    .map((s) => {
      const withOffset = { ...s, offset }
      offset += s.list.length
      return withOffset
    })
})

const items = computed(() => sections.value.flatMap(s => s.list))
const tasteItems = computed(() => collections.value
  ? [...collections.value.watching, ...collections.value.completed].filter(item => item.subjectType === activeSubject.value)
  : [])
const active = shallowRef<MediaItem>()
const highlightedSection = shallowRef<keyof Collections>()
const previewY = shallowRef(8)
const { start: startHighlightTimeout, stop: stopHighlightTimeout } = useTimeoutFn(() => {
  highlightedSection.value = undefined
}, 1000, { immediate: false })

watch(items, (list) => {
  for (const item of list.slice(0, 30))
    void (new Image().src = item.cover)
})

function movePreview(y: number) {
  const root = rootRef.value
  if (!root)
    return
  const rect = root.getBoundingClientRect()
  previewY.value = root.scrollTop + Math.max(8, Math.min(y - rect.top + 12, rect.height - 176))
}

const rootRef = useSuperHover({
  onEnter(event) {
    const el = event.detail.current as HTMLElement | null
    if (!el)
      return
    active.value = items.value[Number(el.dataset.index)]
    movePreview(event.detail.y)
    hoverSound()
  },
  onLeave() {
    active.value = undefined
  },
  onMove(event) {
    movePreview(event.detail.y)
  },
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
  active.value = undefined
  stopHighlightTimeout()
  highlightedSection.value = undefined
  if (rootRef.value)
    rootRef.value.scrollTop = 0
  activeSubject.value = type
}

function scrollToSection(key: keyof Collections) {
  const root = rootRef.value
  const target = root?.querySelector<HTMLElement>(`#collection-${key}`)
  const header = root?.querySelector<HTMLElement>('.list-grid')
  if (root && target && header) {
    root.scrollTo({ top: target.offsetTop - header.offsetHeight })
    stopHighlightTimeout()
    highlightedSection.value = key
    startHighlightTimeout()
  }
}

function sectionLabel(key: keyof Collections) {
  const labels = t.value.subjectLabels as Partial<Record<SubjectType, Partial<Record<keyof Collections, string>>>>
  return labels[activeSubject.value]?.[key] ?? t.value[key]
}

function displayTitle(a: MediaItem) {
  return locale.value === 'zh' && a.titleCn ? a.titleCn : a.title
}

function sublabel(a: MediaItem) {
  return a.date ? a.date.slice(0, 4) : '—'
}

type DetailColumn = 'creator' | 'year' | 'progress' | 'score'
const COLUMN_WIDTHS: Record<DetailColumn, number> = { creator: 10, progress: 4.5, score: 3, year: 4 }
const SUBJECT_COLUMNS: Record<SubjectType, DetailColumn[]> = {
  1: ['year', 'progress', 'score'],
  2: ['year', 'progress', 'score'],
  3: ['year', 'score'],
  4: ['year', 'score'],
  6: ['year', 'progress', 'score'],
  podcast: ['creator', 'score'],
}
const columns = computed(() => SUBJECT_COLUMNS[activeSubject.value])
const gridStyle = computed(() => ({
  '--cols': `minmax(0, 1fr) 13rem ${columns.value.map(c => `${COLUMN_WIDTHS[c]}rem`).join(' ')}`,
}))
// rem width of the detail area + gaps + row padding, used to place the preview card
const detailWidth = computed(() =>
  columns.value.reduce((w, c) => w + COLUMN_WIDTHS[c], 0) + columns.value.length * 0.5 + 1.25,
)

function columnHeader(col: DetailColumn) {
  return { creator: t.value.creator, progress: t.value.progress, score: t.value.rating, year: t.value.aired }[col]
}

function columnValue(a: MediaItem, col: DetailColumn) {
  if (col === 'year')
    return sublabel(a)
  if (col === 'score')
    return a.score || '—'
  if (col === 'creator')
    return a.creator || '—'
  return a.total ? `${a.progress}/${a.total}` : `${a.progress} ${t.value.eps}`
}
</script>

<template>
  <div class="theme-surface relative min-h-screen bg-white font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100" :class="{ dark: isDark }">
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
          <h1 class="hidden min-w-0 truncate text-xl font-medium tracking-tight sm:block" aria-label="Kevin Kwong is watching…">
            <span class="title-word inline-block" aria-hidden="true">Kevin Kwong</span>
            <span class="title-word ml-1 hidden sm:inline-block" aria-hidden="true">is</span>
            <span class="title-word ml-1 hidden sm:inline-block" aria-hidden="true">watching<span class="title-dot">.</span><span class="title-dot">.</span><span class="title-dot">.</span></span>
          </h1>
        </div>
        <nav class="flex shrink-0 items-center gap-2 text-neutral-400 sm:gap-3" aria-label="Site links">
          <a href="https://bgm.tv/user/1140496" target="_blank" rel="noopener" aria-label="Bangumi" title="Bangumi" class="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
            <MorphIcon :icon="Library" :size="16" />
          </a>
          <a href="https://github.com/kvoon3/watch" target="_blank" rel="noopener" aria-label="GitHub" class="transition-colors hover:text-neutral-900 dark:hover:text-neutral-100">
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

      <nav class="mb-5 flex gap-1 overflow-x-auto" aria-label="Media types" role="tablist">
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

      <div v-if="loading" role="status" class="flex h-[min(60vh,32rem)] min-h-80 items-center justify-center rounded-xl border border-neutral-200 text-neutral-400 dark:border-neutral-800">
        <span class="size-4 animate-spin rounded-full border-2 border-current border-r-transparent motion-reduce:animate-none" />
        <span class="sr-only">Loading collections…</span>
      </div>
      <p v-else-if="error" class="text-sm text-red-500">
        {{ error }}
      </p>

      <div v-else>
        <TasteSummary :items="tasteItems" :spotify-visible="activeSubject === 3" />

        <nav class="mb-3 flex flex-wrap gap-1" aria-label="Collection categories">
          <a
            v-for="s in sections"
            :key="s.key"
            :href="`#collection-${s.key}`"
            class="category-link rounded-full px-3 py-1.5 text-xs text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
            :class="{ 'is-highlighted': highlightedSection === s.key }"
            @click.prevent="clickSound(); scrollToSection(s.key)"
          >
            {{ sectionLabel(s.key) }} <span class="text-neutral-400 tabular-nums">{{ s.list.length }}</span>
          </a>
        </nav>

        <div class="h-[min(60vh,32rem)] min-h-80 overflow-hidden rounded-xl border border-neutral-200 dark:border-neutral-800">
          <div
            ref="rootRef"
            class="collection-list scroll-fade-b relative h-full overflow-y-auto overscroll-contain"
          >
          <div class="list-grid sticky top-0 z-20 border-b border-neutral-200 bg-white/95 px-3 py-1.5 text-[10px] tracking-widest text-neutral-400 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95" :style="gridStyle">
            <span>{{ t.title }}</span>
            <span class="preview-column" />
            <span v-for="col in columns" :key="col" class="detail-column" :class="{ 'text-right': col === 'score' }">{{ columnHeader(col) }}</span>
          </div>

          <section v-for="s in sections" :id="`collection-${s.key}`" :key="s.key">
            <h2
              class="section-heading sticky top-[27px] z-10 border-b border-neutral-200 bg-neutral-50/95 px-3 py-1 text-[10px] font-medium tracking-widest text-neutral-500 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/95 dark:text-neutral-400"
              :class="{ 'is-highlighted': highlightedSection === s.key }"
            >
              {{ sectionLabel(s.key) }} · {{ s.list.length }}
            </h2>
            <a
              v-for="(a, i) in s.list"
              :key="a.id"
              :href="a.url"
              target="_blank"
              rel="noopener"
              data-super-hover
              :data-index="s.offset + i"
              class="list-grid border-b border-neutral-100 px-3 py-1 text-xs outline-none transition-colors last:border-b-0 hover:bg-neutral-50 focus-visible:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/60 dark:focus-visible:bg-neutral-900/60"
              :style="gridStyle"
            >
              <span class="truncate text-sm">{{ displayTitle(a) }}</span>
              <span class="preview-column" />
              <span v-for="col in columns" :key="col" class="detail-column tabular-nums" :class="[col === 'score' ? 'text-right text-amber-500' : 'text-neutral-400', col === 'creator' ? 'truncate' : '']">{{ columnValue(a, col) }}</span>
            </a>
          </section>


          <div
            v-if="active"
            class="preview-card crt-cover pointer-events-none absolute z-30 hidden h-36 w-28 p-2.5 pb-8 shadow-xl sm:block"
            :style="{ transform: `translateY(${previewY}px)`, right: `${detailWidth}rem` }"
          >
            <div class="crt-screen relative h-full overflow-hidden">
              <img :src="active.cover" :alt="displayTitle(active)" class="crt-image absolute inset-0 size-full object-cover">
              <span class="crt-scanlines absolute inset-0" aria-hidden="true" />
            </div>
            <span class="mac-brand absolute bottom-2.5 left-3 size-2 rounded-sm" aria-hidden="true" />
            <span class="mac-slot absolute bottom-3 right-3 h-0.5 w-9 rounded-full" aria-hidden="true" />
          </div>
        </div>
        </div>
      </div>

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

.list-grid {
  display: grid;
  grid-template-columns: var(--cols);
  align-items: center;
  gap: 0.5rem;
}

@property --scroll-fade-b {
  syntax: '<length-percentage>';
  inherits: false;
  initial-value: 0px;
}

@keyframes scroll-fade-reveal-b {
  from {
    --scroll-fade-b: min(12%, 2.5rem);
  }

  to {
    --scroll-fade-b: 0px;
  }
}

.scroll-fade-b {
  --scroll-fade-size: min(12%, 2.5rem);
  -webkit-mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - var(--scroll-fade-b, 0px)), transparent 100%);
  mask-image: linear-gradient(to bottom, #000 0, #000 calc(100% - var(--scroll-fade-b, 0px)), transparent 100%);
  -webkit-mask-repeat: no-repeat;
  mask-repeat: no-repeat;
}

@supports (animation-timeline: scroll()) {
  .scroll-fade-b {
    animation: scroll-fade-reveal-b 1ms ease-in-out both;
    animation-range: calc(100% - 6rem) 100%;
    animation-timeline: scroll(self y);
  }
}

@supports not (animation-timeline: scroll()) {
  .scroll-fade-b {
    --scroll-fade-b: var(--scroll-fade-size);
  }
}

.collection-list {
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgb(163 163 163 / 0.4) transparent;
}

.collection-list::-webkit-scrollbar {
  width: 10px;
}

.collection-list::-webkit-scrollbar-track {
  background: transparent;
}

.collection-list::-webkit-scrollbar-thumb {
  background: rgb(163 163 163 / 0.35);
  background-clip: padding-box;
  border: 3px solid transparent;
  border-radius: 9999px;
}

.preview-card {
  top: 0;
}

.crt-cover {
  border: 1px solid rgb(212 212 212);
  border-radius: 0.7rem 0.7rem 0.45rem 0.45rem;
  background:
    linear-gradient(135deg, rgb(255 255 255), transparent 32%),
    linear-gradient(145deg, rgb(250 250 250), rgb(229 229 229));
  box-shadow:
    0 14px 28px rgb(0 0 0 / 0.18),
    inset 2px 2px 0 rgb(255 255 255 / 0.9),
    inset -2px -2px 0 rgb(163 163 163 / 0.2),
    inset 0 -1.4rem 0 rgb(212 212 212 / 0.45);
}

.crt-cover::before {
  position: absolute;
  right: 0.65rem;
  bottom: -0.2rem;
  left: 0.65rem;
  z-index: -1;
  height: 0.35rem;
  border-radius: 0 0 0.25rem 0.25rem;
  background: rgb(163 163 163);
  content: '';
}

.theme-surface.dark .crt-cover {
  border-color: rgb(38 38 38);
  background:
    linear-gradient(135deg, rgb(255 255 255 / 0.1), transparent 30%),
    linear-gradient(145deg, rgb(82 82 78), rgb(38 38 35));
  box-shadow:
    0 14px 28px rgb(0 0 0 / 0.5),
    inset 2px 2px 0 rgb(255 255 255 / 0.12),
    inset -2px -2px 0 rgb(0 0 0 / 0.45),
    inset 0 -1.4rem 0 rgb(23 23 21 / 0.38);
}

.theme-surface.dark .crt-cover::before {
  background: rgb(23 23 23);
}

.crt-screen {
  border: 2px solid rgb(64 64 64);
  border-radius: 12% / 8%;
  background: rgb(10 10 10);
  box-shadow:
    -2px -2px 0 rgb(163 163 163),
    2px 2px 0 rgb(255 255 255 / 0.9),
    0 0 0 4px rgb(212 212 212),
    0 0 0 5px rgb(255 255 255 / 0.2),
    inset 0 0 22px 6px rgb(0 0 0 / 0.82),
    inset 3px 3px 6px rgb(0 0 0 / 0.7),
    inset -2px -2px 5px rgb(255 255 255 / 0.12);
}

.crt-screen::after {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  background:
    radial-gradient(ellipse at 38% 24%, rgb(255 255 255 / 0.24), transparent 38%),
    radial-gradient(ellipse at center, transparent 35%, rgb(0 0 0 / 0.52) 100%);
  content: '';
}

.theme-surface.dark .crt-screen {
  border-color: rgb(23 23 23);
  box-shadow:
    -2px -2px 0 rgb(38 38 36),
    2px 2px 0 rgb(115 115 108 / 0.45),
    0 0 0 4px rgb(64 64 60),
    0 0 0 5px rgb(255 255 255 / 0.05),
    inset 0 0 22px 6px rgb(0 0 0 / 0.88),
    inset 3px 3px 6px rgb(0 0 0 / 0.8),
    inset -2px -2px 5px rgb(255 255 255 / 0.08);
}

.crt-image {
  border-radius: inherit;
  filter: contrast(1.08) saturate(0.88);
  transform: scale(1.09);
}

.crt-scanlines {
  border-radius: inherit;
  background:
    radial-gradient(ellipse at center, transparent 48%, rgb(0 0 0 / 0.38) 100%),
    repeating-linear-gradient(to bottom, transparent 0 2px, rgb(0 0 0 / 0.2) 2px 3px);
}

.mac-brand {
  border: 1px solid rgb(115 115 115 / 0.55);
  background:
    linear-gradient(to bottom, #68a9d2 0 20%, #7bb862 20% 40%, #e7c457 40% 60%, #df8a4e 60% 80%, #c8665b 80%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.2);
}

.mac-slot {
  background: rgb(82 82 82 / 0.75);
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.3);
}

.theme-surface.dark .mac-slot {
  background: rgb(10 10 10 / 0.85);
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.1);
}


.category-link,
.section-heading {
  transition: background-color 180ms ease, color 180ms ease;
}

.category-link.is-highlighted {
  background: rgb(229 229 229);
  color: rgb(23 23 23);
}

.section-heading.is-highlighted {
  background: rgb(229 229 229 / 0.95);
  color: rgb(23 23 23);
}

:global(.dark) .category-link.is-highlighted {
  background: rgb(38 38 38);
  color: rgb(245 245 245);
}

:global(.dark) .section-heading.is-highlighted {
  background: rgb(38 38 38 / 0.95);
  color: rgb(245 245 245);
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

  .collection-list {
    scroll-behavior: auto;
  }

}

@keyframes title-word-fade-in {
  from {
    opacity: 0;
  }
}

@media (max-width: 639px) {
  .list-grid {
    grid-template-columns: minmax(0, 1fr) 3rem;
  }

  .preview-column,
  .detail-column {
    display: none;
  }
}
</style>
