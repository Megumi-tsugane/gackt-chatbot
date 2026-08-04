// app/api/stats/questions/route.ts
// 質問ログ取得エンドポイント（最新100件）
// Redis キー: "question_log" (lpush で新しい順)

import { NextResponse } from 'next/server'
import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

export interface QuestionLogEntry {
  ts: number        // Unix ms
  ch: string        // 'web' | 'line' | 'telegram'
  q: string         // ユーザーの質問
  a: string         // ボットの回答
  lang: string      // 言語コード
  cat: string       // カテゴリ
}

/** GET /api/stats/questions — 最新100件の質問ログを返す */
export async function GET() {
  try {
    const raw = await redis.lrange('question_log', 0, 99)
    const logs: QuestionLogEntry[] = raw.map((item) => {
      if (typeof item === 'string') {
        try { return JSON.parse(item) } catch { return item }
      }
      return item
    })
    return NextResponse.json({ logs, total: await redis.llen('question_log') })
  } catch (err) {
    console.error('[/api/stats/questions] GET error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
