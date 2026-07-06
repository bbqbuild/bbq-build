import { useCallback, useEffect, useState } from 'react'
import { clearSession, createDesign, getToken, updateDesign } from './auth/api'
import { Login } from './auth/Login'
import { CanvasStage, fitView } from './canvas/CanvasStage'
import { Stage3D } from './canvas3d/Stage3D'
import { emptyDesign, useStore } from './state/store'
import { ChatPanel } from './ui/ChatPanel'
import { DesignsModal } from './ui/DesignsModal'
import { Inspector } from './ui/Inspector'
import { PresetsModal } from './ui/PresetsModal'
import { Sidebar } from './ui/Sidebar'
import { SpecModal } from './ui/SpecModal'
import { Toasts } from './ui/Toasts'
import { TopBar } from './ui/TopBar'
import { ValidateModal } from './ui/ValidateModal'
import { useToasts } from './ui/toast'

type Modal = 'none' | 'presets' | 'spec' | 'designs' | 'validate'

export default function App() {
  const [authed, setAuthed] = useState<boolean>(() => Boolean(getToken()))
  const [modal, setModal] = useState<Modal>('none')
  const [saving, setSaving] = useState(false)
  const viewMode = useStore((s) => s.viewMode)
  const push = useToasts((s) => s.push)

  useEffect(() => {
    const onLogout = () => setAuthed(false)
    window.addEventListener('bbq:logout', onLogout)
    return () => window.removeEventListener('bbq:logout', onLogout)
  }, [])

  const save = useCallback(async () => {
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
      push('Design saved', 'success')
    } catch (e) {
      push(e instanceof Error ? e.message : 'Save failed', 'error')
    } finally {
      setSaving(false)
    }
  }, [push])

  const newDesign = useCallback(() => {
    const { dirty, setDesign } = useStore.getState()
    if (dirty && !confirm('Start a new design? Unsaved changes will be lost.')) return
    setDesign(emptyDesign())
    requestAnimationFrame(fitView)
  }, [])

  // global keyboard shortcuts
  useEffect(() => {
    if (!authed) return
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
  }, [authed, save])

  if (!authed) {
    return (
      <>
        <Login onLogin={() => setAuthed(true)} />
        <Toasts />
      </>
    )
  }

  return (
    <div className="app">
      <TopBar
        onSave={save}
        saving={saving}
        onOpenPresets={() => setModal('presets')}
        onOpenSpec={() => setModal('spec')}
        onOpenDesigns={() => setModal('designs')}
        onOpenValidate={() => setModal('validate')}
        onNew={newDesign}
        onLogout={() => {
          clearSession()
          setAuthed(false)
        }}
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
      <Toasts />
    </div>
  )
}
