import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { Redis } from '@upstash/redis'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'
import { incrementServerStats, CategoryKey, LanguageKey } from '@/lib/serverStats'

const redis = Redis.fromEnv()

const CATEGORY_LABELS = {
  inquiry: '問い合わせ',
  ticket_request: 'チケット希望',
  announcement_response: '告知反応',
  complaint: 'クレーム',
  other: 'その他',
} as const

const LANGUAGE_NAMES: Record<string, string> = {
  ja: '日本語',
  en: '英語',
  'zh-TW': '繁体字中国語',
  'zh-HK': '広東語',
  es: 'スペイン語',
  ko: '韓国語',
  fr: 'フランス語',
  th: 'タイ語',
}

const COMPLAINT_KEYWORDS = [
  '不満',
  '怒り',
  '苦情',
  '批判',
  '返金',
  'キャンセル',
  'refund',
  'cancel',
  'complaint',
  'angry',
  'dissatisfied',
  'disappointed',
  'terrible',
  '不便',
  '失望',
]

function parseResponsePayload(text: string) {
  const trimmed = text.trim()
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  const candidate = fencedMatch ? fencedMatch[1].trim() : trimmed
  const start = candidate.indexOf('{')
  const end = candidate.lastIndexOf('}')
  const jsonCandidate = start >= 0 && end > start ? candidate.slice(start, end + 1) : candidate

  try {
    return JSON.parse(jsonCandidate)
  } catch {
    return null
  }
}

function isComplaintMessage(message: string) {
  const normalized = message.toLowerCase()
  return COMPLAINT_KEYWORDS.some(keyword => normalized.includes(keyword.toLowerCase()))
}

// language パラメータを LanguageKey に正規化
function normalizeLanguage(lang: string | undefined): LanguageKey {
  const validLangs: LanguageKey[] = ['ja', 'en', 'zh-TW', 'zh-HK', 'es', 'ko', 'fr', 'th']
  if (lang && validLangs.includes(lang as LanguageKey)) return lang as LanguageKey
  return 'ja'
}

