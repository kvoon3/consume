import { computed, ref } from 'vue'

type Locale = 'en' | 'zh'

const locale = ref<Locale>(localStorage.getItem('locale') === 'zh' ? 'zh' : 'en')

const messages = {
  zh: {
    anime: '动画',
    book: '书籍',
    music: '音乐',
    podcast: '播客',
    game: '游戏',
    real: '三次元',
    watching: '在看',
    wish: '想看',
    completed: '看过',
    subjectLabels: {
      1: { watching: '在读', wish: '想读', completed: '读过' },
      3: { watching: '在听', wish: '想听', completed: '听过' },
      4: { watching: '在玩', wish: '想玩', completed: '玩过' },
    },
    onHold: '搁置',
    dropped: '抛弃',
    title: '标题',
    aired: '年份',
    creator: '创作者',
    progress: '进度',
    rating: '评分',
    eps: '话',
    taste: '画像',
    topTracks: '热门曲目',
    topArtists: '热门艺人',
    titles: '部',
    era: '年代',
    categories: '分类',
    scoreDist: '评分分布',
    topTags: '常用标签',
    avg: '均分',
    scrollLocked: '滚动已锁定 · 点击解锁',
    pile: '碟堆',
    pick: '此刻想看点什么？',
  },
  en: {
    anime: 'Anime',
    book: 'Books',
    music: 'Music',
    podcast: 'Podcasts',
    game: 'Games',
    real: 'Live action',
    watching: 'Watching',
    wish: 'Wish',
    completed: 'Completed',
    subjectLabels: {
      1: { watching: 'Reading', wish: 'Want to read', completed: 'Read' },
      3: { watching: 'Listening', wish: 'Want to listen', completed: 'Listened' },
      4: { watching: 'Playing', wish: 'Want to play', completed: 'Played' },
    },
    onHold: 'On hold',
    dropped: 'Dropped',
    title: 'title',
    aired: 'aired',
    creator: 'creator',
    progress: 'progress',
    rating: 'rating',
    eps: 'eps',
    taste: 'PROFILE',
    topTracks: 'TOP TRACKS',
    topArtists: 'TOP ARTISTS',
    titles: 'TITLES',
    era: 'ERA',
    categories: 'CATEGORIES',
    scoreDist: 'RATINGS',
    topTags: 'TOP TAGS',
    avg: 'AVG',
    scrollLocked: 'Scroll locked · click to unlock',
    pile: 'THE FLOOR',
    pick: 'What are you in the mood for?',
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
