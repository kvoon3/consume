import { defineConfig, presetWebFonts, presetWind4 } from 'unocss'

export default defineConfig({
  presets: [
    presetWind4(),
    presetWebFonts({
      fonts: {
        sans: 'Inter:400,500',
      },
    }),
  ],
})
