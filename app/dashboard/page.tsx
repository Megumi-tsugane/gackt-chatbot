'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

function BarRow({ label, value, max, color = '#8B0000' }: { label: string; value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between text-sm">
        <span style={{ color: '#ccc' }}>{label}</span>
        <span className="font-semibold tabular-nums" style={{ color }}>
          {value} <span style={{ color: '#666', fontWeight: 400 }}>({pct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>(defaultStats())
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const fetchStats = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/stats')
      if (res.ok) {
        const data = await res.json()
        setStats(data)
        setLastUpdated(new Date())
      }
    } catch {
      // サイレントフォールバック
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 30000)
    return () => clearInterval(interval)
  }, [])

  const topLang = Object.entries(stats.languages).sort((a, b) => b[1] - a[1])
  const topCat = Object.entries(CATEGORY_LABELS).map(([key, label]) => ({
    key,
    label,
    value: stats.categories[key] ?? 0,
  }))
  const maxCat = Math.max(...topCat.map(c => c.value), 1)
  const maxLang = Math.max(...topLang.map(([, v]) => v), 1)

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <div className="min-h-screen" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <div className="mx-auto flex max-w-5xl flex-col gap-6 px-6 py-10">

        {/* Header */}
        <header className="rounded-2xl border px-6 py-6 flex items-start justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div>
            <p className="text-sm uppercase tracking-[0.3em]" style={{ color: '#8B0000' }}>GACKT Dashboard</p>
            <h1 className="mt-2 text-3xl font-semibold">メッセージ統計</h1>
            <p className="mt-2 text-sm" style={{ color: '#aaa' }}>
              Web・LINE・Telegram のメッセージが自動集計されます。30秒ごとに更新。
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Link
              href="/"
              className="text-xs px-3 py-1.5 rounded-full border transition-colors"
              style={{ borderColor: '#5C0000', color: '#8B0000' }}
            >
              ← チャットに戻る
            </Link>
            <button
              onClick={fetchStats}
              disabled={refreshing}
              className="text-xs px-3 py-1.5 rounded-full border transition-colors"
              style={{ borderColor: '#5C0000', color: refreshing ? '#555' : '#8B0000' }}
            >
              {refreshing ? '更新中…' : '今すぐ更新'}
            </button>
            {lastUpdated && (
              <span className="text-[11px]" style={{ color: '#555' }}>
                最終更新: {formatTime(lastUpdated)}
              </span>
            )}
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid gap-4 grid-cols-2 md:grid-cols-3">
          <div className="col-span-2 md:col-span-1 rounded-2xl border p-6 flex flex-col justify-between" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: '#aaa' }}>合計メッセージ</p>
            <p className="mt-3 text-5xl font-bold tabular-nums" style={{ color: '#8B0000' }}>{stats.totalMessages}</p>
          </div>
          {topCat.slice(0, 4).map(({ key, label, value }) => (
            <div key={key} className="rounded-2xl border p-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
              <p className="text-xs" style={{ color: '#aaa' }}>{label}</p>
              <p className="mt-2 text-3xl font-semibold tabular-nums" style={{ color: '#8B0000' }}>{value}</p>
              <p className="mt-1 text-xs" style={{ color: '#555' }}>
                {stats.totalMessages > 0 ? `${Math.round((value / stats.totalMessages) * 100)}%` : '—'}
              </p>
            </div>
          ))}
        </section>

        {/* Category breakdown */}
        <section className="rounded-2xl border p-6 flex flex-col gap-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold">カテゴリ別内訳</h2>
          {topCat.map(({ key, label, value }) => (
            <BarRow key={key} label={label} value={value} max={maxCat} />
          ))}
        </section>

        {/* Language breakdown */}
        <section className="rounded-2xl border p-6 flex flex-col gap-5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <h2 className="text-lg font-semibold">言語別内訳</h2>
          {topLang.map(([key, value]) => (
            <BarRow
              key={key}
              label={LANGUAGE_LABELS[key as keyof typeof LANGUAGE_LABELS] ?? key}
              value={value}
              max={maxLang}
              color={key === 'ja' ? '#8B0000' : '#5C3A3A'}
            />
          ))}
        </section>

      </div>
    </div>
  )
}
