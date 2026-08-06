import { onMounted, ref } from 'vue'

export interface NeoItem {
  cover: string | null
  id: string
  score: number
  subjectType: string
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

export function useNeoDB() {
  const collections = ref<NeoCollections>()
  const error = ref('')
  const loading = ref(true)

  onMounted(async () => {
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
  })

  return { collections, error, loading }
}
