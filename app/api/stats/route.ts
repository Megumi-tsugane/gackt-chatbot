// app/api/stats/route.ts
// Web / LINE / Telegram の統計を一元管理する REST エンドポイント

import { NextRequest, NextResponse } from 'next/server'
import { getServerStats, incrementServerStats, CategoryKey, LanguageKey } from '@/lib/serverStats'

/** GET /api/stats — ダッシュボード用に全統計を返す */
export async function GET() {
  const stats = await getServerStats()
  return NextResponse.json(stats)
}

/** POST /api/stats — カウンターを +1 する */
export async function POST(request: NextRequest) {
  try {
    const { category, language } = await request.json()
    if (!category || !language) {
      return NextResponse.json({ error: 'category and language are required' }, { status: 400 })
    }
    await incrementServerStats({ category: category as CategoryKey, language: language as LanguageKey })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[/api/stats] POST error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
