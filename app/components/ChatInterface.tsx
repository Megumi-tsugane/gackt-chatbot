'use client'

import { useState, useRef, useEffect } from 'react'

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

    setMessages(prev => [...prev, { role: 'user', text }])
    setInput('')
    setSending(true)

    await new Promise(r => setTimeout(r, 800))
    setMessages(prev => [
      ...prev,
      { role: 'assistant', text: '（AIの返答がここに表示されます）' },
    ])
    setSending(false)
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
    <div className="flex flex-col h-screen" style={{ background: 'var(--background)' }}>
      {/* Header */}
      <header
        className="flex-none flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
      >
        <div className="flex items-center gap-3">
          <span
            className="text-2xl font-bold tracking-widest"
            style={{ color: 'var(--gold)', fontFamily: 'serif', letterSpacing: '0.2em' }}
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
        <div
          className="w-2 h-2 rounded-full animate-pulse"
          style={{ background: 'var(--gold)' }}
        />
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
                      background: 'var(--gold)',
                      color: '#000',
                      border: '1px solid var(--gold)',
                    }
                  : {
                      background: 'transparent',
                      color: 'var(--gold)',
                      border: '1px solid var(--gold-dim)',
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
                style={{ background: 'var(--gold)', color: '#000' }}
              >
                G
              </div>
            )}
            <div
              className="max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed"
              style={
                msg.role === 'user'
                  ? {
                      background: 'var(--gold)',
                      color: '#000',
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
              {msg.text}
            </div>
          </div>
        ))}
        {sending && (
          <div className="flex justify-start">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mr-2 flex-none self-end mb-1"
              style={{ background: 'var(--gold)', color: '#000' }}
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
                      background: 'var(--gold)',
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
            if (el) el.style.borderColor = 'var(--gold-dim)'
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
                ? { background: 'var(--gold)', color: '#000' }
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
  )
}
