import { computed, ref, watchEffect } from 'vue'

type Theme = 'dark' | 'light' | 'system'

const stored = localStorage.getItem('theme')
const theme = ref<Theme>(stored === 'light' || stored === 'dark' ? stored : 'system')
const prefersDark = ref(matchMedia('(prefers-color-scheme: dark)').matches)
matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', e => prefersDark.value = e.matches)

const isDark = computed(() =>
  theme.value === 'dark' || (theme.value === 'system' && prefersDark.value),
)

watchEffect(() => {
  document.documentElement.classList.toggle('dark', isDark.value)
  document.documentElement.style.colorScheme = isDark.value ? 'dark' : 'light'
  localStorage.setItem('theme', theme.value)
})

export function useTheme() {
  function cycle() {
    theme.value = theme.value === 'system' ? 'light' : theme.value === 'light' ? 'dark' : 'system'
  }
  return { cycle, isDark, theme }
}
