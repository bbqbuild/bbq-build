import { useEffect, useRef, useState } from 'react'
import { aiChat } from '../auth/api'
import { applyOperations, type OpResult } from '../ai/ops'
import { catalogSummary } from '../catalog/appliances'
import { useStore } from '../state/store'
import { fitView } from '../canvas/CanvasStage'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  ops?: OpResult[]
}

const STARTERS = [
  'Build me a compact grill island for a small patio',
  'Add a pizza oven and a fridge',
  'I smoke brisket every weekend — set me up',
]

export function ChatPanel() {
  const chatOpen = useStore((s) => s.chatOpen)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  if (!chatOpen) return null

  async function send(text: string) {
    const content = text.trim()
    if (!content || busy) return
    setInput('')
    const history = [...messages, { role: 'user' as const, content }]
    setMessages(history)
    setBusy(true)
    try {
      const design = useStore.getState().design
      const res = await aiChat(
        history.map(({ role, content }) => ({ role, content })),
        design,
        catalogSummary(design.custom ?? []),
      )
      const ops = res.operations?.length ? applyOperations(res.operations) : []
      if (ops.some((o) => o.ok)) requestAnimationFrame(fitView)
      // let the model know if something it tried was rejected, via a synthetic note
      const failures = ops.filter((o) => !o.ok)
      let reply = res.reply
      if (failures.length) reply += `\n\n(Note: ${failures.map((f) => f.text).join('; ')})`
      setMessages([...history, { role: 'assistant', content: reply, ops }])
    } catch (e) {
      setMessages([
        ...history,
        { role: 'assistant', content: e instanceof Error ? `⚠ ${e.message}` : '⚠ Something went wrong' },
      ])
    } finally {
      setBusy(false)
    }
  }

  return (
    <aside className="chat-panel">
      <header className="chat-head">
        <span className="chat-title">✨ Assistant</span>
        <span className="chat-model">Gemini</span>
      </header>
      <div className="chat-scroll" ref={scrollRef}>
        {!messages.length && (
          <div className="chat-empty">
            <p>Tell me what you're dreaming of and I'll build it on the canvas.</p>
            {STARTERS.map((s) => (
              <button key={s} className="chat-starter" onClick={() => send(s)}>
                {s}
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`chat-msg chat-${m.role}`}>
            <div className="chat-bubble">{m.content}</div>
            {m.ops && m.ops.length > 0 && (
              <div className="chat-ops">
                {m.ops.map((o, j) => (
                  <span key={j} className={`chat-op ${o.ok ? 'ok' : 'fail'}`}>
                    {o.ok ? '✓' : '✕'} {o.text}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div className="chat-msg chat-assistant">
            <div className="chat-bubble chat-typing">
              <span />
              <span />
              <span />
            </div>
          </div>
        )}
      </div>
      <form
        className="chat-input"
        onSubmit={(e) => {
          e.preventDefault()
          send(input)
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="e.g. add a sink next to the grill"
          disabled={busy}
        />
        <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
          ➤
        </button>
      </form>
    </aside>
  )
}
