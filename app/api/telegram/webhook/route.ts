// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'
import Anthropic from '@anthropic-ai/sdk'
import { incrementServerStats, CategoryKey, LanguageKey } from '@/lib/serverStats'

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
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

async function generateReply(userMessage: string): Promise<{ reply: string; category: CategoryKey }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { reply: userMessage, category: 'inquiry' }

  const category = classifyMessage(userMessage)

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `あなたはGACKT公式スタッフによるAI Botです。以下の情報をもとに、丁寧かつ簡潔に日本語で回答してください。

${GACKT_KNOWLEDGE}

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
  const incomingSecret = request.headers.get('x-telegram-bot-api-secret-token')
  const expectedSecret = process.env.TELEGRAM_SECRET_TOKEN

  if (expectedSecret && incomingSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const message = body?.message

    if (!message?.text) {
      return NextResponse.json({ ok: true })
    }

    const chatId: number = message.chat.id
    const userText: string = message.text

    const { reply, category } = await generateReply(userText)
    const language = detectLanguage(userText)

    // 統計を記録（fire-and-forget）
    incrementServerStats({ category, language }).catch(() => {})

    await sendTelegramMessage(chatId, reply)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