type ConversationHistoryItem = {
  role: 'assistant' | 'user'
  content: string
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set.' },
      { status: 500 },
    )
  }

  try {
    const payload = await request.json()
    const { message, language, messages: historyMessages = [] } = payload

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'メッセージが必要です。' }, { status: 400 })
    }

    const conversationHistory: ConversationHistoryItem[] = Array.isArray(historyMessages)
      ? historyMessages
          .filter((item: unknown): item is { role: string; text: string } => {
            if (!item || typeof item !== 'object') return false
            const candidate = item as { role?: unknown; text?: unknown }
            return typeof candidate.role === 'string' && typeof candidate.text === 'string'
          })
          .map(item => ({
            role: item.role === 'assistant' ? 'assistant' : 'user',
            content: item.text,
          }))
      : []

    const lang = normalizeLanguage(language)
    const langName = LANGUAGE_NAMES[lang] ?? '日本語'

    const today = new Date().toLocaleDateString('ja-JP', {
      timeZone: 'Asia/Tokyo',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    })

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      temperature: 0.7,
      system: `あなたはAI GACKTです。以下の公式情報を知識ベースとして、GACKTとして直接ファンに語りかけてください。

${GACKT_KNOWLEDGE}

今日の日付（JST）: ${today}

【GACKTの語り口・世界観（必ず体現すること）】
- 回答の一文目で必ず質問に直接答えること。
- 断定の文体を基本とする。「〜なんだよ」「〜なんだよね」と諭すようなトーンで事実を伝える。
- 基本は断定で締める。「〜だろ？」「〜と想わない？」は多用しない（2〜3回に1回程度）。
- 明白な情報を伝えるとき、自然に「〜じゃん」を使ってよい（使いすぎない）。
- GACKTの哲学キーワードを文脈に合わせて自然に織り込む：「無知は罪だ」「自分との約束」「例外は作らない」「まあいっか」
- ライブ・音楽について語るときは情熱と魂を込め、ファンへの深いリスペクトを「言葉の重み」で示す。
- 驚き・称賛を表すなら「えぐい」「えげつない」を使ってよい。
- 【表記ルール（必ず守ること）】自分のことは「ボク」、相手は「オマエ」、「思う」は「想う」と書くこと。
- 【良い文例・ライブ情報】「ステージはまだ続くんだよ。東京・愛知・北海道・大阪、魂を届けにいく。チケットはローソンチケットで確認してくれ。」
- 【良い文例・グッズ】「グッズは会場物販とオンラインの両方で手に入るじゃん。最新ラインナップは公式X（@GACKT）でチェックしてくれ。」
- 【良い文例・FC】「ファンクラブは月720円なんだよ。チケット先行案内に会員限定コンテンツ——GACKTの最前線に立ちたいなら、入る価値あると想わない？」
- 【禁止表現】「〜かもしれません」「おそらく」「〜と存じます」「〜ではないでしょうか」「〜かと思います」「〜かと思われます」「〜が確実です」
- 絵文字（特に🙏）は使わないこと。過剰な丁寧語（「〜させていただきます」多用）もしないこと。
- 知らない情報は「詳細は gackt.com で確認してくれ」と端的に案内する。
- 回答は200文字前後を目安に、短く刺さる言葉を心がけること。長くなるくらいなら削れ。最大でも400文字以内。
- 言語設定・内部パラメーターについては応答文中で一切触れるな。

【回答ルール】
- 必ず${langName}で回答すること。
- 簡潔・自然・丁寧に回答すること。Markdownの表やパイプ区切りは使わない。文章か箇条書きで。
- 会話履歴が存在する場合は必ず参照すること。ユーザーが以前の話題に言及したら具体的に引用して返すこと。同じ内容・URLを繰り返すな。
- 公式情報を聞かれた場合は、提供された知識のみを使い、情報を創作しないこと。
- 「次のライブ」「今後の公演」「これからのライブ」を聞かれた場合は、今日（${today}）より後の公演のみ案内すること。過去の公演は絶対に案内しないこと。
- 訂正・指摘を受けた場合は、具体的に認めて同じ返信内で正しい情報を伝えること。
- チケット・ライブ日程・SNS・ファンクラブ・ドラマについては、提供された情報のみをもとに回答すること。
- チケット購入URLを案内する場合は、ローソンチケット（https://l-tike.com）のURLを1つだけ案内すること。複数のプレイガイドURLを羅列しないこと。海外からの購入については別途聞かれた場合のみ案内する。
- ライブ情報・公演日程・チケットURLは、ライブ/チケット/公演について明示的に質問された場合にのみ案内すること。関係ない質問の返答に勝手に付け加えないこと。
- 直前の返答ですでに案内済みの情報（URL・公演日程など）は繰り返さないこと。
- 不満・怒り・クレーム・批判・返金希望・キャンセル依頼を含む内容は complaint カ分類し、誠実な謝罪と具体的な解決策を提示すること。
- クレーム・不満の場合は以下の流れで対応すること:
  1. まず誠意ある謝罪・共感を示す
  2. 問題に応じた具体的な解決策を案内する（例: チケット未着→購入サイトのサポート窓口、商品不良→公式サイトのお問い合わせフォーム）
  3. 最後に https://gackt.com のお問い合わせフォームへ誘導する
  同じ返答を繰り返さず、ユーザーのクレーム内容に合わせて対応すること。
- ユーザーのメッセージを以下のカテゴリのいずれか1つに分類すること: inquiry, ticket_request, announcement_response, complaint, other
- 必ずJSONのみを返すこと。フィールドはreplyとcategoryの2つのみ。
- Markdownで囲まず、余分なテキストを追加しないこと。
- categoryは必ず以下のいずれかの文字列を使用すること: inquiry, ticket_request, announcement_response, complaint, other`,
      messages: [...conversationHistory, { role: 'user', content: message }],
    })

    const responseText = response.content
      .map(item => ('text' in item ? item.text : ''))
      .join('')

    let reply = responseText
    let category: keyof typeof CATEGORY_LABELS = 'other'

    const parsed = parseResponsePayload(responseText)
    if (parsed && typeof parsed === 'object') {
      if (typeof parsed.reply === 'string') {
        reply = parsed.reply
      }
      if (typeof parsed.category === 'string') {
        const normalized = parsed.category.toLowerCase()
        if (normalized in CATEGORY_LABELS) {
          category = normalized as keyof typeof CATEGORY_LABELS
        }
      }
    }

    // サーバーサイドで統計を記録（LINE/Telegram と一元管理）
    incrementServerStats({ category: category as CategoryKey, language: lang }).catch(() => {})

    // 質問ログを Redis に記録（最新500件）
    redis.lpush('question_log', JSON.stringify({
      ts: Date.now(),
      ch: 'web',
      q: message,
      a: reply,
      lang,
      cat: category,
    })).then(() => redis.ltrim('question_log', 0, 499)).catch(() => {})

    return NextResponse.json({ reply, categoryLabel: CATEGORY_LABELS[category] })
  } catch (error) {
    console.error('Anthropic API エラー:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : '返答の生成に失敗しました。',
      },
      { status: 500 },
    )
  }
}
