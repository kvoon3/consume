<script setup lang="ts">
import { computed } from 'vue'

import type { AnimeItem } from '../composables/useBangumi'

const props = defineProps<{
  dark: boolean
  items: AnimeItem[]
}>()

const columns = computed(() => Array.from({ length: 8 }, (_, column) =>
  props.items.filter((_, index) => index % 8 === column),
))
</script>

<template>
  <div class="cover-backdrop" :class="{ 'is-dark': dark }" aria-hidden="true">
    <div class="backdrop-columns">
      <div
        v-for="(column, index) in columns"
        :key="index"
        class="backdrop-column"
        :class="{ 'backdrop-column-reverse': index % 2 }"
      >
        <template v-for="copy in 2" :key="copy">
          <img
            v-for="item in column"
            :key="`${copy}-${item.id}`"
            :src="item.cover"
            alt=""
            loading="lazy"
            class="backdrop-cover"
          >
        </template>
      </div>
    </div>
    <div class="backdrop-wash" />
    <div class="backdrop-dither" />
  </div>
</template>

<style scoped>
.cover-backdrop {
  position: fixed;
  z-index: 0;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
  background: #fff;
}

.backdrop-columns {
  position: absolute;
  inset: -8rem -2rem;
  display: grid;
  grid-template-columns: repeat(8, 1fr);
  gap: 0.375rem;
  opacity: 0.28;
  filter: grayscale(0.35) saturate(0.7) contrast(1.08);
  mask-image: radial-gradient(ellipse at center, transparent 10%, rgb(0 0 0 / 0.2) 48%, #000 88%);
}

.backdrop-column {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  animation: cover-drift 90s linear infinite;
  will-change: transform;
}

.backdrop-column:nth-child(3n) {
  animation-duration: 105s;
}

.backdrop-column-reverse {
  animation-direction: reverse;
}

.backdrop-cover {
  width: 100%;
  aspect-ratio: 2 / 3;
  flex: none;
  border-radius: 0.25rem;
  object-fit: cover;
}

.backdrop-wash,
.backdrop-dither {
  position: absolute;
  inset: 0;
}

.backdrop-wash {
  background: rgb(255 255 255 / 0.72);
}

.backdrop-dither {
  opacity: 0.16;
  background-image: radial-gradient(circle, rgb(23 23 23 / 0.2) 0.5px, transparent 0.7px);
  background-size: 3px 3px;
  mix-blend-mode: multiply;
}

@keyframes cover-drift {
  from {
    transform: translateY(0);
  }

  to {
    transform: translateY(-50%);
  }
}

.cover-backdrop.is-dark {
  background: #0a0a0a;
}

.cover-backdrop.is-dark .backdrop-columns {
  opacity: 0.34;
  filter: grayscale(0.6) saturate(0.55) brightness(0.78) contrast(1.18);
  mix-blend-mode: luminosity;
}

.cover-backdrop.is-dark .backdrop-wash {
  background: radial-gradient(ellipse at center, rgb(10 10 10 / 0.82), rgb(10 10 10 / 0.58));
}

.cover-backdrop.is-dark .backdrop-dither {
  opacity: 0.08;
  background-image: radial-gradient(circle, rgb(255 255 255 / 0.12) 0.5px, transparent 0.7px);
  mix-blend-mode: normal;
}

@media (max-width: 639px) {
  .backdrop-columns {
    grid-template-columns: repeat(4, 1fr);
  }

  .backdrop-column:nth-child(n + 5) {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .backdrop-column {
    animation: none;
    transform: translateY(-15%);
    will-change: auto;
  }
}
</style>
