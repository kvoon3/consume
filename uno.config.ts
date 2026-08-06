import { defineConfig, presetWebFonts, presetWind4 } from 'unocss'

export default defineConfig({
  shortcuts: {
    'bg-base': 'bg-white dark:bg-neutral-950',
    'bg-subtle': 'bg-neutral-50 dark:bg-neutral-900',
    'border-base': 'border-neutral-200 dark:border-neutral-800',
    'text-base': 'text-neutral-900 dark:text-neutral-100',
    'text-muted': 'text-neutral-500 dark:text-neutral-400',
    'icon-btn': 'p-1 rounded-full text-muted opacity-75 transition-all duration-150 hover:opacity-100 active:scale-90',
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
