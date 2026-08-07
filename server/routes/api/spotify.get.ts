import { defineCachedHandler } from 'nitro/cache'
import { getSpotifyAccessToken } from '../../utils/spotify'

async function spotifyGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok)
    throw new Error(`Spotify API ${res.status}`)
  return res.json() as Promise<T>
}

interface Artist { name: string, images: { url: string }[], external_urls: { spotify: string }, genres: string[] }
interface Track { uri: string, name: string, artists: { name: string }[], album: { name: string, images: { url: string }[] }, external_urls: { spotify: string } }

function lowQualityImage(images: { url: string }[]) {
  return images[images.length - 1]?.url ?? ''
}

export default defineCachedHandler(async () => {
  if (!process.env.SPOTIFY_REFRESH_TOKEN)
    throw new Error('SPOTIFY_REFRESH_TOKEN is required')

  const { access_token: token } = await getSpotifyAccessToken()

  const [artists, tracks] = await Promise.all([
    spotifyGet<{ items: Artist[] }>('/me/top/artists?limit=20&time_range=medium_term', token),
    spotifyGet<{ items: Track[] }>('/me/top/tracks?limit=20&time_range=medium_term', token),
  ])

  return {
    topArtists: artists.items.map(a => ({
      cover: lowQualityImage(a.images),
      tags: a.genres ?? [],
      title: a.name,
      url: a.external_urls.spotify,
    })),
    topTracks: tracks.items.map(t => ({
      artist: t.artists.map(a => a.name).join(', '),
      cover: lowQualityImage(t.album.images),
      title: t.name,
      uri: t.uri,
      url: t.external_urls.spotify,
    })),
  }
}, {
  maxAge: 86400,
  swr: true,
})
