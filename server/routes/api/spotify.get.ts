import { defineCachedHandler } from 'nitro/cache'

async function getAccessToken() {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN!,
    }),
  })
  if (!res.ok)
    throw new Error(`Spotify token ${res.status}`)
  return (await res.json() as { access_token: string }).access_token
}

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok)
    throw new Error(`Spotify API ${res.status}`)
  return res.json() as Promise<T>
}

interface Artist { name: string, images: { url: string }[], external_urls: { spotify: string }, genres: string[] }
interface Track { name: string, artists: { name: string }[], album: { name: string, images: { url: string }[] }, external_urls: { spotify: string } }

export default defineCachedHandler(async () => {
  if (!process.env.SPOTIFY_REFRESH_TOKEN)
    throw new Error('SPOTIFY_REFRESH_TOKEN is required')

  const token = await getAccessToken()

  const [artists, tracks, recent] = await Promise.all([
    spotifyGet<{ items: Artist[] }>('/me/top/artists?limit=20&time_range=medium_term', token),
    spotifyGet<{ items: Track[] }>('/me/top/tracks?limit=20&time_range=medium_term', token),
    spotifyGet<{ items: { track: Track, played_at: string }[] }>('/me/player/recently-played?limit=20', token),
  ])

  return {
    topArtists: artists.items.map(a => ({
      cover: a.images[0]?.url ?? '',
      tags: a.genres,
      title: a.name,
      url: a.external_urls.spotify,
    })),
    topTracks: tracks.items.map(t => ({
      artist: t.artists.map(a => a.name).join(', '),
      cover: t.album.images[0]?.url ?? '',
      title: t.name,
      url: t.external_urls.spotify,
    })),
    recentlyPlayed: recent.items.map(r => ({
      artist: r.track.artists.map(a => a.name).join(', '),
      cover: r.track.album.images[0]?.url ?? '',
      playedAt: r.played_at,
      title: r.track.name,
      url: r.track.external_urls.spotify,
    })),
  }
}, {
  maxAge: 300,
  swr: true,
})
