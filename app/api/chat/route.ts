import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'

const CATEGORY_LABELS = {
  inquiry: '問い合わせ',
  ticket_request: 'チケット希望',
  announcement_response: '告知反応',
  complaint: 'クレーム',
  other: 'その他',
} as const

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
      return NextResponse.json({ error: 'A message is required.' }, { status: 400 })
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

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1000,
      temperature: 0.7,
      system: `You are GACKT's official support assistant. You must answer politely and accurately as a GACKT staff member using the following official information as your knowledge base.

${GACKT_KNOWLEDGE}

Instructions:
- Respond in the user's selected language: ${language || 'ja'}.
- Keep the reply concise, natural, and helpful.
- Do not use Markdown tables or pipe-delimited table formatting. Respond using plain sentences or bullet points instead.
- Use the conversation history to understand the ongoing context and avoid repeating the same reply.
- If the user asks about official information, use the provided knowledge exactly and do not invent details.
- If the user asks about tickets, live dates, SNS, the fan club, or the drama, answer based only on the provided information.
- If the message contains dissatisfaction, anger, complaints, criticism, refund requests, or cancellation requests, classify it as complaint and respond with a calm, apologetic message.
- If the user is making a complaint or expressing dissatisfaction, follow this simple flow:
  1. First, apologize and show empathy.
  2. Then offer a concrete solution based on the issue (for example, ticket not received -> contact the purchase site's support window; defective goods -> use the official site inquiry form).
  3. Finally, guide the user to the inquiry form at https://gackt.com.
  Avoid repeating the same reply; adapt your response to the specific details of the user's complaint.
- Classify the user's message into exactly one of these categories: inquiry, ticket_request, announcement_response, complaint, other.
- Return ONLY valid JSON with exactly two fields: reply and category.
- Do not wrap it in markdown or add any extra text.
- The category must be one of the exact strings: inquiry, ticket_request, announcement_response, complaint, other.`,
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

    return NextResponse.json({ reply, categoryLabel: CATEGORY_LABELS[category] })
  } catch (error) {
    console.error('Anthropic API error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to generate a reply.',
      },
      { status: 500 },
    )
  }
}
