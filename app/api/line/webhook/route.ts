// app/api/line/webhook/route.ts
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'
import Anthropic from '@anthropic-ai/sdk'
import { incrementServerStats, CategoryKey, LanguageKey } from '@/lib/serverStats'

async function fetchLiveKnowledge(): Promise<string> {
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'https://gackt-chatbot.vercel.app'
    const res = await fetch(`${baseUrl}/api/knowledge`, { next: { revalidate: 3600 } })
    if (!res.ok) throw new Error(`knowledge fetch failed: ${res.status}`)
    const data = await res.json()
    return typeof data.knowledge === 'string' && data.knowledge.trim()
      ? data.knowledge
      : GACKT_KNOWLEDGE
  } catch {
    return GACKT_KNOWLEDGE
  }
}

async function replyToLine(replyToken: string, text: string): Promise<void> {
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN
  await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: 'text', text }],
    }),
  })
}

// テキストからカテゴリを簡易判定
function classifyMessage(text: string): CategoryKey {
  const t = text.toLowerCase()
  if (/チケット|ticket|ライブ|live|concert|チケ/.test(t)) return 'ticket_request'
  if (/告知|ニュース|news|お知らせ|新曲|アルバム|リリース/.test(t)) return 'announcement_response'
  if (/不満|怒|苦情|批判|返金|キャンセル|refund|cancel|complaint|angry|dissatisfied|disappointed|terrible|不便|失望/.test(t)) return 'complaint'
  return 'inquiry'
}

// テキストから言語を簡易判定
function detectLanguage(text: string): LanguageKey {
  if (/[ぁ-んァ-ン]/.test(text)) return 'ja'
  if (/[가-힣]/.test(text)) return 'ko'
  if (/[一-龯]/.test(text)) return 'zh-TW'
  return 'en'
}

async function generateReply(userMessage: string, knowledge: string): Promise<{ reply: string; category: CategoryKey }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { reply: userMessage, category: 'inquiry' }

  const category = classifyMessage(userMessage)

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `あなたはGACKT公式スタッフによるAI Botです。以下の情報をもとに、丁寧かつ簡潔に日本語で回答してください。

${knowledge}

- 回答はプレーンテキストのみ。Markdownは使わない。
- 知らないことは「gackt.com でご確認ください」と案内する。
- クレームや不満には、まず謝罪し、具体的な解決策を提示してください。`,
      messages: [{ role: 'user', content: userMessage }],
    })
    const reply = response.content.map(c => ('text' in c ? c.text : '')).join('')
    return { reply, category }
  } catch {
    return { reply: userMessage, category }
  }
}

export async function POST(request: NextRequest) {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN

  if (!channelSecret || !accessToken) {
    console.error('[LINE Webhook] Missing credentials')
    return NextResponse.json({ error: 'LINE credentials not configured' }, { status: 500 })
  }

  const rawBody = await request.text()
  const signature = request.headers.get('x-line-signature')

  const expectedSignature = crypto
    .createHmac('sha256', channelSecret)
    .update(rawBody)
    .digest('base64')

  if (!signature || signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  try {
    const { events } = JSON.parse(rawBody) as {
      events: Array<{
        type: string
        replyToken: string
        message?: { type: string; text: string }
      }>
    }

    const knowledge = await fetchLiveKnowledge()

    for (const event of events) {
      if (event.type === 'message' && event.message?.type === 'text') {
        const userText = event.message.text
        const replyToken = event.replyToken

        const { reply, category } = await generateReply(userText, knowledge)
        const language = detectLanguage(userText)

        // 統計を記録（fire-and-forget）
        incrementServerStats({ category, language }).catch(() => {})

        await replyToLine(replyToken, reply)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[LINE Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
