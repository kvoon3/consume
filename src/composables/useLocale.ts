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
    pickMore: '换一批',
    // Rotating placeholder: one per job (what have I seen, what comes next, what do I drop).
    pickHints: ['回顾一下看过什么', '帮我挑下一部', '把搁置的清理一下'],
    // One ask per job, short, and without punctuation inside a sentence — they are read, not parsed.
    pickTips: [
      '我想找点轻松的看看',
      '有没有看完心情能变好的',
      '来点能一口气看完的短篇',
      '来点宏大一点的太空歌剧',
      '看过的里面哪几部评价最高',
      '想重温一部看过的精品',
      '看过的里面哪几部最值得推荐',
      '还没开始的先看哪一部好',
      '有哪些搁置的可以丢掉了',
      '弃坑的有没有还值得再试一试',
    ],
    pickEmpty: '没挑出什么',
    pickError: '没挑成',
    pickThinking: '正在挑…',
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
    pickMore: 'More tips',
    pickHints: ['look back at what I finished', 'pick what comes next', 'clear out what I stalled on'],
    pickTips: [
      'something light to wind down with',
      'something that will lift my mood',
      'a short one I can finish tonight',
      'hard sci-fi as grand as it gets',
      'the best rated ones I already finished',
      'something well made to watch again',
      'what I finished that is worth sharing',
      'which unwatched one should be next',
      'which of my on holds to just drop',
      'what I dropped that deserves another try',
    ],
    pickEmpty: 'Nothing stood out',
    pickError: 'Pick failed',
    pickThinking: 'Picking…',
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
