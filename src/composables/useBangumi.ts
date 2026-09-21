import type { Ref } from 'vue'

import { ref, watch } from 'vue'

export type SubjectType = 1 | 2 | 3 | 4 | 6 | 'podcast'

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
export const SUBJECT_TYPES: SubjectType[] = [2, 1, 3, 'podcast', 4, 6]

const emptyCollections = (): Collections => ({ completed: [], dropped: [], onHold: [], watching: [], wish: [] })

// Nitro answers with `{ statusMessage }`; show that when it is there, so a failure reads as
// something other than "API 500".
async function failure(res: Response) {
  const body = await res.json().catch(() => undefined) as { statusMessage?: string } | undefined
  return body?.statusMessage || `API ${res.status}`
}

export function useBangumi(subjectType: Ref<SubjectType>) {
  const collections = ref<Collections>()
  const loading = ref(true)
  const error = ref('')
  const cache = new Map<SubjectType, Collections>()

  watch(subjectType, async (type, _previous, onCleanup) => {
    error.value = ''
    const cached = cache.get(type)
    if (cached) {
      collections.value = cached
      loading.value = false
      return
    }
    if (typeof type !== 'number') {
      collections.value = emptyCollections()
      loading.value = false
      return
    }

    const controller = new AbortController()
    onCleanup(() => controller.abort())
    loading.value = true
    try {
      const res = await fetch(`/api/collections?subject_type=${type}`, { signal: controller.signal })
      if (!res.ok)
        throw new Error(await failure(res))
      const data = await res.json() as Collections
      cache.set(type, data)
      collections.value = data
    }
    catch (e) {
      if (!controller.signal.aborted)
        error.value = e instanceof Error ? e.message : String(e)
    }
    finally {
      if (!controller.signal.aborted)
        loading.value = false
    }
  }, { immediate: true })

  return { collections, error, loading }
}
