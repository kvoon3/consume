import { useDark } from '@vueuse/core'

// The app's `.dark` class on <html> is UnoCSS's `dark:` variant contract
// (preset-wind4 defaults `options.dark` to "class"); the token overrides in
// styles.css and `color-scheme` hang off that same class.
//
// `useDark` == `useColorMode` + a boolean view of it: it stores the preference
// (auto/light/dark), resolves it against the OS, and its setter collapses an
// override back to `auto` whenever it would just duplicate the system theme. So
// only two states exist — follow the OS, or show the other one — and a stored
// preference can never go stale.
//
// Legacy builds stored 'system' for what vueuse calls 'auto'. An unrecognised
// value means "follow the OS" either way, so dropping it is the whole migration.
const stored = localStorage.getItem('theme')
if (stored && !['auto', 'light', 'dark'].includes(stored))
  localStorage.removeItem('theme')

const isDark = useDark({ storageKey: 'theme' })

export function useTheme() {
  // On `auto` this pins the opposite of the OS; on an override it hands control back.
  function toggle() {
    isDark.value = !isDark.value
  }
  return { isDark, toggle }
}
