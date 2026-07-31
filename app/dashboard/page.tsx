'use client'

import { useEffect, useState } from 'react'

const CATEGORY_LABELS = {
  inquiry: '問い合わせ',
  ticket_request: 'チケット希望',
  announcement_response: '告知反応',
  complaint: 'クレーム',
  other: 'その他',
} as const

const LANGUAGE_LABELS = {
  ja: '日本語',
  en: 'English',
  'zh-TW': '繁體中文',
  'zh-HK': '廣東話',
  es: 'Español',
  ko: '한국어',
  fr: 'Français',
  th: 'ไทย',
} as const

type Stats = {
  totalMessages: number
  categories: Record<string, number>
  languages: Record<string, number>
}

function defaultStats(): Stats {
  return {
    totalMessages: 0,
    categories: { inquiry: 0, ticket_request: 0, announcement_response: 0, complaint: 0, other: 0 },
    languages: { ja: 0, en: 0, 'zh-TW': 0, 'zh-HK': 0, es: 0, ko: 0, fr: 0, th: 0 },
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>(defaultStats())

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch('/api/stats')
        if (res.ok) {
          const data = await res.json()
          setStats(data)
        }
      } catch {
        // サイレントフォールバック
      }
    }
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10">
        <header className="rounded-2xl border px-6 py-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <p className="text-sm uppercase tracking-[0.3em]" style={{ color: '#8B0000' }}>GACKT Dashboard</p>
          <h1 className="mt-2 text-3xl font-semibold">メッセージ統計</h1>
          <p className="mt-2 text-sm" style={{ color: '#aaa' }}>
            Web・LINE・Telegramのメッセージが自動で集計されます。
          </p>
        </header>
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: '#aaa' }}>合計メッセージ件数</p>
            <p className="mt-3 text-4xl font-semibold" style={{ color: '#8B0000' }}>{stats.totalMessages}</p>
          </div>
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
            <div key={key} className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <p className="text-sm" style={{ color: '#aaa' }}>{label}</p>
              <p className="mt-3 text-3xl font-semibold" style={{ color: '#8B0000' }}>{stats.categories[key] ?? 0}</p>
            </div>
          ))}
        </section>
        <section className="rounded-2xl border p-6" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-xl font-semibold">言語別件数</h2>
          <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(LANGUAGE_LABELS).map(([key, label]) => (
              <div key={key} className="rounded-xl border p-4" style={{ background: 'var(--surface-alt)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <span>{label}</span>
                  <span className="text-lg font-semibold" style={{ color: '#8B0000' }}>{stats.languages[key] ?? 0}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
