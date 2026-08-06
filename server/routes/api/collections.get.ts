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

async function fetchCollections(subjectType: number) {
  const data: CollectionEntry[] = []

  while (true) {
    const url = new URL(`https://api.bgm.tv/v0/users/${USERNAME}/collections`)
    url.search = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(data.length),
      subject_type: String(subjectType),
    }).toString()

    const headers: Record<string, string> = {
      'User-Agent': 'kvoon3/consume (https://github.com/kvoon3/consume)',
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

export default defineCachedHandler(async (event) => {
  const subjectType = Number(new URL(event.req.url).searchParams.get('subject_type'))
  if (![1, 2, 3, 4, 6].includes(subjectType))
    throw new Error('Invalid subject_type')

  const data = await fetchCollections(subjectType)
  return Object.fromEntries(
    Object.entries(CATEGORIES).map(([key, type]) => [
      key,
      data
        .filter(entry => entry.type === type)
        .sort((a, b) => (b.rate || 0) - (a.rate || 0) || b.updated_at.localeCompare(a.updated_at))
        .map(entry => ({
          cover: entry.subject.images.grid,
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
  name: 'collections-v3',
  maxAge: 300,
  swr: true,
})
