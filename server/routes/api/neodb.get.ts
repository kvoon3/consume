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
    brief?: string
    description?: string
    cover_image_url: string | null
    pub_year?: number | string
    rating?: number
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
        'User-Agent': 'kvoon3/consume (https://github.com/kvoon3/consume)',
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
            // Same three fields the Bangumi side carries for the pick: which shelf it is on, the
            // site's average score, and something to read (NeoDB keeps the short one in `brief`).
            category: key,
            cover: mark.item.cover_image_url ?? '',
            creator: mark.item.credits?.find(c => ['artist', 'host', 'developer', 'director'].includes(c.role))?.name ?? '',
            date: String(mark.item.pub_year ?? ''),
            id: mark.item.uuid,
            progress: 0, // ponytail: progress lives in per-item logs, add when needed
            rating: mark.item.rating ?? 0,
            score: mark.rating_grade ?? 0,
            subjectType: SUBJECT_TYPES[mark.item.category],
            summary: mark.item.brief || mark.item.description || '',
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
  name: 'neodb-v3',
  maxAge: 86400,
  swr: true,
})
