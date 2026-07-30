// app/api/line/webhook/route.ts
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
