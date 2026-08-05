<script setup lang="ts" vapor>
defineProps<{
  cover: string
  progress?: number
  score?: number
  title: string
  total?: number
  url: string
}>()
</script>

<template>
  <a
    :href="url"
    target="_blank"
    rel="noopener"
    class="group relative block overflow-hidden rounded-xl aspect-[2/3] bg-neutral-200 dark:bg-neutral-800"
  >
    <img
      :src="cover"
      :alt="title"
      loading="lazy"
      class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
    >
    <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-3 pt-10">
      <p class="truncate text-sm text-white font-medium">
        {{ title }}
      </p>
      <template v-if="progress !== undefined">
        <div class="mt-1.5 h-1 overflow-hidden rounded-full bg-white/25">
          <div
            class="h-full rounded-full bg-emerald-400"
            :style="{ width: total ? `${Math.min(100, progress / total * 100)}%` : '0%' }"
          />
        </div>
        <p class="mt-1 text-xs text-white/70">
          {{ progress }}{{ total ? ` / ${total}` : '' }}
        </p>
      </template>
      <p v-else-if="score" class="mt-1 text-xs text-amber-300">
        <span class="i-ph:star-fill inline-block" /> {{ score }}
      </p>
    </div>
  </a>
</template>
