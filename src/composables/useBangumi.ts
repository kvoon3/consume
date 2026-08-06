import { onMounted, ref } from 'vue'

export type SubjectType = 1 | 2 | 3 | 4 | 6

export interface MediaItem {
  cover: string
  creator?: string
  date: string
  id: number | string
  progress: number
  score: number
  subjectType: SubjectType
  tags: string[]
  title: string
  titleCn: string
  total: number
  url: string
}

export interface Collections {
  completed: MediaItem[]
  dropped: MediaItem[]
  onHold: MediaItem[]
  watching: MediaItem[]
  wish: MediaItem[]
}

export const CATEGORY_KEYS = ['watching', 'wish', 'completed', 'onHold', 'dropped'] as const
export const SUBJECT_TYPES: SubjectType[] = [2, 1, 3, 4, 6]

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
