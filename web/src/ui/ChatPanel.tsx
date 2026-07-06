import { useCallback, useEffect, useRef, useState } from 'react'
import { aiChat } from '../auth/api'
import { applyOperations, type OpResult } from '../ai/ops'
import { catalogSummary } from '../catalog/appliances'
import { useStore } from '../state/store'
import { fitView } from '../canvas/CanvasStage'
import { useDraggable } from './useDraggable'

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

const FAB_SIZE = 60
const WIN_W = 360
const WIN_H = 520

/** Floating, draggable AI assistant: a FAB that opens a movable chat window. */
export function ChatPanel() {
  const chatOpen = useStore((s) => s.chatOpen)
  const toggleChat = useStore((s) => s.toggleChat)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  const fabSize = useCallback(() => ({ w: FAB_SIZE, h: FAB_SIZE }), [])
  const fabInitial = useCallback(() => ({ x: 24, y: window.innerHeight - FAB_SIZE - 28 }), [])
  const fab = useDraggable('bbq_fab_pos', fabInitial, fabSize)

  const winSize = useCallback(() => ({ w: WIN_W, h: WIN_H }), [])
  const winInitial = useCallback(() => ({ x: 24, y: window.innerHeight - WIN_H - 96 }), [])
  const win = useDraggable('bbq_chat_pos', winInitial, winSize)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, busy])

  const send = useCallback(
    async (text: string) => {
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
        const failures = ops.filter((o) => !o.ok)
        let reply = res.reply
        if (failures.length) reply += `\n\n(Note: ${failures.map((f) => f.text).join('; ')})`
        setMessages([...history, { role: 'assistant', content: reply, ops }])
      } catch (e) {
        setMessages([...history, { role: 'assistant', content: e instanceof Error ? `⚠ ${e.message}` : '⚠ Something went wrong' }])
      } finally {
        setBusy(false)
      }
    },
    [busy, messages],
  )

  return (
    <>
      <button
        className={`chat-fab ${chatOpen ? 'open' : ''}`}
        style={{ left: fab.pos.x, top: fab.pos.y }}
        onPointerDown={fab.onPointerDown}
        onClick={() => {
          if (!fab.didMove()) toggleChat()
        }}
        title="AI assistant — drag to move"
      >
        {chatOpen ? '✕' : '✨'}
      </button>

      {chatOpen && (
        <div className="chat-window" style={{ left: win.pos.x, top: win.pos.y, width: WIN_W, height: WIN_H }}>
          <header className="chat-head" onPointerDown={win.onPointerDown}>
            <span className="chat-title">✨ Assistant</span>
            <span className="chat-model">Gemini</span>
            <button className="chat-close" onClick={toggleChat} onPointerDown={(e) => e.stopPropagation()} title="Close">
              ✕
            </button>
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
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="e.g. add a sink next to the grill" disabled={busy} autoFocus />
            <button className="btn btn-primary" type="submit" disabled={busy || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </>
  )
}
