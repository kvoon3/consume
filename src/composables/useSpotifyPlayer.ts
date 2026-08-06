import { shallowRef } from 'vue'

export interface PlayableTrack {
  artist: string
  cover: string
  title: string
  uri: string
}

interface SdkPlayer {
  addListener: (event: string, cb: (state: any) => void) => void
  connect: () => Promise<boolean>
  disconnect: () => void
  getCurrentState: () => Promise<any>
  nextTrack: () => Promise<void>
  previousTrack: () => Promise<void>
  setVolume: (v: number) => Promise<void>
  togglePlay: () => Promise<void>
}

declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void
    Spotify?: { Player: new (options: Record<string, unknown>) => SdkPlayer }
  }
}

export const playerTrack = shallowRef<PlayableTrack>()
export const playerPaused = shallowRef(true)
export const playerPosition = shallowRef(0)
export const playerDuration = shallowRef(0)
export const playerVolume = shallowRef(0.3)
export const playerMinimized = shallowRef(true)
export const playerQueue = shallowRef<PlayableTrack[]>([])


let player: SdkPlayer | undefined
let playerPromise: Promise<void> | undefined
let deviceId = ''
let token = ''
let tokenExpiresAt = 0

async function getToken() {
  if (token && Date.now() < tokenExpiresAt)
    return token
  const res = await fetch('/api/spotify/token')
  if (!res.ok)
    throw new Error(`token ${res.status}`)
  const data = await res.json() as { token: string, expiresIn: number }
  token = data.token
  tokenExpiresAt = Date.now() + (data.expiresIn - 60) * 1000
  return token
}

function loadSdk() {
  return new Promise<void>((resolve) => {
    if (window.Spotify)
      return resolve()
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    document.head.appendChild(script)
  })
}

function applyState(state: any) {
  if (!state)
    return
  playerPaused.value = state.paused
  playerPosition.value = state.position
  playerDuration.value = state.duration
  const current = state.track_window?.current_track
  if (current) {
    playerTrack.value = {
      artist: current.artists.map((a: { name: string }) => a.name).join(', '),
      cover: current.album.images[0]?.url ?? '',
      title: current.name,
      uri: current.uri,
    }
  }
}

async function initPlayer() {
  await loadSdk()
  player = new window.Spotify!.Player({
    name: 'watch',
    getOAuthToken: async (cb: (t: string) => void) => cb(await getToken()),
    volume: playerVolume.value,
  })
  const ready = new Promise<void>((resolve, reject) => {
    const fail = (e: { message: string }) => {
      clearTimeout(timer)
      reject(new Error(e.message))
    }
    const timer = setTimeout(() => fail({ message: 'Spotify SDK not ready' }), 10000)
    player!.addListener('ready', ({ device_id }: any) => {
      deviceId = device_id
      clearTimeout(timer)
      resolve()
    })
    player!.addListener('initialization_error', fail)
    player!.addListener('authentication_error', fail)
    player!.addListener('account_error', fail)
  })
  player.addListener('player_state_changed', applyState)
  await player.connect()
  await ready

  setInterval(async () => {
    applyState(await player?.getCurrentState())
  }, 250)
}

function ensurePlayer() {
  // cache the in-flight promise: concurrent callers share one init, failures reset for retry
  playerPromise ??= initPlayer().catch((e) => {
    player?.disconnect()
    player = undefined
    playerPromise = undefined
    deviceId = ''
    throw e
  })
  return playerPromise
}

export async function playQueue(tracks: PlayableTrack[], index = 0) {
  try {
    await ensurePlayer()
    playerQueue.value = tracks
    const token = await getToken()
    const body = JSON.stringify({ uris: tracks.map(t => t.uri), offset: { position: index } })
    const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    let res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, { body, headers, method: 'PUT' })
    // ponytail: device already active -> Spotify 404s on explicit device_id, retry targeting the active device
    if (res.status === 404)
      res = await fetch('https://api.spotify.com/v1/me/player/play', { body, headers, method: 'PUT' })
    if (!res.ok)
      throw new Error(`play ${res.status}`)
  }
  catch (e) {
    console.error('Spotify playback failed:', e)
  }
}

export async function togglePlayer() {
  await player?.togglePlay()
}

export async function nextTrack() {
  await player?.nextTrack()
}

export async function previousTrack() {
  await player?.previousTrack()
}

export async function setVolume(v: number) {
  playerVolume.value = v
  await player?.setVolume(v)
}
