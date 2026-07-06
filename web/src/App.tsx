import { useCallback, useEffect, useState } from 'react'
import { clearSession, createDesign, setCachedEmail, updateDesign } from './auth/api'
import { supabase } from './auth/supabase'
import { Login } from './auth/Login'
import { CanvasStage, fitView } from './canvas/CanvasStage'
import { Stage3D } from './canvas3d/Stage3D'
import { emptyDesign, useStore } from './state/store'
import { ChatPanel } from './ui/ChatPanel'
import { DesignsModal } from './ui/DesignsModal'
import { HomeScreen } from './ui/HomeScreen'
import { Landing } from './ui/Landing'
import { Inspector } from './ui/Inspector'
import { PresetsModal } from './ui/PresetsModal'
import { Sidebar } from './ui/Sidebar'
import { SpecModal } from './ui/SpecModal'
import { Toasts } from './ui/Toasts'
import { TopBar } from './ui/TopBar'
import { ValidateModal } from './ui/ValidateModal'
import { DropDecisionModal } from './ui/DropDecisionModal'
import { useToasts } from './ui/toast'
import type { SavedDesign } from './types'

type Modal = 'none' | 'presets' | 'spec' | 'designs' | 'validate'
// landing → public cover; auth → login/signup; home → dashboard; builder → editor
type Route = 'landing' | 'auth' | 'home' | 'builder'

