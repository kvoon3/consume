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

interface CollectionEntry {
  ep_status: number
  rate: number
  subject: {
    date: string
    eps: number
    id: number
    images: { common: string }
    name: string
    name_cn: string
    score: number
    short_summary: string
  }
  updated_at: string
}

const USERNAME = '1140496'

export function useBangumi() {
  const watching = ref<AnimeItem[]>([])
  const completed = ref<AnimeItem[]>([])
  const loading = ref(true)
  const error = ref('')

  onMounted(async () => {
    try {
      const [w, c] = await Promise.all([
        fetchCollections(3, 30),
        fetchCollections(2, 6),
      ])
      watching.value = w
      completed.value = c.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    } finally {
      loading.value = false
    }
  })

  return { completed, error, loading, watching }
}

async function fetchCollections(type: number, limit: number): Promise<AnimeItem[]> {
  const res = await fetch(
    `https://api.bgm.tv/v0/users/${USERNAME}/collections?subject_type=2&type=${type}&limit=${limit}`,
    {
      headers: {
        'Authorization': `Bearer ${import.meta.env.VITE_BANGUMI_TOKEN}`,
        'User-Agent': 'kvoon/ani-showcase',
      },
    },
  )
  if (!res.ok)
    throw new Error(`Bangumi API ${res.status}`)
  const json = await res.json() as { data: CollectionEntry[] }
  return json.data.map(e => ({
    cover: e.subject.images.common,
    date: e.subject.date,
    id: e.subject.id,
    progress: e.ep_status,
    score: e.rate,
    siteScore: e.subject.score,
    summary: e.subject.short_summary,
    title: e.subject.name_cn || e.subject.name,
    total: e.subject.eps,
    updatedAt: e.updated_at,
    url: `https://bgm.tv/subject/${e.subject.id}`,
  }))
}
