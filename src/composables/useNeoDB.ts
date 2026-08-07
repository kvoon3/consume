import type { Ref } from 'vue'

import { ref, watch } from 'vue'

import type { SubjectType } from './useBangumi'

interface NeoItem {
  cover: string | null
  id: string
  score: number
  subjectType: SubjectType
  title: string
  titleCn: string
  url: string
}

export interface NeoCollections {
  completed: NeoItem[]
  dropped: NeoItem[]
  watching: NeoItem[]
  wish: NeoItem[]
}

export function useNeoDB(subjectType: Ref<SubjectType>) {
  const collections = ref<NeoCollections>()
  const error = ref('')
  const loading = ref(false)

  watch(subjectType, async (type) => {
    if (type === 2 || collections.value)
      return

    loading.value = true
    try {
      const res = await fetch('/api/neodb')
      if (!res.ok)
        throw new Error(`API ${res.status}`)
      collections.value = await res.json() as NeoCollections
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
    finally {
      loading.value = false
    }
  }, { immediate: true })

  return { collections, error, loading }
}
