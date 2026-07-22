import { create } from 'zustand'
import { aiRenderPhotos } from '../auth/api'
import { specAsText } from '../spec'
import { useStore } from '../state/store'

export type Shot = { view: string; raw: string; image?: string; done: boolean }

interface RenderState {
  photos: Shot[] | null
  generating: boolean
  photoError: string | null
  videoUrl: string | null
  videoPct: number | null
  videoError: string | null
  generatePhotos: () => void
  recordVideo: () => void
}

/** Wait for the 3D stage to actually be mounted and have rendered at least one frame. */
function whenStage3DReady(cb: () => void, deadline = Date.now() + 3000) {
  if (document.querySelector('.stage3d-canvas')) {
    setTimeout(cb, 120)
    return
  }
  if (Date.now() > deadline) {
    cb() // give up waiting and try anyway rather than silently doing nothing
    return
  }
  requestAnimationFrame(() => whenStage3DReady(cb, deadline))
}

/**
 * AI photos + AI video generation/recording state, kept in its own store (rather than
 * component state) so an in-flight generation or recording survives the user closing the
 * Render panel or switching to another right-dock tab — RightDock's panel body unmounts
 * on close/tab-switch, which used to silently drop whatever was in progress.
 */
export const useRenderState = create<RenderState>((set) => ({
  photos: null,
  generating: false,
  photoError: null,
  videoUrl: null,
  videoPct: null,
  videoError: null,

  generatePhotos: () => {
    set({ generating: true, photoError: null })
    if (useStore.getState().viewMode !== '3d') useStore.getState().toggleView()
    whenStage3DReady(() => window.dispatchEvent(new CustomEvent('bbq:capture-photos')))
  },

  recordVideo: () => {
    set({ videoError: null, videoUrl: null, videoPct: 0 })
    if (useStore.getState().viewMode !== '3d') useStore.getState().toggleView()
    whenStage3DReady(() => window.dispatchEvent(new CustomEvent('bbq:flythrough-start')))
  },
}))

// Registered once at module load (not tied to any component's mount state) so results
// land here even if the Render panel isn't open when the AI response / recording finishes.
window.addEventListener('bbq:photos-captured', (e) => {
  const shots = ((e as CustomEvent).detail?.shots ?? []) as { view: string; dataUrl: string }[]
  if (!shots.length) {
    useRenderState.setState({ generating: false, photoError: 'Nothing to render yet — add some frames first.' })
    return
  }
  useRenderState.setState({ photos: shots.map((s) => ({ view: s.view, raw: s.dataUrl, done: false })) })
  aiRenderPhotos(shots, specAsText(useStore.getState().design, useStore.getState().unit))
    .then((res) => {
      useRenderState.setState({
        photos: shots.map((s, i) => ({ view: s.view, raw: s.dataUrl, image: res.photos[i]?.image, done: true })),
      })
    })
    .catch((err) => {
      useRenderState.setState({
        photoError: err instanceof Error ? err.message : 'Rendering failed — try again',
        // stop showing the loading shimmer even though we never got an AI image back —
        // fall back to the raw 3D screenshots rather than spinning forever
        photos: shots.map((s) => ({ view: s.view, raw: s.dataUrl, done: true })),
      })
    })
    .finally(() => useRenderState.setState({ generating: false }))
})

window.addEventListener('bbq:flythrough-progress', (e) => {
  useRenderState.setState({ videoPct: (e as CustomEvent).detail?.pct ?? null })
})
window.addEventListener('bbq:flythrough-done', (e) => {
  useRenderState.setState({ videoUrl: (e as CustomEvent).detail?.url ?? null, videoPct: null })
})
window.addEventListener('bbq:flythrough-error', (e) => {
  useRenderState.setState({ videoError: (e as CustomEvent).detail?.message ?? 'Could not record a video', videoPct: null })
})
