export type CategoryKey = 'inquiry' | 'ticket_request' | 'announcement_response' | 'complaint' | 'other'
export type LanguageKey = 'ja' | 'en' | 'zh-TW' | 'zh-HK' | 'es' | 'ko' | 'fr' | 'th'

export interface ChatStats {
  totalMessages: number
  categories: Record<CategoryKey, number>
  languages: Record<LanguageKey, number>
}

const STORAGE_KEY = 'gackt-chat-stats-v1'
const STATS_UPDATED_EVENT = 'gackt-chat-stats-updated'

const defaultStats = (): ChatStats => ({
  totalMessages: 0,
  categories: {
    inquiry: 0,
    ticket_request: 0,
    announcement_response: 0,
    complaint: 0,
    other: 0,
  },
  languages: {
    ja: 0,
    en: 0,
    'zh-TW': 0,
    'zh-HK': 0,
    es: 0,
    ko: 0,
    fr: 0,
    th: 0,
  },
})

const isBrowser = () => typeof window !== 'undefined'

export function getStoredStats(): ChatStats {
  if (!isBrowser()) {
    return defaultStats()
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      return defaultStats()
    }

    const parsed = JSON.parse(raw) as Partial<ChatStats>
    return {
      totalMessages: parsed.totalMessages ?? 0,
      categories: {
        ...(defaultStats().categories),
        ...(parsed.categories ?? {}),
      },
      languages: {
        ...(defaultStats().languages),
        ...(parsed.languages ?? {}),
      },
    }
  } catch {
    return defaultStats()
  }
}

export function saveStats(stats: ChatStats) {
  if (!isBrowser()) return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stats))
  window.dispatchEvent(new Event(STATS_UPDATED_EVENT))
}

export function incrementStats(params: { category: CategoryKey; language: LanguageKey }) {
  const stats = getStoredStats()
  stats.totalMessages += 1
  stats.categories[params.category] += 1
  stats.languages[params.language] += 1
  saveStats(stats)
  return stats
}

export function subscribeToStatsUpdates(callback: () => void) {
  if (!isBrowser()) return () => {}
  window.addEventListener(STATS_UPDATED_EVENT, callback)
  return () => window.removeEventListener(STATS_UPDATED_EVENT, callback)
}
