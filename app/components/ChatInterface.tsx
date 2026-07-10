'use client'

import React from 'react'
import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import { incrementStats } from '../lib/stats'

const LANGUAGES = [
  { code: 'ja', label: '日本語' },
  { code: 'en', label: 'English' },
  { code: 'zh-TW', label: '繁體中文' },
  { code: 'zh-HK', label: '廣東話' },
  { code: 'es', label: 'Español' },
  { code: 'ko', label: '한국어' },
  { code: 'fr', label: 'Français' },
  { code: 'th', label: 'ไทย' },
]

const PLACEHOLDERS: Record<string, string> = {
  ja: 'GACKTにメッセージを送る...',
  en: 'Send a message to GACKT...',
  'zh-TW': '傳送訊息給GACKT...',
  'zh-HK': '発送訊息給GACKT...',
  es: 'Enviar un mensaje a GACKT...',
  ko: 'GACKT에게 메시지 보내기...',
  fr: 'Envoyer un message à GACKT...',
  th: 'ส่งข้อความถึง GACKT...',
}

const GREETINGS: Record<string, string> = {
  ja: 'GACKTのAIチャットボットへようこそ。何でも聞いてください。',
  en: 'Welcome to GACKT AI. Ask me anything.',
  'zh-TW': '歡迎來到 GACKT AI。請隨時提問。',
  'zh-HK': '歡迎來到 GACKT AI。請隨時發問。',
  es: 'Bienvenido al AI de GACKT. Pregúntame lo que quieras.',
  ko: 'GACKT AI에 오신 것을 환영합니다. 무엇이든 물어보세요.',
  fr: "Bienvenue sur l'IA de GACKT. Posez-moi n'importe quelle question.",
  th: 'ยินดีต้อนรับสู่ GACKT AI. ถามฉันได้ทุกเรื่อง',
}

const LANGUAGE_NAMES: Record<string, string> = {
  ja: 'Japanese',
  en: 'English',
  'zh-TW': 'Traditional Chinese',
  'zh-HK': 'Cantonese',
  es: 'Spanish',
  ko: 'Korean',
  fr: 'French',
  th: 'Thai',
}

interface Message {
  role: 'user' | 'assistant'
  text: string
  categoryLabel?: string
}

function renderText(text: string) {
  const result: React.ReactNode[] = []
  const lines = text.split('\n')
  lines.forEach((line, li) => {
    const re = /https?:\/\/[^\s）)]+/g
    let last = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(line)) !== null) {
      if (m.index > last) result.push(line.slice(last, m.index))
      result.push(React.createElement('a', {
        key: li + '-' + m.index,
        href: m[0],
        target: '_blank',
        rel: 'noopener noreferrer',
        style: { color: '#f87171', textDecoration: 'underline', wordBreak: 'break-all' }
      }, m[0]))
      last = m.index + m[0].length
    }
    if (last < line.length) result.push(line.slice(last))
    if (li < lines.length - 1) result.push(React.createElement('br', { key: 'br' + li }))
  })
  return result
}

