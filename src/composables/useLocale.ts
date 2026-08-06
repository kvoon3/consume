import { computed, ref } from 'vue'

export type Locale = 'en' | 'zh'

const locale = ref<Locale>(localStorage.getItem('locale') === 'en' ? 'en' : 'zh')

const messages = {
  zh: {
    anime: '动画',
    book: '书籍',
    music: '音乐',
    game: '游戏',
    real: '三次元',
    watching: '在看',
    wish: '想看',
    completed: '看过',
    onHold: '搁置',
    dropped: '抛弃',
    title: '标题',
    aired: '年份',
    progress: '进度',
    rating: '评分',
    eps: '话',
    taste: '画像',
    titles: '部',
    era: '年代',
    topTags: '常用标签',
    avg: '均分',
  },
  en: {
    anime: 'Anime',
    book: 'Books',
    music: 'Music',
    game: 'Games',
    real: 'Live action',
    watching: 'Watching',
    wish: 'Wish',
    completed: 'Completed',
    onHold: 'On hold',
    dropped: 'Dropped',
    title: 'title',
    aired: 'aired',
    progress: 'progress',
    rating: 'rating',
    eps: 'eps',
    taste: 'PROFILE',
    titles: 'TITLES',
    era: 'ERA',
    topTags: 'TOP TAGS',
    avg: 'AVG',
  },
} as const

export function useLocale() {
  function toggle() {
    locale.value = locale.value === 'zh' ? 'en' : 'zh'
    localStorage.setItem('locale', locale.value)
  }
  const t = computed(() => messages[locale.value])
  return { locale, t, toggle }
}
