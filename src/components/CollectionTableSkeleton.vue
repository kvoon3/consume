<template>
  <div role="status" aria-label="Loading collections" class="h-[min(60vh,32rem)] min-h-80 overflow-hidden rounded-xl border border-base p-3">
    <div class="mb-4 h-3 w-24 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" />
    <div v-for="row in 9" :key="row" class="grid grid-cols-[minmax(0,1fr)_4rem] gap-6 border-b border-neutral-100 py-3 dark:border-neutral-900">
      <span class="h-3 animate-pulse rounded bg-neutral-200 motion-reduce:animate-none dark:bg-neutral-800" :class="row % 3 === 0 ? 'w-2/3' : 'w-5/6'" />
      <span class="h-3 animate-pulse rounded bg-neutral-100 motion-reduce:animate-none dark:bg-neutral-900" />
    </div>
    <span class="sr-only">Loading collections…</span>
  </div>
</template>
