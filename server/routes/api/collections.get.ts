import { defineCachedHandler } from 'nitro/cache'

const USERNAME = '1140496'
const PAGE_SIZE = 50

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
  vol_status: number
  type: number
  subject: {
    date: string
    eps: number
    id: number
    images: { grid: string }
    name: string
    name_cn: string
    tags?: { name: string }[]
    type: number
    volumes: number
  }
  updated_at: string
}

// Infobox keys used to derive a creator label per subject type
const CREATOR_KEYS: Record<number, string[]> = {
  1: ['作者'],
  2: ['动画制作'],
  3: ['艺术家', '表演者'],
  4: ['开发', '发行商'],
}

function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'User-Agent': 'kvoon3/watch (https://github.com/kvoon3/watch)',
  }
  if (process.env.BANGUMI_TOKEN)
    h.Authorization = `Bearer ${process.env.BANGUMI_TOKEN}`
  return h
}

async function fetchCreators(data: CollectionEntry[]) {
  const ids = [...new Set(
    data.filter(e => e.subject.type in CREATOR_KEYS).map(e => e.subject.id),
  )]
  const creators = new Map<number, string>()

  // ponytail: 10-at-a-time chunks to stay under Bangumi rate limits
  for (let i = 0; i < ids.length; i += 10) {
    await Promise.all(ids.slice(i, i + 10).map(async (id) => {
      const res = await fetch(`https://api.bgm.tv/v0/subjects/${id}`, { headers: headers() })
      if (!res.ok)
        return
      const subject = await res.json() as {
        type: number
        infobox?: { key: string, value: string | { v: string }[] }[]
      }
      const keys = CREATOR_KEYS[subject.type] ?? []
      const hit = subject.infobox?.find(box => keys.includes(box.key))
      const value = Array.isArray(hit?.value) ? hit.value[0]?.v : hit?.value
      if (value)
        creators.set(id, value)
    }))
  }
  return creators
}

async function fetchCollections() {
  const data: CollectionEntry[] = []

  while (true) {
    const url = new URL(`https://api.bgm.tv/v0/users/${USERNAME}/collections`)
    url.search = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(data.length),
    }).toString()

    const headers: Record<string, string> = {
      'User-Agent': 'kvoon3/watch (https://github.com/kvoon3/watch)',
    }
    if (process.env.BANGUMI_TOKEN)
      headers.Authorization = `Bearer ${process.env.BANGUMI_TOKEN}`

    const res = await fetch(url, { headers })
    if (!res.ok)
      throw new Error(`Bangumi API ${res.status}`)

    const page = await res.json() as { data: CollectionEntry[], total: number }
    data.push(...page.data)
    if (data.length >= page.total || page.data.length === 0)
      return data
  }
}

export default defineCachedHandler(async () => {
  const data = await fetchCollections()
  const creators = await fetchCreators(data)
  return Object.fromEntries(
    Object.entries(CATEGORIES).map(([key, type]) => [
      key,
      data
        .filter(entry => entry.type === type)
        .sort((a, b) => (b.rate || 0) - (a.rate || 0) || b.updated_at.localeCompare(a.updated_at))
        .map(entry => ({
          cover: entry.subject.images.grid,
          creator: creators.get(entry.subject.id) ?? '',
          date: entry.subject.date,
          id: entry.subject.id,
          progress: entry.subject.type === 1 ? entry.vol_status : entry.ep_status,
          score: entry.rate,
          subjectType: entry.subject.type,
          tags: entry.subject.tags?.map(tag => tag.name) ?? [],
          title: entry.subject.name,
          titleCn: entry.subject.name_cn,
          total: entry.subject.type === 1 ? entry.subject.volumes : entry.subject.eps,
          url: `https://bgm.tv/subject/${entry.subject.id}`,
        })),
    ]),
  )
}, {
  maxAge: 300,
  swr: true,
})