export default function ChatInterface() {
  const [lang, setLang] = useState('ja')
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', text: GREETINGS['ja'] },
  ])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleLangChange = (code: string) => {
    setLang(code)
    setMessages([{ role: 'assistant', text: GREETINGS[code] }])
    setInput('')
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return

    const userMessageIndex = messages.length
    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setSending(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: text, language: lang }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get a reply from the AI.')
      }

      incrementStats({
        category: data.categoryLabel === 'チケット希望'
          ? 'ticket_request'
          : data.categoryLabel === '問い合わせ'
            ? 'inquiry'
            : data.categoryLabel === '告知反応'
              ? 'announcement_response'
              : 'other',
        language: lang as 'ja' | 'en' | 'zh-TW' | 'zh-HK' | 'es' | 'ko' | 'fr' | 'th',
      })

      setMessages(prev => {
        const updated = prev.map((msg, index) =>
          index === userMessageIndex ? { ...msg, categoryLabel: data.categoryLabel } : msg,
        )
        return [...updated, { role: 'assistant', text: data.reply }]
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to contact the AI right now.'
      setMessages(prev => [...prev, { role: 'assistant', text: message }])
    } finally {
      setSending(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div
      className="relative flex flex-col h-screen overflow-hidden"
      style={{
        backgroundImage: 'url(/gackt-bg.jpg)',
        backgroundSize: 'cover',
        backgroundPosition: 'center 10%',
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at center, transparent 30%, black 100%)' }} />
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: "url('/gackt-bg.jpg')", opacity: 0.2, filter: 'blur(2px)' }}
      />
      <div className="absolute inset-0" style={{ background: 'linear-gradient(135deg, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.65) 100%)' }} />
      <div className="relative flex flex-col h-full">
      {/* Header */}
      <header
        className="flex-none flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-bold tracking-widest"
            style={{ color: '#8B0000', fontFamily: 'serif', letterSpacing: '0.2em' }}
          >
            GACKT
          </span>
          <span
            className="text-xs tracking-widest uppercase"
            style={{ color: '#666', letterSpacing: '0.15em' }}
          >
            AI Chat
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: '#8B0000' }}
          />
          <Link
            href="/dashboard"
            className="rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em] transition-colors"
            style={{ borderColor: '#5C0000', color: '#8B0000' }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Language Selector */}
      <div
        className="flex-none px-4 py-3 border-b overflow-x-auto"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-alt)' }}
      >
        <div className="flex gap-2 min-w-max mx-auto w-fit">
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => handleLangChange(l.code)}
              className="px-3 py-1.5 text-sm font-medium rounded transition-all duration-200 whitespace-nowrap"
              style={
                lang === l.code
                  ? {
                      background: '#8B0000',
                      color: '#fff',
                      border: '1px solid #8B0000',
                    }
                  : {
                      background: 'transparent',
                      color: '#8B0000',
                      border: '1px solid #5C0000',
                    }
              }
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.role === 'assistant' && (
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-2 flex-none self-end mb-1"
                style={{ background: '#8B0000', color: '#fff' }}
              >
                G
              </div>
            )}
            <div className="flex flex-col max-w-[75%]">
              <div
                className="px-4 py-3 rounded-2xl text-sm leading-relaxed"
                style={
                  msg.role === 'user'
                    ? {
                        background: '#8B0000',
                        color: '#fff',
                        borderBottomRightRadius: '4px',
                      }
                    : {
                        background: 'var(--surface-alt)',
                        color: 'var(--foreground)',
                        border: '1px solid var(--border)',
                        borderBottomLeftRadius: '4px',
                      }
                }
              >
                {renderText(msg.text)}
              </div>
              {msg.role === 'user' && msg.categoryLabel && (
                <span className="mt-1 text-[10px] uppercase tracking-wide self-end" style={{ color: '#888' }}>
                  {msg.categoryLabel}
                </span>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-2 flex-none self-end mb-1"
              style={{ background: '#8B0000', color: '#fff' }}
            >
              G
            </div>
            <div
              className="px-4 py-3 rounded-2xl"
              style={{
                background: 'var(--surface-alt)',
                border: '1px solid var(--border)',
                borderBottomLeftRadius: '4px',
              }}
            >
              <span className="flex gap-1 items-center">
                {[0, 1, 2].map(d => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full animate-bounce"
                    style={{
                      background: '#8B0000',
                      animationDelay: `${d * 0.15}s`,
                    }}
                  />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        className="flex-none p-4 border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div
          className="flex items-end gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)' }}
          onFocus={() => {
            const el = document.activeElement?.closest('[data-input-wrap]') as HTMLElement
            if (el) el.style.borderColor = '#5C0000'
          }}
        >
          <textarea
            ref={textareaRef}
            rows={1}
            value={input}
            onChange={e => {
              setInput(e.target.value)
              autoResize()
            }}
            onKeyDown={handleKeyDown}
            placeholder={PLACEHOLDERS[lang]}
            className="flex-1 resize-none bg-transparent outline-none text-sm leading-relaxed"
            style={{ color: 'var(--foreground)', maxHeight: '120px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            className="flex-none w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200"
            style={
              input.trim() && !sending
                ? { background: '#8B0000', color: '#fff' }
                : { background: 'var(--border)', color: '#555' }
            }
            aria-label="送信"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-1.5-9-1.5V1.5z" />
            </svg>
          </button>
        </div>
        <p className="text-center mt-2 text-xs" style={{ color: '#444' }}>
          Shift+Enter で改行 / Enter で送信
        </p>
      </div>
      </div>
    </div>
  )
}
