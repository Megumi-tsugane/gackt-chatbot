import { NextRequest, NextResponse } from 'next/server'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'
import Anthropic from '@anthropic-ai/sdk'

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

async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
}

async function generateReply(userMessage: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return userMessage
  try {
    const anthropic = new Anthropic({ apiKey })
    const today = new Date().toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    })
    const knowledge = await fetchLiveKnowledge()
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `あなたはGACKTのファン向け公式サポートアシスタントです。以下の情報をもとに、丁寧かつ簡潔に日本語で回答してください。\n\n今日の日付：${today}\n\n${knowledge}\n\n【厳守ルール】\n- 回答はプレーンテキストのみ。Markdownは使わない。\n- 「最新のライブ」「次のライブ」と聞かれたら、今日の日付より後に開演する公演のうち最も近いものだけを答える。\n- 今日より前に開演したライブ・イベント（生誕祭・LAST SONGSなど）は絶対に「最新」「次」として案内しない。\n- アーカイブ配信・U-NEXT・動画配信のお知らせはライブ情報として扱わない。\n- 過去のイベントを聞かれたら「すでに終了しました」と伝える。\n- 知らないことは「gackt.com でご確認ください」と案内する。`,
      messages: [{ role: 'user', content: userMessage }],
    })
    return response.content.map(c => ('text' in c ? c.text : '')).join('')
  } catch { return userMessage }
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
    if (!message?.text) return NextResponse.json({ ok: true })
    const chatId: number = message.chat.id
    const userText: string = message.text
    const reply = await generateReply(userText)
    await sendTelegramMessage(chatId, reply)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
