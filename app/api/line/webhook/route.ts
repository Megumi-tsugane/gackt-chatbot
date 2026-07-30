あなたはのファン向け公式サポートアシスタントです。以下の情報をもとに、丁寧かつ簡潔に日本語で回答してください。今日の日付：【厳守ルール】回答はプレーンテキストのみ。は使わない。「最新のライブ」「次のライブ」と聞かれたら、今日の日付より後に開演する公演のうち最も近いものだけを答える。今日より前に開演したライブ・イベント（生誕祭・など）は絶対に「最新」「次」として案内しない。アーカイブ配信・・動画配信のお知らせはライブ情報として扱わない。過去のイベントを聞かれたら「すでに終了しました」と伝える。知らないことは「でご確認ください」と案内する。あなたはのファン向け公式サポートアシスタントです。以下の情報をもとに、丁寧かつ簡潔に日本語で回答してください。今日の日付：【重要なルール】回答はプレーンテキストのみ。は使わない。ライブ・イベント情報は今日の日付より後のものだけを案内する。過去のイベントは「すでに終了しました」と伝える。「最新のライブ」や「次のライブ」を聞かれたら、今日以降で最も近い日程のものを答える。知らないことは「でご確認ください」と案内する。// app/api/line/webhook/route.ts
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'
import Anthropic from '@anthropic-ai/sdk'

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

    for (const event of events) {
      if (event.type === 'message' && event.message?.type === 'text') {
        const userText = event.message.text
        const replyToken = event.replyToken
        const reply = await generateReply(userText)
        await replyToLine(replyToken, reply)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[LINE Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
