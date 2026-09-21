// Picks items out of the caller's list with Jev (TypeSafe System One).
//
// Two stages, because 79 items plus their summaries is 28k tokens — 89% of Jev's 32k
// budget — and measured worse than a shortlist pass (verified with scripts/pick-probe.ts):
//   stage 1: every candidate on title/tags/status/progress -> top 20
//   stage 2: those 20 with their summaries -> probabilities the client ranks
//
// The client sends the items it is displaying, so what the user sees is exactly what Jev
// judged. The request shape lives in server/utils/jev.ts; how the probabilities become a row
// of discs belongs to the client (src/components/DiscStage.vue).
import { createError, defineEventHandler } from 'nitro/h3'

import type { JevItem } from '../../utils/jev'

import { JE_V_MODEL, JE_V_SHORTLIST, jevAsk, jevItem, jevQuestions, jevState, jevText } from '../../utils/jev'

const MAX_ITEMS = 200
const MAX_PROMPT = 200

function body(value: unknown) {
  const raw = value as Record<string, unknown>
  const prompt = jevText(raw?.prompt, MAX_PROMPT)
  if (!prompt)
    throw createError({ statusCode: 400, statusMessage: 'prompt is required' })
  const items = (Array.isArray(raw?.items) ? raw.items : []).slice(0, MAX_ITEMS).map(jevItem).filter(Boolean) as JevItem[]
  if (items.length === 0)
    throw createError({ statusCode: 400, statusMessage: 'items are required' })
  return { items, prompt }
}

export default defineEventHandler(async (event) => {
  const { items, prompt } = body(await event.req.json())

  const first = await jevAsk({ model: JE_V_MODEL, questions: jevQuestions(items.length, prompt), state: jevState(items, false) })
  const ranked = items
    .map((entry, index) => ({ entry, probability: first.answers[`i${index}`]?.noul ?? 0 }))
    .sort((a, b) => b.probability - a.probability)
  const shortlist = ranked.slice(0, JE_V_SHORTLIST).map(candidate => candidate.entry)

  const second = await jevAsk({ model: JE_V_MODEL, questions: jevQuestions(shortlist.length, prompt), state: jevState(shortlist, true) })
  const picks = shortlist
    .map((entry, index) => ({ id: entry.id, probability: second.answers[`i${index}`]?.noul ?? 0 }))
    .sort((a, b) => b.probability - a.probability)

  return {
    considered: items.length,
    max: picks[0]?.probability ?? 0,
    shortlist: picks,
    usage: { stage1: first.usage.input_tokens, stage2: second.usage.input_tokens },
  }
})
