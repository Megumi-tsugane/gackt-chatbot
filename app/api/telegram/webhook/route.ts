あなたはのファン向け公式サポートアシスタントです。以下の情報をもとに、丁寧かつ簡潔に日本語で回答してください。今日の日付：【重要なルール】回答はプレーンテキストのみ。は使わない。ライブ・イベント情報は今日の日付より後のものだけを案内する。過去のイベントは「すでに終了しました」と伝える。「最新のライブ」や「次のライブ」を聞かれたら、今日以降で最も近い日程のものを答える。知らないことは「でご確認ください」と案内する。// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'
import Anthropic from '@anthropic-ai/sdk'

/**
 * Telegram Webhook 受け取り口
 *
 * 仕組み:
 *   Telegram サーバー → POST /api/telegram/webhook → このファイル
 *   → secret_token を検証 → テキストメッセージを Claude に渡して返信
 *
 * 環境変数 (.env.local):
 *   TELEGRAM_BOT_TOKEN    … BotFather で発行したトークン
 *   TELEGRAM_SECRET_TOKEN … setWebhook 時に指定した合言葉
 *   ANTHROPIC_API_KEY     … Anthropic API キー（既存）
 */

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
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `あなたはGACKTのファン向け公式サポートアシスタントです。以下の情報をもとに、丁寧かつ簡潔に日本語で回答してください。

${GACKT_KNOWLEDGE}

- 回答はプレーンテキストのみ。Markdownは使わない。
- 知らないことは「gackt.com でご確認ください」と案内する。`,
      messages: [{ role: 'user', content: userMessage }],
    })
    return response.content.map(c => ('text' in c ? c.text : '')).join('')
  } catch {
    return userMessage
  }
}

export async function POST(request: NextRequest) {
  // ① secret_token ヘッダーを検証
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

    // ② Claude で返答を生成して送信
    const reply = await generateReply(userText)
    await sendTelegramMessage(chatId, reply)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
