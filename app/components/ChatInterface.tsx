'use client'

import Link from 'next/link'
import { useState, useRef, useEffect } from 'react'
import React from 'react'
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
  'zh-HK': '發送訊息給GACKT...',
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
  fr: 'Bienvenue sur l\'IA de GACKT. Posez-moi n\'importe quelle question.',
  th: 'ยินดีต้อนรับสู่ GACKT AI. ถามฉันได้ทุกเรื่อง',
}

interface Message {
  role: 'user' | 'assistant'
  text: string
  categoryLabel?: string
}

function renderText(text: string) {
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split('\n')
  return parts.map((line, i) => {
    const segments = line.split(urlRegex)
    return (
      <React.Fragment key={i}>
        {segments.map((seg, j) =>
          urlRegex.test(seg)
            ? <a key={j} href={seg} target="_blank" rel="noopener noreferrer" style={{ color: '#c9a96e', textDecoration: 'underline', wordBreak: 'break-all' }}>{seg}</a>
            : seg
        )}
        {i < parts.length - 1 && <br />}
      </React.Fragment>
    )
  })
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, language: lang }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to get a reply from the AI.')

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
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0a0a 50%, #0a0a0a 100%)',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      color: '#ffffff',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <header style={{
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        borderBottom: '1px solid rgba(201,169,110,0.2)',
        background: 'rgba(0,0,0,0.4)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '16px', fontWeight: '300', letterSpacing: '4px', color: '#ffffff' }}>GACKT</div>
            <div style={{ fontSize: '10px', letterSpacing: '3px', color: '#888888', textTransform: 'uppercase' }}>AI Chat</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#c9a96e',
            boxShadow: '0 0 6px #c9a96e',
            animation: 'pulse 2s infinite',
          }} />
          <Link
            href="/dashboard"
            style={{
              borderRadius: '20px',
              border: '1px solid rgba(201,169,110,0.4)',
              color: '#c9a96e',
              padding: '5px 14px',
              fontSize: '10px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              textDecoration: 'none',
            }}
          >
            Dashboard
          </Link>
        </div>
      </header>

      {/* Language Selector */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px',
        borderBottom: '1px solid rgba(201,169,110,0.15)',
        background: 'rgba(0,0,0,0.2)',
        overflowX: 'auto',
      }}>
        <div style={{ display: 'flex', gap: '8px', minWidth: 'max-content' }}>
          {LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => handleLangChange(l.code)}
              style={lang === l.code ? {
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '500',
                borderRadius: '16px',
                border: '1px solid #c9a96e',
                background: 'linear-gradient(135deg, #c9a96e, #a0793e)',
                color: '#ffffff',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px',
              } : {
                padding: '6px 14px',
                fontSize: '12px',
                fontWeight: '400',
                borderRadius: '16px',
                border: '1px solid rgba(201,169,110,0.3)',
                background: 'transparent',
                color: '#c9a96e',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                letterSpacing: '0.5px',
              }}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}>
        {messages.map((msg, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            alignItems: 'flex-end',
            gap: '8px',
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                background: 'linear-gradient(135deg, #c9a96e, #a0793e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: '600', color: '#ffffff',
                flexShrink: 0, letterSpacing: '1px',
              }}>
                G
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '75%' }}>
              <div style={msg.role === 'user' ? {
                padding: '12px 16px',
                borderRadius: '18px 18px 4px 18px',
                background: 'linear-gradient(135deg, #c9a96e, #a0793e)',
                color: '#ffffff',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              } : {
                padding: '12px 16px',
                borderRadius: '18px 18px 18px 4px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(201,169,110,0.2)',
                color: '#ffffff',
                fontSize: '14px',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap',
              }}>
                {renderText(msg.text)}
              </div>
              {msg.role === 'user' && msg.categoryLabel && (
                <span style={{
                  marginTop: '4px',
                  fontSize: '10px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: '#888888',
                  alignSelf: 'flex-end',
                }}>
                  {msg.categoryLabel}
                </span>
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'flex-end', gap: '8px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #c9a96e, #a0793e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '11px', fontWeight: '600', color: '#ffffff',
              flexShrink: 0,
            }}>
              G
            </div>
            <div style={{
              padding: '12px 16px',
              borderRadius: '18px 18px 18px 4px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(201,169,110,0.2)',
            }}>
              <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                {[0, 1, 2].map(d => (
                  <span key={d} style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#c9a96e',
                    display: 'inline-block',
                    animation: `bounce 1s ${d * 0.15}s infinite`,
                  }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        flexShrink: 0,
        padding: '16px',
        borderTop: '1px solid rgba(201,169,110,0.2)',
        background: 'rgba(0,0,0,0.3)',
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '10px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(201,169,110,0.3)',
          borderRadius: '24px',
          padding: '10px 16px',
        }}>
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
            style={{
              flex: 1,
              resize: 'none',
              background: 'transparent',
              outline: 'none',
              border: 'none',
              color: '#ffffff',
              fontSize: '15px',
              lineHeight: '1.5',
              maxHeight: '120px',
              fontFamily: "'Helvetica Neue', Arial, sans-serif",
            }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sending}
            aria-label="送信"
            style={{
              flexShrink: 0,
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: input.trim() && !sending ? 'pointer' : 'not-allowed',
              background: input.trim() && !sending
                ? 'linear-gradient(135deg, #c9a96e, #a0793e)'
                : 'rgba(201,169,110,0.2)',
              color: '#ffffff',
              transition: 'all 0.2s',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M1.5 1.5l13 6.5-13 6.5V9.5l9-1.5-9-1.5V1.5z" />
            </svg>
          </button>
        </div>
        <p style={{
          textAlign: 'center',
          marginTop: '8px',
          fontSize: '11px',
          color: '#555555',
          letterSpacing: '0.5px',
        }}>
          Shift+Enter で改行 / Enter で送信
        </p>
      </div>
    </div>
  )
}
