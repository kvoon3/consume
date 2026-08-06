import { onMounted, ref } from 'vue'

export interface SpotifyArtist {
  cover: string
  tags: string[]
  title: string
  url: string
}

export interface SpotifyTrack {
  artist: string
  cover: string
  playedAt?: string
  title: string
  url: string
}

export interface SpotifyData {
  recentlyPlayed: SpotifyTrack[]
  topArtists: SpotifyArtist[]
  topTracks: SpotifyTrack[]
}

export function useSpotify() {
  const data = ref<SpotifyData>()
  const error = ref('')
  const loading = ref(true)

  onMounted(async () => {
    try {
      const res = await fetch('/api/spotify')
      if (!res.ok)
        throw new Error(`API ${res.status}`)
      data.value = await res.json() as SpotifyData
    }
    catch (e) {
      error.value = e instanceof Error ? e.message : String(e)
    }
    finally {
      loading.value = false
    }
  })

  return { data, error, loading }
}
