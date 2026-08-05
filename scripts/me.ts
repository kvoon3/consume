// Print my current Bangumi watching list — `pnpm me`
const token = process.env.VITE_BANGUMI_TOKEN
  ?? (await import('node:fs')).readFileSync(new URL('../.env', import.meta.url), 'utf8').match(/VITE_BANGUMI_TOKEN=(\S+)/)?.[1]

const res = await fetch('https://api.bgm.tv/v0/users/1140496/collections?subject_type=2&type=3&limit=30', {
  headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'kvoon/ani-showcase' },
})
const { data } = await res.json() as { data: any[] }
for (const e of data)
  console.log(`${e.subject.name_cn || e.subject.name}  ${e.ep_status}/${e.subject.eps}`)
