<script lang="ts">
import type { Collections, MediaItem } from '../composables/useBangumi'

export interface CollectionSection {
  key: keyof Collections
  list: MediaItem[]
  offset: number
}
</script>

<script setup lang="ts" vapor>
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { defineSound } from '@web-kits/audio'
import { computed, shallowRef, useTemplateRef } from 'vue'
import { useSuperHover } from 'super-hover/vue'

import type { MediaItem, SubjectType } from '../composables/useBangumi'

import RetroCover from './RetroCover.vue'
import { useLocale } from '../composables/useLocale'

const props = defineProps<{
  loading: boolean
  sections: CollectionSection[]
  subject: SubjectType
}>()
const emit = defineEmits<{
  navigate: []
}>()

const { locale, t } = useLocale()
const hoverSound = defineSound({
  source: { type: 'sine', frequency: { start: 700, end: 500 } },
  envelope: { decay: 0.035 },
  gain: 0.06,
})
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
const columns = computed(() => SUBJECT_COLUMNS[props.subject])
const gridStyle = computed(() => ({
  '--cols': `minmax(0, 1fr) 13rem ${columns.value.map(c => `${COLUMN_WIDTHS[c]}rem`).join(' ')}`,
}))
const detailWidth = computed(() =>
  columns.value.reduce((width, column) => width + COLUMN_WIDTHS[column], 0) + columns.value.length * 0.5 + 1.25,
)
const items = computed(() => props.sections.flatMap(section => section.list))
const active = shallowRef<MediaItem>()
const highlightedSection = shallowRef<keyof Collections>()
const previewY = shallowRef(8)
const scrollingUnlocked = shallowRef(true)
const sessionRef = useTemplateRef<HTMLElement>('session')
const { start: startHighlightTimeout, stop: stopHighlightTimeout } = useTimeoutFn(() => {
  highlightedSection.value = undefined
}, 1000, { immediate: false })

function movePreview(y: number) {
  const root = rootRef.value
  if (!root)
    return
  const rect = root.getBoundingClientRect()
  previewY.value = root.scrollTop + Math.max(8, Math.min(y - rect.top + 12, rect.height - 176))
}

