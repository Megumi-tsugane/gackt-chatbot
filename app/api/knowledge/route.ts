import { NextResponse } from 'next/server'
import { GACKT_KNOWLEDGE } from '@/lib/knowledge'

// ホームページからニュース記事URLを発見（最新記事が掲載されている）
const NEWS_DISCOVERY_URLS = [
  'https://gackt.com',
  'https://gackt.com/contents/news',
]
// その他の知識ページ（テキストとして取り込む）
const EXTRA_KNOWLEDGE_URLS = [
  'https://gackt.com/discography',
  'https://gackt.com/schedule',
]
const CACHE_TTL_MS = 60 * 60 * 1000 // 1時間キャッシュ
const FETCH_TIMEOUT_MS = 8000
const MAX_NEWS_ARTICLES = 5

type CachedKnowledge = {
  expiresAt: number
  payload: { sources: string[]; knowledge: string }
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

async function fetchPageRaw(url: string): Promise<string> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml',
      },
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`)
    return await response.text()
  } catch (error) {
    console.warn(`Knowledge fetch failed for ${url}:`, error)
    return ''
  } finally {
    clearTimeout(timeoutId)
  }
}

async function fetchPageText(url: string): Promise<string> {
  const raw = await fetchPageRaw(url)
  return raw ? stripHtml(raw) : ''
}

function resolveUrl(href: string, baseUrl: string): string | null {
  try {
    return new URL(href, baseUrl).toString()
  } catch {
    return null
  }
}

/**
 * 生のHTML文字列から /contents/NUMBER 形式の記事URLを抽出する。
 * __NEXT_DATA__ JSONと href属性の両方を探す。
 */
function extractNewsUrls(rawHtml: string, baseUrl: string): string[] {
  const urls = new Set<string>()

  // ① __NEXT_DATA__（Next.js のサーバーサイドデータ）から抽出
  const nextDataMatch = rawHtml.match(
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (nextDataMatch) {
    const idMatches = nextDataMatch[1].matchAll(/\/contents\/(\d+)/g)
    for (const m of idMatches) {
      const resolved = resolveUrl(`/contents/${m[1]}`, baseUrl)
      if (resolved) urls.add(resolved)
    }
  }

  // ② href="/contents/NUMBER" パターンを生HTMLから抽出
  const hrefMatches = rawHtml.matchAll(/href=["']([^"']*\/contents\/\d+[^"'#?]*)["']/gi)
  for (const m of hrefMatches) {
    const href = m[1]
    // ニュース一覧ページ自体は除外
    if (href.endsWith('/contents/news') || href.endsWith('/contents/news/')) continue
    const resolved = resolveUrl(href, baseUrl)
    if (resolved) urls.add(resolved)
  }

  // ID降順（大きいID＝新しい記事）でソートして上位N件を返す
  return Array.from(urls)
    .sort((a, b) => {
      const idA = parseInt(a.match(/\/contents\/(\d+)/)?.[1] ?? '0')
      const idB = parseInt(b.match(/\/contents\/(\d+)/)?.[1] ?? '0')
      return idB - idA
    })
    .slice(0, MAX_NEWS_ARTICLES)
}

async function buildKnowledgePayload() {
  // ① ニュース発見用ページを並列取得（生HTML）
  const [homepageRaw, newsListRaw] = await Promise.all(
    NEWS_DISCOVERY_URLS.map(fetchPageRaw),
  )

  // ② 記事URLを収集・重複排除・ソート
  const discoveredSet = new Set<string>()
  if (homepageRaw) {
    extractNewsUrls(homepageRaw, NEWS_DISCOVERY_URLS[0]).forEach(u => discoveredSet.add(u))
  }
  if (newsListRaw) {
    extractNewsUrls(newsListRaw, NEWS_DISCOVERY_URLS[1]).forEach(u => discoveredSet.add(u))
  }
  const latestNewsUrls = Array.from(discoveredSet)
    .sort((a, b) => {
      const idA = parseInt(a.match(/\/contents\/(\d+)/)?.[1] ?? '0')
      const idB = parseInt(b.match(/\/contents\/(\d+)/)?.[1] ?? '0')
      return idB - idA
    })
    .slice(0, MAX_NEWS_ARTICLES)

  // ③ ベースページ・ニュース記事を並列取得（全部stripped text）
  const [homepageText, ...extraTexts] = await Promise.all([
    Promise.resolve(homepageRaw ? stripHtml(homepageRaw) : ''),
    ...EXTRA_KNOWLEDGE_URLS.map(fetchPageText),
    ...latestNewsUrls.map(fetchPageText),
  ])

  const extraKnowledgeParts = extraTexts.slice(0, EXTRA_KNOWLEDGE_URLS.length)
  const newsArticleParts = extraTexts.slice(EXTRA_KNOWLEDGE_URLS.length)

  const knowledgeParts = [
    `【https://gackt.com】\n${homepageText}`,
    ...EXTRA_KNOWLEDGE_URLS.map((url, i) => `【${url}】\n${extraKnowledgeParts[i]}`),
    ...latestNewsUrls.map((url, i) => `【${url}】\n${newsArticleParts[i]}`),
  ]

  return {
    sources: [...NEWS_DISCOVERY_URLS, ...EXTRA_KNOWLEDGE_URLS, ...latestNewsUrls],
    knowledge: knowledgeParts.join('\n\n'),
  }
}

export async function GET() {
  try {
    const now = Date.now()
    if (knowledgeCache && knowledgeCache.expiresAt > now) {
      return NextResponse.json(knowledgeCache.payload)
    }
    const payload = await buildKnowledgePayload()
    const fallbackKnowledge = payload.knowledge.trim() ? payload.knowledge : GACKT_KNOWLEDGE
    const resultPayload = { sources: payload.sources, knowledge: fallbackKnowledge }
    knowledgeCache = { expiresAt: now + CACHE_TTL_MS, payload: resultPayload }
    return NextResponse.json(resultPayload)
  } catch (error) {
    console.error('Knowledge fetch error:', error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Failed to fetch knowledge.',
        knowledge: GACKT_KNOWLEDGE,
      },
      { status: 200 },
    )
  }
}
