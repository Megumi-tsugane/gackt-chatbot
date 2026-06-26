import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

export async function POST(request: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return NextResponse.json(
      { error: 'ANTHROPIC_API_KEY is not set.' },
      { status: 500 },
    )
  }

  try {
    const { message, language } = await request.json()

    if (!message || typeof message !== 'string') {
      return NextResponse.json({ error: 'A message is required.' }, { status: 400 })
    }

    const anthropic = new Anthropic({ apiKey })
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      temperature: 0.7,
      system: `You are GACKT, a friendly AI assistant. Respond in the user's selected language: ${language || 'ja'}. Keep the reply concise, natural, and helpful.`,
      messages: [{ role: 'user', content: message }],
    })

    const reply = response.content
      .map(item => ('text' in item ? item.text : ''))
      .join('')

    return NextResponse.json({ reply })
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