const rootRef = useSuperHover({
  onEnter(event) {
    const element = event.detail.current as HTMLElement | null
    if (!element)
      return
    active.value = items.value[Number(element.dataset.index)]
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

useEventListener(window, 'scroll', () => scrollingUnlocked.value = false, { passive: true })
useEventListener(document, 'pointerdown', (event) => {
  if (!sessionRef.value?.contains(event.target as Node))
    scrollingUnlocked.value = false
}, { capture: true })

function scrollToSection(key: keyof Collections) {
  const root = rootRef.value
  const target = root?.querySelector<HTMLElement>(`#collection-${key}`)
  const header = root?.querySelector<HTMLElement>('.list-grid')
  if (!root || !target || !header)
    return
  root.scrollTo({ top: target.offsetTop - header.offsetHeight })
  stopHighlightTimeout()
  highlightedSection.value = key
  startHighlightTimeout()
  emit('navigate')
}

function sectionLabel(key: keyof Collections) {
  const labels = t.value.subjectLabels as Partial<Record<SubjectType, Partial<Record<keyof Collections, string>>>>
  return labels[props.subject]?.[key] ?? t.value[key]
}

function displayTitle(item: MediaItem) {
  return locale.value === 'zh' && item.titleCn ? item.titleCn : item.title
}

function columnHeader(column: DetailColumn) {
  return { creator: t.value.creator, progress: t.value.progress, score: t.value.rating, year: t.value.aired }[column]
}

function columnValue(item: MediaItem, column: DetailColumn) {
  if (column === 'year')
    return item.date ? item.date.slice(0, 4) : '—'
  if (column === 'score')
    return item.score || '—'
  if (column === 'creator')
    return item.creator || '—'
  return item.total ? `${item.progress}/${item.total}` : `${item.progress} ${t.value.eps}`
}
</script>

<template>
  <div v-if="loading" role="status" aria-label="Loading collections" class="h-[min(60vh,32rem)] min-h-80 overflow-hidden rounded-xl border border-base p-3">
    <div class="mb-4 h-3 w-24 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" />
    <div v-for="row in 9" :key="row" class="grid grid-cols-[minmax(0,1fr)_4rem] gap-6 border-b border-neutral-100 py-3 dark:border-neutral-900">
      <span class="h-3 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" :class="row % 3 === 0 ? 'w-2/3' : 'w-5/6'" />
      <span class="h-3 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900" />
    </div>
    <span class="sr-only">Loading collections…</span>
  </div>

  <div v-else ref="session">
    <nav class="mb-3 flex flex-wrap gap-1" aria-label="Collection categories">
      <a
        v-for="section in sections"
        :key="section.key"
        :href="`#collection-${section.key}`"
        class="category-link text-muted rounded-full px-3 py-1.5 text-xs hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
        :class="{ 'is-highlighted': highlightedSection === section.key }"
        @click.prevent="scrollToSection(section.key)"
      >
        {{ sectionLabel(section.key) }} <span class="text-neutral-400 tabular-nums">{{ section.list.length }}</span>
      </a>
    </nav>

    <div class="relative h-[min(60vh,32rem)] min-h-80 overflow-hidden rounded-xl border border-base">
      <div
        ref="rootRef"
        class="collection-list scroll-fade-b relative h-full"
        :class="scrollingUnlocked ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden'"
      >
        <div class="list-grid sticky top-0 z-20 border-base bg-base border-b px-3 py-1.5 text-[10px] tracking-widest text-neutral-400 backdrop-blur" :style="gridStyle">
          <span>{{ t.title }}</span>
          <span class="preview-column" />
          <span v-for="column in columns" :key="column" class="detail-column" :class="{ 'text-right': column === 'score' }">{{ columnHeader(column) }}</span>
        </div>

        <section v-for="section in sections" :id="`collection-${section.key}`" :key="section.key">
          <h2
            class="section-heading sticky top-[27px] z-10 border-base bg-subtle text-muted border-b px-3 py-1 text-[10px] font-medium tracking-widest backdrop-blur"
            :class="{ 'is-highlighted': highlightedSection === section.key }"
          >
            {{ sectionLabel(section.key) }} · {{ section.list.length }}
          </h2>
          <a
            v-for="(item, index) in section.list"
            :key="item.id"
            :href="item.url"
            target="_blank"
            rel="noopener"
            data-super-hover
            :data-index="section.offset + index"
            class="list-grid border-b border-neutral-100 px-3 py-1 text-xs outline-none transition-colors last:border-b-0 hover:bg-neutral-50 focus-visible:bg-neutral-50 dark:border-neutral-900 dark:hover:bg-neutral-900/60 dark:focus-visible:bg-neutral-900/60"
            :style="gridStyle"
          >
            <span class="truncate text-sm">{{ displayTitle(item) }}</span>
            <span class="preview-column" />
            <span v-for="column in columns" :key="column" class="detail-column tabular-nums" :class="[column === 'score' ? 'text-right text-amber-500' : 'text-neutral-400', column === 'creator' ? 'truncate' : '']">{{ columnValue(item, column) }}</span>
          </a>
        </section>

        <RetroCover
          v-if="active"
          :item="active"
          :transition="false"
          class="preview-card pointer-events-none absolute z-30 hidden h-36 w-28 shadow-xl sm:block"
          :style="{ transform: `translateY(${previewY}px)`, right: `${detailWidth}rem` }"
        />
      </div>

      <button
        v-if="!scrollingUnlocked"
        type="button"
        class="absolute inset-0 z-40 flex cursor-pointer items-center justify-center bg-white/20 text-xs text-neutral-500/70 backdrop-blur-[1.5px] dark:bg-black/20 dark:text-neutral-400/70"
        aria-label="Collection list scrolling locked. Click to enable scrolling inside the list."
        @click="scrollingUnlocked = true"
      >
        Scroll locked · click to unlock
      </button>
    </div>
  </div>
</template>

<style scoped>
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
  from { --scroll-fade-b: min(12%, 2.5rem); }
  to { --scroll-fade-b: 0px; }
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
  .scroll-fade-b { --scroll-fade-b: var(--scroll-fade-size); }
}

.collection-list {
  scroll-behavior: smooth;
  scrollbar-width: thin;
  scrollbar-color: rgb(163 163 163 / 0.4) transparent;
}

.collection-list::-webkit-scrollbar { width: 10px; }
.collection-list::-webkit-scrollbar-track { background: transparent; }
.collection-list::-webkit-scrollbar-thumb {
  background: rgb(163 163 163 / 0.35);
  background-clip: padding-box;
  border: 3px solid transparent;
  border-radius: 9999px;
}

.preview-card { top: 0; }
.category-link,
.section-heading { transition: background-color 180ms ease, color 180ms ease; }
.category-link.is-highlighted { background: rgb(229 229 229); color: rgb(23 23 23); }
.section-heading.is-highlighted { background: rgb(229 229 229 / 0.95); color: rgb(23 23 23); }
:global(.dark) .category-link.is-highlighted { background: rgb(38 38 38); color: rgb(245 245 245); }
:global(.dark) .section-heading.is-highlighted { background: rgb(38 38 38 / 0.95); color: rgb(245 245 245); }

@media (prefers-reduced-motion: reduce) {
  .collection-list { scroll-behavior: auto; }
}

@media (max-width: 639px) {
  .list-grid { grid-template-columns: minmax(0, 1fr) 3rem; }
  .preview-column,
  .detail-column { display: none; }
}
</style>
