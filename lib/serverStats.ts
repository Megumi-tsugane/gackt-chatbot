// lib/serverStats.ts
// サーバーサイド統計 (Upstash Redis) — Web/LINE/Telegram 共通

import { Redis } from '@upstash/redis'

// Vercel が自動設定する KV_REST_API_URL / KV_REST_API_TOKEN を使用
const redis = Redis.fromEnv()

export type CategoryKey = 'inquiry' | 'ticket_request' | 'announcement_response' | 'complaint' | 'other'
export type LanguageKey = 'ja' | 'en' | 'zh-TW' | 'zh-HK' | 'es' | 'ko' | 'fr' | 'th'

const HASH_KEY = 'gackt:stats'

/** メッセージ1件分のカウンターを加算 */
export async function incrementServerStats(params: {
  category: CategoryKey
  language: LanguageKey
}): Promise<void> {
  const { category, language } = params
  try {
    await Promise.all([
      redis.hincrby(HASH_KEY, 'totalMessages', 1),
      redis.hincrby(HASH_KEY, `cat:${category}`, 1),
      redis.hincrby(HASH_KEY, `lang:${language}`, 1),
    ])
  } catch (err) {
    // 統計失敗は本体の処理を止めない
    console.error('[serverStats] increment failed:', err)
  }
}

/** 全統計を取得 */
export async function getServerStats() {
  try {
    const raw = (await redis.hgetall(HASH_KEY)) as Record<string, string> | null
    const d = raw ?? {}
    const n = (key: string) => parseInt(d[key] ?? '0', 10)

    return {
      totalMessages: n('totalMessages'),
      categories: {
        inquiry:               n('cat:inquiry'),
        ticket_request:        n('cat:ticket_request'),
        announcement_response: n('cat:announcement_response'),
        complaint:             n('cat:complaint'),
        other:                 n('cat:other'),
      },
      languages: {
        ja:       n('lang:ja'),
        en:       n('lang:en'),
        'zh-TW':  n('lang:zh-TW'),
        'zh-HK':  n('lang:zh-HK'),
        es:       n('lang:es'),
        ko:       n('lang:ko'),
        fr:       n('lang:fr'),
        th:       n('lang:th'),
      },
    }
  } catch (err) {
    console.error('[serverStats] getAll failed:', err)
    return defaultStats()
  }
}

function defaultStats() {
  return {
    totalMessages: 0,
    categories: {
      inquiry: 0, ticket_request: 0,
      announcement_response: 0, complaint: 0, other: 0,
    },
    languages: {
      ja: 0, en: 0, 'zh-TW': 0, 'zh-HK': 0,
      es: 0, ko: 0, fr: 0, th: 0,
    },
  }
}
