// One-time: grab Spotify refresh token
// Usage: pnpm tsx scripts/spotify-auth.ts
// Prereq: add http://127.0.0.1:3210/callback to Redirect URIs in the Spotify dashboard
import http from 'node:http'

const { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = process.env
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET)
  throw new Error('Set SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET in .env')

const PORT = 3210
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`
const SCOPES = 'user-library-read user-top-read user-read-recently-played'

const authUrl = `https://accounts.spotify.com/authorize?${new URLSearchParams({
  client_id: SPOTIFY_CLIENT_ID,
  response_type: 'code',
  redirect_uri: REDIRECT_URI,
  scope: SCOPES,
})}`

console.log(`Open this URL:\n\n${authUrl}\n`)

http.createServer(async (req, res) => {
  const code = new URL(req.url!, REDIRECT_URI).searchParams.get('code')
  if (!code)
    return res.end('Waiting for callback...')

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })
  const data = await tokenRes.json() as { refresh_token?: string, error?: string }

  if (data.refresh_token) {
    console.log(`\nAdd to .env:\nSPOTIFY_REFRESH_TOKEN=${data.refresh_token}`)
    res.end('Done, check your terminal.')
  }
  else {
    console.error(data)
    res.end('Failed, check your terminal.')
  }
  process.exit(data.refresh_token ? 0 : 1)
}).listen(PORT, '127.0.0.1')
