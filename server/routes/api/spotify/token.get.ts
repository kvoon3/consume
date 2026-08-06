import { defineHandler } from 'nitro/h3'
import { getSpotifyAccessToken } from '../../../utils/spotify'

export default defineHandler(async () => {
  if (!process.env.SPOTIFY_REFRESH_TOKEN)
    throw new Error('SPOTIFY_REFRESH_TOKEN is required')
  const { access_token, expires_in } = await getSpotifyAccessToken()
  return { expiresIn: expires_in, token: access_token }
})
