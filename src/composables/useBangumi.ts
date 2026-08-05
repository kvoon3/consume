import { onMounted, ref } from 'vue'

export interface AnimeItem {
  cover: string
  date: string
  id: number
  progress: number
  score: number
  tags: string[]
  title: string
  titleCn: string
  total: number
  url: string
}

export interface Collections {
  completed: AnimeItem[]
  dropped: AnimeItem[]
  onHold: AnimeItem[]
  watching: AnimeItem[]
  wish: AnimeItem[]
}

export const CATEGORY_KEYS = ['watching', 'wish', 'completed', 'onHold', 'dropped'] as const

export function useBangumi() {
  const collections = ref<Collections>()
  const loading = ref(true)
  const error = ref('')

  onMounted(async () => {
    try {
      const res = await fetch('/api/collections')
      if (!res.ok)
        throw new Error(`API ${res.status}`)
      collections.value = await res.json() as Collections
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  })

  return { collections, error, loading }
}
