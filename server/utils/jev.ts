// Jev (TypeSafe System One) request shape, shared by /api/pick and scripts/pick-probe.ts.
//
// The probe exists to re-measure this pipeline against the real list, so the question
// wording and the `state` fields live here: if they drifted apart, the probe would only
// ever measure its own copy.
const TYPESAFE_URL = 'https://api.typesafe.ai/v1/systemone'
const MAX_TAGS = 10
const MAX_SUMMARY = 300

export const JE_V_MODEL = 'jev-latest'
export const JE_V_SHORTLIST = 20

// These two strings are the question, not decoration. They were measured (see the probe);
// reword them and the probabilities move.
const TRUE_MEANS = 'The mood, theme and genre match the request, AND every condition the request states about watched-status or progress is satisfied'
const FALSE_MEANS = 'Wrong mood/theme/genre, or a stated condition about watched-status or progress is not satisfied, or the request asks for something this item is not'

export const JE_V_STATUS = {
  completed: 'completed (看过)',
  dropped: 'dropped (抛弃)',
  onHold: 'on_hold (搁置)',
  watching: 'doing (在看)',
  wish: 'wish (想看)',
} as const

export type JevCategory = keyof typeof JE_V_STATUS

export interface JevItem {
  category: JevCategory
  id: number | string
  progress: number
  rating: number
  summary: string
  tags: string[]
  title: string
  titleZh: string
  total: number
  year: string
}

export interface JevAnswers {
  answers: Record<string, { noul?: number }>
  usage: { input_tokens: number }
}

export function jevText(value: unknown, limit: number) {
  return typeof value === 'string' ? value.replaceAll(/[\r\n\t]+/g, ' ').trim().slice(0, limit) : ''
}

// /api/pick takes items from the client, so this is a trust boundary: re-type and clamp.
export function jevItem(value: unknown): JevItem | undefined {
  const raw = value as Record<string, unknown>
  const id = raw.id
  if (typeof id !== 'number' && typeof id !== 'string')
    return undefined
  const category = raw.category as JevCategory
  if (!(category in JE_V_STATUS))
    return undefined
  return {
    category,
    id: typeof id === 'string' ? id.slice(0, 64) : id,
    progress: typeof raw.progress === 'number' && raw.progress > 0 ? Math.floor(raw.progress) : 0,
    rating: typeof raw.rating === 'number' && Number.isFinite(raw.rating) ? Math.min(10, Math.max(0, raw.rating)) : 0,
    summary: jevText(raw.summary, MAX_SUMMARY),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, MAX_TAGS).map(tag => jevText(tag, 32)).filter(Boolean) : [],
    title: jevText(raw.title, 160),
    titleZh: jevText(raw.titleZh, 160),
    total: typeof raw.total === 'number' && raw.total > 0 ? Math.floor(raw.total) : 0,
    year: jevText(raw.year, 8),
  }
}

export function jevState(items: JevItem[], withSummary: boolean) {
  return {
    items: items.map(item => ({
      title: item.title,
      title_zh: item.titleZh,
      year: item.year,
      rating: item.rating,
      tags: item.tags,
      status: JE_V_STATUS[item.category],
      progress: `${item.progress}/${item.total}`,
      ...(withSummary ? { summary: item.summary } : {}),
    })),
  }
}

export function jevQuestions(count: number, prompt: string) {
  return Object.fromEntries(Array.from({ length: count }, (_, index) => [`i${index}`, {
    type: 'noul',
    instructions: `Does \`items[${index}]\` satisfy this request: "${prompt}"?`,
    criteria: { true: TRUE_MEANS, false: FALSE_MEANS },
  }]))
}

export async function jevAsk(payload: unknown): Promise<JevAnswers> {
  const key = process.env.TYPESAFE_API_KEY
  if (!key)
    throw new Error('TYPESAFE_API_KEY is not set')
  const body = JSON.stringify(payload)
  const headers = { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(TYPESAFE_URL, { body, headers, method: 'POST', signal: AbortSignal.timeout(30000) })
    if (res.ok)
      return await res.json() as JevAnswers
    // Overload is routine upstream; wait it out rather than showing the user an error.
    if ((res.status === 429 || res.status === 529) && attempt < 4) {
      const after = Number(res.headers.get('retry-after'))
      await new Promise(resolve => setTimeout(resolve, Number.isFinite(after) && after > 0 ? after * 1000 : 600 * 2 ** attempt))
      continue
    }
    throw new Error(`TypeSafe ${res.status}: ${(await res.text()).slice(0, 200)}`)
  }
}
