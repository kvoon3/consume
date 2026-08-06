import { defineCachedHandler } from 'nitro/cache'

// NeoDB shelf types; no on_hold equivalent
const CATEGORIES = {
  completed: 'complete',
  dropped: 'dropped',
  watching: 'progress',
  wish: 'wishlist',
} as const

// NeoDB categories -> normalized client subject types
const SUBJECT_TYPES: Record<string, 1 | 2 | 3 | 4 | 6 | 'podcast'> = {
  book: 1,
  game: 4,
  movie: 6,
  music: 3,
  performance: 6,
  podcast: 'podcast',
  tv: 6,
}

interface MarkEntry {
  created_time: string
  rating_grade: number | null
  tags: string[]
  item: {
    uuid: string
    title: string
    localized_title?: { lang: string, text: string }[]
    cover_image_url: string | null
    tags?: string[] | null
    url: string
    category: string
    credits?: { role: string, name: string }[]
  }
}

async function fetchShelf(instance: string, type: string) {
  const data: MarkEntry[] = []
  let page = 1

  while (true) {
    const url = new URL(`${instance}/api/me/shelf/${type}`)
    url.search = new URLSearchParams({ page: String(page) }).toString()

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${process.env.NEODB_TOKEN}`,
        'User-Agent': 'kvoon3/watch (https://github.com/kvoon3/watch)',
      },
    })
    if (!res.ok)
      throw new Error(`NeoDB API ${res.status}`)

    const result = await res.json() as { data: MarkEntry[], pages: number }
    data.push(...result.data)
    if (page >= result.pages || result.data.length === 0)
      return data
    page++
  }
}

export default defineCachedHandler(async () => {
  if (!process.env.NEODB_TOKEN)
    throw new Error('NEODB_TOKEN is required')

  const instance = (process.env.NEODB_INSTANCE ?? 'https://neodb.social').replace(/\/$/, '')

  return Object.fromEntries(
    await Promise.all(
      Object.entries(CATEGORIES).map(async ([key, type]) => [
        key,
        (await fetchShelf(instance, type))
          .filter(mark => mark.item.category in SUBJECT_TYPES)
          .sort((a, b) => (b.rating_grade || 0) - (a.rating_grade || 0) || b.created_time.localeCompare(a.created_time))
          .map(mark => ({
            cover: mark.item.cover_image_url ?? '',
            creator: mark.item.credits?.find(c => c.role === 'artist')?.name ?? '',
            date: '',
            id: mark.item.uuid,
            progress: 0, // ponytail: progress lives in per-item logs, add when needed
            score: mark.rating_grade ?? 0,
            subjectType: SUBJECT_TYPES[mark.item.category],
            tags: mark.tags,
            title: mark.item.title,
            titleCn: mark.item.localized_title?.find(t => t.lang.startsWith('zh'))?.text ?? mark.item.title,
            total: 0,
            url: `${instance}${mark.item.url}`,
          })),
      ]),
    ),
  )
}, {
  name: 'neodb-v2',
  maxAge: 300,
  swr: true,
})
