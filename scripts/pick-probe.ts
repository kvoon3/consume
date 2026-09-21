// Probe: can Jev pick the right items out of my real Bangumi list from a Chinese prompt?
// Measures CJK accuracy, the value of `short_summary` in state, shortlist recall, and where
// the thresholds should sit. It shares the request shape with /api/pick (server/utils/jev.ts),
// so it always measures the wording and fields that actually ship.
// Usage: pnpm exec tsx scripts/pick-probe.ts          (all prompts)
//        PROMPTS='提示词一|提示词二' pnpm exec tsx scripts/pick-probe.ts
import { setDefaultResultOrder } from 'node:dns'
import { readFileSync } from 'node:fs'

import type { JevCategory, JevItem } from '../server/utils/jev'

import { JE_V_MODEL, JE_V_SHORTLIST, JE_V_STATUS, jevAsk, jevQuestions, jevState } from '../server/utils/jev'

// api.bgm.tv resolves to AAAA first; this machine's IPv6 route resets, curl works over IPv4.
setDefaultResultOrder('ipv4first')

function env(name: string): string {
  const fromProcess = process.env[name]
  if (fromProcess)
    return fromProcess
  const line = readFileSync(new URL('../.env', import.meta.url), 'utf8').match(new RegExp(`^${name}=(\\S+)`, 'm'))
  if (!line)
    throw new Error(`${name} is not set`)
  return line[1]
}

process.env.TYPESAFE_API_KEY ??= env('TYPESAFE_API_KEY')
const BANGUMI_TOKEN = env('BANGUMI_TOKEN')
const USER_AGENT = 'kvoon3/consume (https://github.com/kvoon3/consume)'
const PRICE_PER_BTOKEN = 42

// Bangumi collection types: 1 wish 想看, 2 collect 看过, 3 doing 在看, 4 on_hold 搁置, 5 dropped 抛弃
const CATEGORY: Record<number, JevCategory> = { 1: 'wish', 2: 'completed', 3: 'watching', 4: 'onHold', 5: 'dropped' }

async function bangumiCollections(subjectType: number) {
  const data: any[] = []
  for (;;) {
    const url = `https://api.bgm.tv/v0/users/1140496/collections?limit=50&offset=${data.length}&subject_type=${subjectType}`
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${BANGUMI_TOKEN}`, 'User-Agent': USER_AGENT } })
    if (!res.ok)
      throw new Error(`Bangumi ${res.status}`)
    const page = await res.json() as { data: any[], total: number }
    data.push(...page.data)
    if (data.length >= page.total || page.data.length === 0)
      return data
  }
}

function toItems(entries: any[]): JevItem[] {
  return entries.map((entry) => {
    const subject = entry.subject
    const books = subject.type === 1
    return {
      category: CATEGORY[entry.type],
      id: subject.id,
      progress: books ? entry.vol_status : entry.ep_status,
      rating: subject.score,
      summary: subject.short_summary ?? '',
      tags: (subject.tags ?? []).map((tag: any) => tag.name),
      title: subject.name,
      titleZh: subject.name_cn,
      total: books ? subject.volumes : subject.eps,
      year: (subject.date ?? '').slice(0, 4),
    }
  })
}

async function ask(state: { items: unknown[] }, prompt: string) {
  const started = Date.now()
  const response = await jevAsk({ model: JE_V_MODEL, questions: jevQuestions(state.items.length, prompt), state })
  return { ...response, ms: Date.now() - started }
}

type Result = Awaited<ReturnType<typeof ask>>

function ranked(items: JevItem[], response: Result) {
  return items
    .map((item, index) => ({ item, probability: response.answers[`i${index}`]?.noul ?? 0 }))
    .sort((a, b) => b.probability - a.probability)
}

let spend = 0

function report(label: string, items: JevItem[], response: Result) {
  const picks = ranked(items, response)
  const thresholds = [0.3, 0.5, 0.7].map(t => `>${t}: ${String(picks.filter(p => p.probability > t).length).padStart(2)}`).join('   ')
  spend += response.usage.input_tokens * PRICE_PER_BTOKEN / 1e9
  const cost = response.usage.input_tokens * PRICE_PER_BTOKEN / 1e9
  console.log(`  ${label.padEnd(20)} ${String(response.ms).padStart(5)}ms  in=${String(response.usage.input_tokens).padStart(5)}tok  $${cost.toFixed(6)}   ${thresholds}   max=${picks[0].probability.toFixed(2)}`)
  for (const { item, probability } of picks.slice(0, 5))
    console.log(`      ${probability.toFixed(2)}  ${(item.titleZh || item.title).slice(0, 20).padEnd(22)} ${(JE_V_STATUS[item.category] ?? item.category).padEnd(16)} ${`${item.progress}/${item.total}`.padEnd(7)} ${item.tags.slice(0, 4).join(' ')}`)
  return picks
}

const PROMPTS = process.env.PROMPTS ? process.env.PROMPTS.split('|') : [
  '我想看一些轻松的还没看过的动画',
  '最近想看点治愈日常向的，最好还只是「想看」',
  '有没有悬疑烧脑、一口气能看完的短篇',
  '我想重温一部看过的、制作精良的剧场版',
  '太空歌剧或硬核科幻，越宏大越好',
  '关于棒球社团的音乐剧动画',
]

const items = toItems(await bangumiCollections(2))
const distribution = Object.entries(items.reduce<Record<string, number>>((acc, item) => ({ ...acc, [item.category]: (acc[item.category] ?? 0) + 1 }), {}))
console.log(`${items.length} anime | summary 覆盖 ${items.filter(item => item.summary).length} 条 | 状态: ${distribution.map(([key, count]) => `${key}=${count}`).join(' ')}\n`)

const ids = (picks: { item: JevItem }[]) => new Set(picks.slice(0, 5).map(pick => pick.item.id))
const overlap = (a: Set<unknown>, b: Set<unknown>) => [...a].filter(id => b.has(id)).length

for (const prompt of PROMPTS) {
  console.log(`── ${prompt}`)
  const bare = await ask(jevState(items, false), prompt)
  const pickedBare = report('title+tags', items, bare)
  const full = await ask(jevState(items, true), prompt)
  const pickedFull = report('+summary', items, full)
  console.log(`      top5 重叠 bare↔full ${overlap(ids(pickedBare), ids(pickedFull))}/5`)

  // Cascade: cheap pass over everything, then re-ask the shortlist with summaries.
  const shortlist = pickedBare.slice(0, JE_V_SHORTLIST).map(pick => pick.item)
  const second = await ask(jevState(shortlist, true), prompt)
  report(`cascade→${JE_V_SHORTLIST}`, shortlist, second)

  // Recall: anything the one-shot pass liked but stage 1 dropped is unreachable.
  const shortlistIds = new Set(shortlist.map(item => item.id))
  console.log(`      stage-1 召回: one-shot top5 里 ${pickedFull.slice(0, 5).filter(pick => shortlistIds.has(pick.item.id)).length}/5 进了短名单\n`)
}

console.log(`总花费 $${spend.toFixed(6)} (${PROMPTS.length * 3} 次调用)`)
