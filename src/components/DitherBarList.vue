<script setup lang="ts">
import { DitherGradient, type DitherColor } from 'dither-ui'
import { computed, onMounted, shallowRef } from 'vue'

export interface DitherBarRow {
  label: string
  value: number
  /** optional third column, e.g. average rating */
  hint?: number
}

const props = withDefaults(defineProps<{
  rows: DitherBarRow[]
  color?: DitherColor
  /** header labels for the value / hint columns */
  valueLabel?: string
  hintLabel?: string
}>(), {
  color: 'green',
  valueLabel: 'N',
})

const max = computed(() => Math.max(...props.rows.map(row => row.value), 1))

const mounted = shallowRef(false)
onMounted(() => requestAnimationFrame(() => mounted.value = true))
</script>

<template>
  <div>
    <div v-if="$slots.default || hintLabel" class="mb-3 grid grid-cols-[4rem_1fr_2rem_2.5rem] gap-2 text-[10px] tracking-widest text-neutral-400">
      <span><slot /></span>
      <span />
      <span class="text-right">{{ valueLabel }}</span>
      <span class="text-right">{{ hintLabel }}</span>
    </div>
    <div class="space-y-1.5">
      <div
        v-for="(row, index) in rows"
        :key="row.label"
        class="dither-bar-row grid grid-cols-[4rem_1fr_2rem_2.5rem] items-center gap-2 text-xs"
      >
        <span class="truncate text-neutral-500 transition-colors dark:text-neutral-400" :title="row.label">{{ row.label }}</span>
        <span class="relative block h-3 overflow-hidden rounded-sm bg-neutral-100 dark:bg-neutral-900">
          <span
            class="dither-bar-fill absolute inset-y-0 left-0"
            :class="mounted && 'is-in'"
            :style="{ width: `${row.value / max * 100}%`, '--delay': `${index * 40}ms` }"
          >
            <DitherGradient
              class="h-full w-full"
              :from="color"
              direction="right"
            />
          </span>
        </span>
        <span class="text-right text-neutral-400 tabular-nums">{{ row.value }}</span>
        <span class="text-right text-amber-500 tabular-nums">{{ row.hint ? row.hint.toFixed(1) : '—' }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dither-bar-fill {
  /* clip-path instead of transform: getBoundingClientRect ignores clips, so
     DitherGradient still measures the full layout box (scaleX zeroed it and
     the dither canvas rendered at 4×4). */
  clip-path: inset(0 100% 0 0);
  transition:
    clip-path 320ms cubic-bezier(0.23, 1, 0.32, 1) var(--delay),
    filter 150ms ease;
}

.dither-bar-fill.is-in {
  clip-path: inset(0 0 0 0);
}

.dither-bar-row:hover .dither-bar-fill {
  filter: brightness(1.25) saturate(1.2);
}

.dither-bar-row:hover > span:first-child {
  color: var(--color-neutral-900, #171717);
}

.dark .dither-bar-row:hover > span:first-child {
  color: var(--color-neutral-100, #f5f5f5);
}

@media (prefers-reduced-motion: reduce) {
  .dither-bar-fill {
    transition: filter 150ms ease;
    clip-path: inset(0 0 0 0);
  }
}
</style>
