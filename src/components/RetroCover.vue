<script setup lang="ts">
import type { MediaItem } from '../composables/useBangumi'

withDefaults(defineProps<{
  compact?: boolean
  item: MediaItem
  transition?: boolean
}>(), {
  transition: true,
})
</script>

<template>
  <div class="crt-cover box-border" :class="compact ? 'p-1 pb-3' : 'p-2.5 pb-8'">
    <div class="crt-screen relative h-full overflow-hidden">
      <Transition v-if="transition" name="cover-swap">
        <img :key="item.id" :src="item.cover" :alt="item.title" class="crt-image absolute inset-0 size-full object-cover">
      </Transition>
      <img v-else :src="item.cover" :alt="item.title" class="crt-image absolute inset-0 size-full object-cover">
      <span class="crt-scanlines absolute inset-0" aria-hidden="true" />
    </div>
    <span class="mac-brand absolute bottom-[7%] left-[11%] size-[7%] rounded-sm" aria-hidden="true" />
    <span class="mac-slot absolute bottom-[8%] right-[11%] h-[1.5%] w-[32%] rounded-full" aria-hidden="true" />
  </div>
</template>

<style>
.crt-cover {
  border: 1px solid rgb(212 212 212);
  border-radius: 0.7rem 0.7rem 0.45rem 0.45rem;
  background: linear-gradient(135deg, rgb(255 255 255), transparent 32%), linear-gradient(145deg, rgb(250 250 250), rgb(229 229 229));
  box-shadow: 0 14px 28px rgb(0 0 0 / 0.18), inset 2px 2px 0 rgb(255 255 255 / 0.9), inset -2px -2px 0 rgb(163 163 163 / 0.2), inset 0 -1.4rem 0 rgb(212 212 212 / 0.45);
}

.crt-cover::before {
  position: absolute;
  right: 10%;
  bottom: -0.2rem;
  left: 10%;
  z-index: -1;
  height: 0.35rem;
  border-radius: 0 0 0.25rem 0.25rem;
  background: rgb(163 163 163);
  content: '';
}

.dark .crt-cover {
  border-color: rgb(38 38 38);
  background: linear-gradient(135deg, rgb(255 255 255 / 0.1), transparent 30%), linear-gradient(145deg, rgb(82 82 78), rgb(38 38 35));
  box-shadow: 0 14px 28px rgb(0 0 0 / 0.5), inset 2px 2px 0 rgb(255 255 255 / 0.12), inset -2px -2px 0 rgb(0 0 0 / 0.45), inset 0 -1.4rem 0 rgb(23 23 21 / 0.38);
}

.dark .crt-cover::before {
  background: rgb(23 23 23);
}

.crt-screen {
  border: 2px solid rgb(64 64 64);
  border-radius: 12% / 8%;
  background: rgb(10 10 10);
  box-shadow: -2px -2px 0 rgb(163 163 163), 2px 2px 0 rgb(255 255 255 / 0.9), 0 0 0 4px rgb(212 212 212), 0 0 0 5px rgb(255 255 255 / 0.2), inset 0 0 22px 6px rgb(0 0 0 / 0.82), inset 3px 3px 6px rgb(0 0 0 / 0.7), inset -2px -2px 5px rgb(255 255 255 / 0.12);
}

.crt-screen::after {
  position: absolute;
  inset: 0;
  z-index: 2;
  border-radius: inherit;
  background: radial-gradient(ellipse at 38% 24%, rgb(255 255 255 / 0.24), transparent 38%), radial-gradient(ellipse at center, transparent 35%, rgb(0 0 0 / 0.52) 100%);
  content: '';
}

.dark .crt-screen {
  border-color: rgb(23 23 23);
  box-shadow: -2px -2px 0 rgb(38 38 36), 2px 2px 0 rgb(115 115 108 / 0.45), 0 0 0 4px rgb(64 64 60), 0 0 0 5px rgb(255 255 255 / 0.05), inset 0 0 22px 6px rgb(0 0 0 / 0.88), inset 3px 3px 6px rgb(0 0 0 / 0.8), inset -2px -2px 5px rgb(255 255 255 / 0.08);
}

.crt-image {
  border-radius: inherit;
  filter: contrast(1.08) saturate(0.88);
  transform: scale(1.09);
}

.crt-scanlines {
  z-index: 1;
  border-radius: inherit;
  background: radial-gradient(ellipse at center, transparent 48%, rgb(0 0 0 / 0.38) 100%), repeating-linear-gradient(to bottom, transparent 0 2px, rgb(0 0 0 / 0.2) 2px 3px);
}

.mac-brand {
  border: 1px solid rgb(115 115 115 / 0.55);
  background: linear-gradient(to bottom, #68a9d2 0 20%, #7bb862 20% 40%, #e7c457 40% 60%, #df8a4e 60% 80%, #c8665b 80%);
  box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.2);
}

.mac-slot {
  background: rgb(82 82 82 / 0.75);
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.3);
}

.dark .mac-slot {
  background: rgb(10 10 10 / 0.85);
  box-shadow: 0 1px 0 rgb(255 255 255 / 0.1);
}

.cover-swap-enter-active,
.cover-swap-leave-active {
  transition: opacity 180ms ease, transform 180ms ease, filter 180ms ease;
}

.cover-swap-enter-from,
.cover-swap-leave-to {
  opacity: 0;
  filter: brightness(1.6) contrast(0.7);
  transform: scale(1.14);
}

@media (prefers-reduced-motion: reduce) {
  .cover-swap-enter-active,
  .cover-swap-leave-active {
    transition: none;
  }
}
</style>
