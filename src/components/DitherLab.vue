<script setup lang="ts">
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  DitherAvatar,
  DitherButton,
  DitherGradient,
  Grid,
  Legend,
  Pie,
  PieChart,
  Tooltip,
  XAxis,
  YAxis,
  type ChartConfig,
} from 'dither-ui'

const barData = [
  { type: 'anime', watching: 12, done: 148 },
  { type: 'book', watching: 3, done: 57 },
  { type: 'music', watching: 5, done: 89 },
  { type: 'game', watching: 2, done: 34 },
]
const barConfig: ChartConfig = {
  watching: { label: 'Doing', color: 'blue' },
  done: { label: 'Done', color: 'purple' },
}

const areaData = [
  { month: 'Jan', added: 4 },
  { month: 'Feb', added: 9 },
  { month: 'Mar', added: 6 },
  { month: 'Apr', added: 14 },
  { month: 'May', added: 8 },
  { month: 'Jun', added: 17 },
]
const areaConfig: ChartConfig = {
  added: { label: 'Added', color: 'green' },
}

const pieData = [
  { name: 'anime', value: 160 },
  { name: 'book', value: 60 },
  { name: 'music', value: 94 },
  { name: 'game', value: 36 },
]
const pieConfig: ChartConfig = {
  anime: { label: 'Anime', color: 'blue' },
  book: { label: 'Book', color: 'purple' },
  music: { label: 'Music', color: 'green' },
  game: { label: 'Game', color: 'orange' },
}
</script>

<template>
  <div class="relative min-h-screen p-8 text-base">
    <DitherGradient
      class="pointer-events-none absolute inset-0 -z-10 h-full w-full"
      from="blue" to="transparent" direction="up" :opacity="0.35"
    />

    <h1 class="mb-6 text-lg font-medium">
      dither-ui lab
    </h1>

    <div class="grid max-w-4xl gap-8 md:grid-cols-2">
      <section>
        <h2 class="mb-2 text-muted">
          bar
        </h2>
        <div class="h-64">
          <BarChart :data="barData" :config="barConfig" bloom="low">
            <Grid />
            <XAxis data-key="type" />
            <YAxis />
            <Bar data-key="watching" is-clickable />
            <Bar data-key="done" variant="hatched" is-clickable />
            <Legend is-clickable />
            <Tooltip label-key="type" />
          </BarChart>
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-muted">
          area
        </h2>
        <div class="h-64">
          <AreaChart :data="areaData" :config="areaConfig" bloom="low">
            <Grid />
            <XAxis data-key="month" />
            <YAxis />
            <Area data-key="added" is-clickable />
            <Tooltip label-key="month" />
          </AreaChart>
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-muted">
          pie
        </h2>
        <div class="h-64">
          <PieChart :data="pieData" :config="pieConfig" data-key="value" name-key="name" :inner-radius="0.55" bloom="low">
            <Pie variant="gradient" is-clickable />
            <Legend align="center" is-clickable />
            <Tooltip />
          </PieChart>
        </div>
      </section>

      <section>
        <h2 class="mb-2 text-muted">
          widgets
        </h2>
        <div class="flex items-center gap-6">
          <DitherAvatar name="kvoon" :size="96" animate />
          <DitherAvatar name="consume" :size="96" color="purple" />
          <div class="flex flex-col gap-3">
            <DitherButton color="blue">
              gradient
            </DitherButton>
            <DitherButton color="neutral" variant="hatched">
              hatched
            </DitherButton>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
