import { NextResponse } from 'next/server'

const KNOWLEDGE_URLS = [
  'https://gackt.com/discography',
  'https://gackt.com',
  'https://gackt.com/schedule',
  'https://gackt.com/contents/1069894',
]
const NEWS_LIST_URL = 'https://gackt.com/contents/news'
const CACHE_TTL_MS = 60 * 60 * 1000

type CachedKnowledge = {
  expiresAt: number
  payload: {
    sources: string[]
    knowledge: string
  }
}

let knowledgeCache: CachedKnowledge | null = null

function stripHtml(html: string) {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|section|article|h[1-6]|li|tr|ul|ol)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[\t\r\f\v]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function fetchPageText(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`)
  }

  const html = await response.text()
  return stripHtml(html)
}

function resolveUrl(href: string, baseUrl: string) {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

function extractLatestNewsUrls(html: string, baseUrl: string) {
  const matches = html.matchAll(/href=["']([^"']+)["']/gi)
  const urls = new Set<string>()

  for (const match of matches) {
    const href = match[1]
    if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) continue

    const resolved = resolveUrl(href, baseUrl)
    if (!resolved) continue

    if (resolved.includes('/contents/') && !resolved.includes('/contents/news')) {
      urls.add(resolved)
    }
  }

  return Array.from(urls).slice(0, 5)
}

async function buildKnowledgePayload() {
  const basePages = await Promise.all(
    KNOWLEDGE_URLS.map(async url => {
      const text = await fetchPageText(url)
      return `【${url}】\n${text}`
    }),
  )

  const newsListText = await fetchPageText(NEWS_LIST_URL)
  const latestNewsUrls = extractLatestNewsUrls(newsListText, NEWS_LIST_URL)
  const newsArticlePages = await Promise.all(
    latestNewsUrls.map(async url => {
      const text = await fetchPageText(url)
      return `【${url}】\n${text}`
    }),
  )

  return {
    sources: [...KNOWLEDGE_URLS, NEWS_LIST_URL, ...latestNewsUrls],
    knowledge: [...basePages, `【${NEWS_LIST_URL}】\n${newsListText}`, ...newsArticlePages].join('\n\n'),
  }
}

export async function GET() {
  try {
    const now = Date.now()
    if (knowledgeCache && knowledgeCache.expiresAt > now) {
      return NextResponse.json(knowledgeCache.payload)
    }

    const payload = await buildKnowledgePayload()
    knowledgeCache = {
      expiresAt: now + CACHE_TTL_MS,
      payload,
    }

    return NextResponse.json(payload)
  } catch (error) {
    console.error('Knowledge fetch error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch knowledge.',
        knowledge: '',
      },
      { status: 500 },
    )
  }
}
