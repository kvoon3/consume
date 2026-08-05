import { onMounted, ref } from 'vue'

export interface AnimeItem {
  cover: string
  date: string
  id: number
  progress: number
  score: number
  siteScore: number
  summary: string
  title: string
  total: number
  updatedAt: string
  url: string
}

export interface Collections {
  completed: AnimeItem[]
  dropped: AnimeItem[]
  onHold: AnimeItem[]
  watching: AnimeItem[]
  wish: AnimeItem[]
}

export const CATEGORY_LABELS: Record<keyof Collections, string> = {
  watching: '在看',
  wish: '想看',
  completed: '看过',
  onHold: '搁置',
  dropped: '抛弃',
}

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
