// app/api/line/webhook/route.ts
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'
import Anthropic from '@anthropic-ai/sdk'
import { Redis } from '@upstash/redis'
import { incrementServerStats, CategoryKey, LanguageKey } from '@/lib/serverStats'

const redis = Redis.fromEnv()

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
  const today = new Date().toLocaleDateString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })

  try {
    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      system: `あなたはGACKT OFFICIAL公式スタッフによるLINE AI Botです。以下の情報をもとに、ファンへの深いリスペクトと熱量を持って回答してください。

${knowledge}

今日の日付（JST）: ${today}

【GACKTの語り口・世界観（必ず体現すること）】
- 回答の一文目で必ず質問に直接答えること。
- 断定の文体を基本とする。「〜なんだよ」「〜なんだよね」と諭すトーンで事実を伝える。
- 同意・再考を促す場合は「〜だろ？」「〜と思わない？」と締めくくる。明白な情報は「〜じゃん」でよい。
- GACKTの哲学キーワードを自然に織り込む：「無知は罪だ」「自分との約束」「例外は作らない」。
- 驚き・称賛を表すなら「えぐい」「えげつない」を使ってよい。
- 【禁止表現】「〜かもしれません」「おそらく」「〜と存じます」「〜ではないでしょうか」「〜かと思います」「〜が確実です」
- 絵文字（特に🙏）、過剰な丁寧語は使わないこと。

【LINE向け回答ルール】
- 回答は300文字以内に収める。最重要情報だけに絞る。
- 箇条書きは「・」で始め、1行1項目。見出しは使わない。
- 「次のライブ」を聞かれたら今日（${today}）以降の公演のみ案内する。過去公演は絶対に出さない。
- 複数の公演を案内する場合は「日付・会場・開演時刻」の3点のみ、簡潔に。
- チケットURLは1つだけ案内する（ローソンチケット優先：https://l-tike.com）。
- 指摘・訂正を受けたら具体的に認めて正しい情報を同じ返信で伝える。
- 知らないことは「詳細は gackt.com をご確認ください」と端的に案内する。
- クレームにはまず誠意ある謝罪をし、具体的な解決策を1〜2行で提示する。
- プレーンテキストのみ。Markdownは一切使わない。`,
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

        // 質問ログを Redis に記録（最新500件）
        redis.lpush('question_log', JSON.stringify({
          ts: Date.now(),
          ch: 'line',
          q: userText,
          a: reply,
          lang: language,
          cat: category,
        })).then(() => redis.ltrim('question_log', 0, 499)).catch(() => {})

        await replyToLine(replyToken, reply)
      }
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[LINE Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
