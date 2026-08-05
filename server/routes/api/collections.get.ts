import { defineCachedHandler } from 'nitro/cache'

const USERNAME = '1140496'

// Bangumi collection types: 1 wish 想看, 2 collect 看过, 3 doing 在看, 4 on_hold 搁置, 5 dropped 抛弃
const CATEGORIES = {
  completed: 2,
  dropped: 5,
  onHold: 4,
  watching: 3,
  wish: 1,
} as const

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
    tags?: { name: string }[]
  }
  updated_at: string
}

async function fetchCategory(type: number) {
  const res = await fetch(
    `https://api.bgm.tv/v0/users/${USERNAME}/collections?subject_type=2&type=${type}&limit=100`,
    {
      headers: {
        'Authorization': `Bearer ${process.env.BANGUMI_TOKEN}`,
        'User-Agent': 'kvoon3/watch (https://github.com/kvoon3/watch)',
      },
    },
  )
  if (!res.ok)
    throw new Error(`Bangumi API ${res.status}`)
  const { data } = await res.json() as { data: CollectionEntry[] }
  data.sort((a, b) => (b.rate || 0) - (a.rate || 0) || b.updated_at.localeCompare(a.updated_at))
  return data.map(e => ({
    cover: e.subject.images.common,
    date: e.subject.date,
    id: e.subject.id,
    progress: e.ep_status,
    score: e.rate,
    siteScore: e.subject.score,
    summary: e.subject.short_summary,
    tags: e.subject.tags?.slice(0, 3).map(t => t.name) ?? [],
    title: e.subject.name_cn || e.subject.name,
    total: e.subject.eps,
    updatedAt: e.updated_at,
    url: `https://bgm.tv/subject/${e.subject.id}`,
  }))
}

export default defineCachedHandler(async () => {
  const entries = await Promise.all(
    Object.entries(CATEGORIES).map(async ([key, type]) => [key, await fetchCategory(type)]),
  )
  return Object.fromEntries(entries)
}, {
  maxAge: 60,
  swr: true,
})
