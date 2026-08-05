// app/api/telegram/webhook/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'
import Anthropic from '@anthropic-ai/sdk'
import { Redis } from '@upstash/redis'
import { incrementServerStats, CategoryKey, LanguageKey } from '@/lib/serverStats'

const redis = Redis.fromEnv()

type HistoryItem = { role: 'user' | 'assistant'; content: string }

/** Redis から会話履歴を取得（最大6件＝3往復） */
async function getHistory(chatId: number): Promise<HistoryItem[]> {
  try {
    const data = await redis.get<HistoryItem[]>(`tg:hist:${chatId}`)
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

/** Redis に会話履歴を保存（1時間TTL、最大6件） */
async function saveHistory(chatId: number, history: HistoryItem[]): Promise<void> {
  try {
    await redis.set(`tg:hist:${chatId}`, history.slice(-6), { ex: 3600 })
  } catch {
    // 保存失敗は無視
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

async function generateReply(
  userMessage: string,
  history: HistoryItem[],
): Promise<{ reply: string; category: CategoryKey }> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return { reply: 'しばらくお待ちください。', category: 'inquiry' }

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
      system: `あなたはAI GACKTです。以下の情報をもと、GACKTとして直接ファンに語りかけてください。

${GACKT_KNOWLEDGE}

今日の日付（JST）: ${today}

【GACKTの語り口・世界観（必ず体現すること）】
- 回答の一文目で必ず質問に直接答えること。
- 断定の文体を基本とする。「〜なんだよ」「〜なんだよね」と諭すトーンで事実を伝える。
- 基本は断定で締める。「〜だろ？」「〜と想わない？」は多用しない（2〜3回に1回程度）。明白な情報は「〜じゃん」でよい。
- GACKTの哲学キーワードを自然に織り込む：「無知は罪だ」「自分との約束」「例外は作らない」。
- 驚き・称賛を表すなら「えぐい」「えげつない」を使ってよい。
- 【表記ルール（必ず守ること）】自分のことは「ボク」、相手は「オマエ」、「思う」は「想う」と書くこと。
- 【禁止表現】「〜かもしれません」「おそらく」「〜と存じます」「〜ではないでしょうか」「〜かと思います」「が確実です」
- 絵文字（特に🙏）、過剰な丁寧語は使わないこと。

【回答ルール】
- 「次のライブ」「今後の公演」「これからのライブ」を聞かれた場合は、今日（${today}）以降の公演のみ案内する。過去公演は絶対に出さない。
- ライブ情報・公演日程・チケットURLは、ライブ/チケット/公演につて明示的に質問された場合にのみ案内する。関係ない質問の返答に勝手に付け加えないこと。
- 指摘・訂正を受けたら具体的に認めて、同じ返信内で正しい情報を伝える。
- 会話履歴が存在する場合は必ず参照すること。ユーザーが以前の話題に言及したら具体的に引用して返すこと。同じ内容・URLを繰り返すな。
- 回答は200文字前後を目安に、短く刺さる言葉を心がけること。最大400文字以内。
- 回答はプレーンテキストのみ。Markdownは使わない。
- 知らないことは「gackt.com で確認してくれ」と端的に案内する。
- クレームや不満には、まず誠意ある謝罪をし、具体的な解決策を提示すること。`,
      messages: [
        ...history,
        { role: 'user', content: userMessage },
      ],
    })
    const reply = response.content.map(c => ('text' in c ? c.text : '')).join('')
    return { reply, category }
  } catch {
    return { reply: 'しばらくお待ちください。', category }
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

    // 会話履歴を取得
    const history = await getHistory(chatId)

    const { reply, category } = await generateReply(userText, history)
    const language = detectLanguage(userText)

    // 履歴を更新して保存
    const updatedHistory: HistoryItem[] = [
      ...history,
      { role: 'user', content: userText },
      { role: 'assistant', content: reply },
    ]
    await saveHistory(chatId, updatedHistory)

    // 統計を記録（fire-and-forget）
    incrementServerStats({ category, language }).catch(() => {})

    // 質問ログを Redis に記録（最新500件）
    redis.lpush('question_log', JSON.stringify({
      ts: Date.now(),
      ch: 'telegram',
      q: userText,
      a: reply,
      lang: language,
      cat: category,
    })).then(() => redis.ltrim('question_log', 0, 499)).catch(() => {})

    await sendTelegramMessage(chatId, reply)

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Webhook] Error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
