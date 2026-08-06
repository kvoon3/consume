import { defineConfig, presetWebFonts, presetWind4 } from 'unocss'

export default defineConfig({
  shortcuts: {
    'icon-btn': 'p-1 rounded-full text-neutral-500 opacity-75 transition-all duration-150 hover:opacity-100 active:scale-90 dark:text-neutral-400',
  },
  presets: [
    presetWind4(),
    presetWebFonts({
      fonts: {
        sans: 'Inter:400,500',
      },
    }),
  ],
})