export default function App() {
  const [authed, setAuthed] = useState<boolean>(false)
  const [ready, setReady] = useState(false)
  const [route, setRoute] = useState<Route>('landing')
  const [guest, setGuest] = useState(false)
  const [pendingCarry, setPendingCarry] = useState(false)
  const [authReason, setAuthReason] = useState<string | undefined>(undefined)
  const [modal, setModal] = useState<Modal>('none')
  const [saving, setSaving] = useState(false)
  const viewMode = useStore((s) => s.viewMode)
  const push = useToasts((s) => s.push)

  // hydrate + track Supabase auth session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setCachedEmail(data.session?.user?.email ?? null)
      const isAuthed = Boolean(data.session)
      setAuthed(isAuthed)
      // restore an in-progress builder session across a refresh
      const raw = localStorage.getItem('bbq_builder_session')
      let restored = false
      if (raw) {
        try {
          const sess = JSON.parse(raw)
          if (sess?.design && (isAuthed || sess.guest)) {
            useStore.getState().setDesign(sess.design, isAuthed ? (sess.savedId ?? null) : null)
            setGuest(Boolean(sess.guest) && !isAuthed)
            setRoute('builder')
            restored = true
            requestAnimationFrame(fitView)
          }
        } catch {
          /* ignore */
        }
      }
      if (!restored) setRoute(isAuthed ? 'home' : 'landing')
      setReady(true)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setCachedEmail(session?.user?.email ?? null)
      // only react to real transitions — ignore INITIAL_SESSION so it can't
      // clobber a guest-session restore during hydration
      if (event === 'SIGNED_IN') {
        setAuthed(true)
        setGuest(false)
        const st = useStore.getState()
        if (st.design.frames.length > 0 && st.savedId === null) {
          setRoute('builder')
          setPendingCarry(true) // save the guest's design into the new account
        } else {
          setRoute('home')
        }
      } else if (event === 'SIGNED_OUT') {
        setAuthed(false)
        setGuest(false)
        setRoute('landing')
      }
    })
    return () => sub.subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onLogout = () => setAuthed(false)
    window.addEventListener('bbq:logout', onLogout)
    return () => window.removeEventListener('bbq:logout', onLogout)
  }, [])

  const save = useCallback(
    async (opts?: { silent?: boolean }) => {
      const { design, savedId, markSaved } = useStore.getState()
      setSaving(true)
      try {
        if (savedId !== null) {
          await updateDesign(savedId, design)
          markSaved(savedId)
        } else {
          const created = await createDesign(design)
          markSaved(created.id)
        }
        if (!opts?.silent) push('Design saved', 'success')
      } catch (e) {
        if (!opts?.silent) push(e instanceof Error ? e.message : 'Save failed', 'error')
      } finally {
        setSaving(false)
      }
    },
    [push],
  )

  // save a guest design into the account right after signup/login
  useEffect(() => {
    if (authed && pendingCarry) {
      setPendingCarry(false)
      save({ silent: true }).then(() => push('Saved to your account', 'success'))
      requestAnimationFrame(fitView)
    }
  }, [authed, pendingCarry, save, push])

  // persist the builder session (survives F5) — for both guests and signed-in users
  useEffect(() => {
    if (route !== 'builder') return
    const write = () => {
      const st = useStore.getState()
      localStorage.setItem('bbq_builder_session', JSON.stringify({ design: st.design, savedId: st.savedId, guest }))
    }
    write()
    const unsub = useStore.subscribe((s, prev) => {
      if (s.design !== prev.design || s.savedId !== prev.savedId) write()
    })
    return unsub
  }, [route, guest])

  // once away from the builder, drop the persisted session (but not during
  // initial hydration — that would delete it before we can restore it)
  useEffect(() => {
    if (ready && route !== 'builder') localStorage.removeItem('bbq_builder_session')
  }, [ready, route])

  // auto-save: debounce every design change (no manual save needed)
  useEffect(() => {
    if (!authed || route !== 'builder') return
    let timer: ReturnType<typeof setTimeout> | null = null
    const unsub = useStore.subscribe((s, prev) => {
      if (s.design === prev.design) return
      const st = useStore.getState()
      if (!st.dirty) return
      // don't create an empty untitled design; wait until there's content
      if (st.savedId === null && st.design.frames.length === 0) return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => save({ silent: true }), 1200)
    })
    return () => {
      if (timer) clearTimeout(timer)
      unsub()
    }
  }, [authed, route, save])

  const newDesign = useCallback(() => {
    useStore.getState().setDesign(emptyDesign())
    setRoute('builder')
    requestAnimationFrame(fitView)
  }, [])

  const openDesign = useCallback((d: SavedDesign) => {
    useStore.getState().setDesign(d.data, d.id)
    setRoute('builder')
    requestAnimationFrame(fitView)
  }, [])

  // PLG: try the builder as a guest (no account) with one local design
  const tryAsGuest = useCallback(() => {
    setGuest(true)
    useStore.getState().setDesign(emptyDesign())
    setRoute('builder')
    requestAnimationFrame(fitView)
  }, [])

  const promptSignup = useCallback((reason?: string) => {
    setAuthReason(reason)
    setRoute('auth')
  }, [])

  const goHome = useCallback(() => {
    setModal('none')
    if (authed) setRoute('home')
    else promptSignup('Create a free account to save this design and start more.')
  }, [authed, promptSignup])

  // global keyboard shortcuts
  useEffect(() => {
    if (route !== 'builder') return
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target as HTMLElement).isContentEditable) return
      const s = useStore.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault()
        s.undo()
      } else if ((mod && e.key.toLowerCase() === 'z' && e.shiftKey) || (mod && e.key.toLowerCase() === 'y')) {
        e.preventDefault()
        s.redo()
      } else if (mod && e.key.toLowerCase() === 's') {
        e.preventDefault()
        save()
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        s.deleteSelection()
      } else if (e.key === 'Escape') {
        setModal('none')
        s.select({ kind: 'none' })
        useStore.setState({ measuring: false })
      } else if (e.key.toLowerCase() === 'f') {
        fitView()
      } else if (e.key.toLowerCase() === 'g') {
        s.toggleGrid()
      } else if (e.key.toLowerCase() === 'd') {
        s.toggleDims()
      } else if (e.key.toLowerCase() === 'u') {
        s.toggleUnit()
      } else if (e.key.toLowerCase() === 'v') {
        s.toggleView()
      } else if (e.key.toLowerCase() === 'm') {
        if (useStore.getState().viewMode === '3d') s.toggleMeasure()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [route, save])

  const logout = () => {
    clearSession()
    setAuthed(false)
    setGuest(false)
    setRoute('landing')
  }

  if (!ready) {
    return <div className="app-boot" />
  }

  if (route === 'landing' && !authed) {
    return (
      <>
        <Landing onTry={tryAsGuest} onSignIn={() => promptSignup(undefined)} />
        <Toasts />
      </>
    )
  }

  if (route === 'auth' && !authed) {
    return (
      <>
        <Login
          onLogin={() => setRoute('home')}
          onBack={() => setRoute(guest ? 'builder' : 'landing')}
          reason={authReason}
        />
        <Toasts />
      </>
    )
  }

  if (route === 'home' && authed) {
    return (
      <>
        <HomeScreen onOpen={openDesign} onNew={newDesign} onLogout={logout} />
        <Toasts />
      </>
    )
  }

  const isGuest = guest && !authed

  return (
    <div className="app">
      {isGuest && (
        <div className="guest-banner">
          <span>You're exploring as a guest — your design lives only in this browser.</span>
          <button className="btn btn-primary" onClick={() => promptSignup('Create a free account to save this design.')}>
            Sign up to save
          </button>
        </div>
      )}
      <TopBar
        onSave={() => (isGuest ? promptSignup('Create a free account to save this design.') : save())}
        saving={saving}
        guest={isGuest}
        onOpenPresets={() => setModal('presets')}
        onOpenSpec={() => setModal('spec')}
        onOpenDesigns={() => setModal('designs')}
        onOpenValidate={() => setModal('validate')}
        onNew={newDesign}
        onHome={goHome}
        onLogout={logout}
      />
      <div className="workspace">
        <Sidebar />
        {viewMode === '3d' ? <Stage3D /> : <CanvasStage />}
        <Inspector />
      </div>
      <ChatPanel />
      {modal === 'presets' && <PresetsModal onClose={() => setModal('none')} />}
      {modal === 'spec' && <SpecModal onClose={() => setModal('none')} />}
      {modal === 'designs' && <DesignsModal onClose={() => setModal('none')} />}
      {modal === 'validate' && <ValidateModal onClose={() => setModal('none')} />}
      <DropDecisionModal />
      <Toasts />
    </div>
  )
}
