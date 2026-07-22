import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { getAppliance } from '../catalog/appliances'
import { checkPlacement } from '../catalog/compat'
import { useStore } from '../state/store'
import type { RunId } from '../types'
import { RUN_DEPTH } from '../types'
import { formatLen } from '../units'
import { buildKitchen, type Kitchen3D } from './build'
import { labelSprite } from './textures'

const ACCENT = 0xf59e0b

interface DragState {
  frameId: string
  runId: RunId
  struct?: string
  u: number
}

export function Stage3D() {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current!
    // preserveDrawingBuffer so AI-photo screenshots (toDataURL) reliably see the last render
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.25
    renderer.setClearColor(0x1a1e25)
    wrap.appendChild(renderer.domElement)
    renderer.domElement.className = 'stage3d-canvas'

    const scene = new THREE.Scene()
    scene.fog = new THREE.Fog(0x1a1e25, 2200, 4200)

    const camera = new THREE.PerspectiveCamera(42, 1, 5, 6000)
    camera.position.set(180, 260, 620)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI * 0.495
    controls.minDistance = 80
    controls.maxDistance = 2600
    controls.target.set(0, 60, 100)

    // lights
    scene.add(new THREE.AmbientLight(0xf3ede2, 0.75))
    const hemi = new THREE.HemisphereLight(0xcfd8e6, 0x2e2a24, 0.7)
    scene.add(hemi)
    const sun = new THREE.DirectionalLight(0xfff2dd, 2.3)
    sun.position.set(-350, 500, 380)
    sun.castShadow = true
    sun.shadow.mapSize.set(2048, 2048)
    sun.shadow.camera.left = -700
    sun.shadow.camera.right = 700
    sun.shadow.camera.top = 700
    sun.shadow.camera.bottom = -700
    sun.shadow.bias = -0.0004
    scene.add(sun)

    // infinite-ish floor catcher (subtle, below the platform)
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(3000, 48),
      new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 1 }),
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -14.5
    floor.receiveShadow = true
    scene.add(floor)

    let kitchen: Kitchen3D | null = null
    let designJson = ''
    let extrasJson = ''
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    let hovered: THREE.Object3D | null = null
    const selectBox = new THREE.Box3Helper(new THREE.Box3(), ACCENT)
    selectBox.visible = false
    scene.add(selectBox)
    // multi-selection / group member boxes (rebuilt when the selection changes)
    const multiSel = new THREE.Group()
    scene.add(multiSel)
    let multiSelJson = ''
    const dropBox = new THREE.Box3Helper(new THREE.Box3(), 0xfbbf24)
    dropBox.visible = false
    scene.add(dropBox)

    // insertion marker for frame drags
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 100, 66),
      new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.85 }),
    )
    marker.visible = false
    scene.add(marker)

    // measure tool visuals
    const measureGroup = new THREE.Group()
    scene.add(measureGroup)
    let measurePts: THREE.Vector3[] = []

    let drag: DragState | null = null
    let islandDrag: { plane: THREE.Plane; start: THREE.Vector3; orig: { x: number; z: number } } | null = null
    let downPos: { x: number; y: number } | null = null
    let downHit: THREE.Object3D | null = null
    let openT = 0
    // true while a photo capture or flythrough recording is overriding the camera —
    // pointer interaction is suspended so the user can't fight the scripted camera
    let capturing = false

    function resize() {
      const w = wrap.clientWidth
      const h = wrap.clientHeight
      if (w === 0 || h === 0) return
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    function rebuild() {
      const s = useStore.getState()
      if (kitchen) {
        scene.remove(kitchen.group)
        kitchen.group.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            o.geometry.dispose()
            const mats = Array.isArray(o.material) ? o.material : [o.material]
            mats.forEach((m) => {
              if ((m as THREE.MeshStandardMaterial).map) (m as THREE.MeshStandardMaterial).map!.dispose()
              m.dispose()
            })
          }
        })
      }
      kitchen = buildKitchen(s.design, s.unit, s.showDims)
      scene.add(kitchen.group)
    }

    function fit() {
      if (!kitchen) return
      const c = kitchen.center
      controls.target.copy(c)
      const dist = kitchen.radius * 2.1
      const dir = new THREE.Vector3(0.28, 0.42, 1).normalize()
      camera.position.copy(c.clone().add(dir.multiplyScalar(dist)))
      controls.update()
    }

    const onFit = () => fit()
    const onZoom = (e: Event) => {
      const factor = (e as CustomEvent).detail?.factor ?? 1.2
      const v = camera.position.clone().sub(controls.target)
      camera.position.copy(controls.target.clone().add(v.multiplyScalar(1 / factor)))
      controls.update()
    }
    window.addEventListener('bbq:fit', onFit)
    window.addEventListener('bbq:zoom', onZoom)

    // ---------- AI photos: screenshot the real model from a few fixed angles ----------

    /** Downscale + JPEG-compress the canvas so 3-4 shots stay well under the request body limit. */
    function toResizedJpeg(maxDim = 900, quality = 0.85): string {
      const src = renderer.domElement
      const scale = Math.min(1, maxDim / Math.max(src.width, src.height))
      const w = Math.max(1, Math.round(src.width * scale))
      const h = Math.max(1, Math.round(src.height * scale))
      const off = document.createElement('canvas')
      off.width = w
      off.height = h
      off.getContext('2d')!.drawImage(src, 0, 0, w, h)
      return off.toDataURL('image/jpeg', quality)
    }

    const CAPTURE_SHOTS: { view: string; dir: [number, number, number]; distMul: number }[] = [
      { view: 'Three-quarter (left)', dir: [0.55, 0.3, 1], distMul: 2.0 },
      { view: 'Three-quarter (right)', dir: [-0.55, 0.3, 1], distMul: 2.0 },
      { view: 'Straight-on', dir: [0, 0.18, 1], distMul: 2.35 },
      { view: 'High angle', dir: [0.35, 0.95, 0.55], distMul: 2.1 },
    ]

    function capturePhotos(): { view: string; dataUrl: string }[] {
      if (!kitchen) return []
      const savedPos = camera.position.clone()
      const savedTarget = controls.target.clone()
      const c = kitchen.center
      const r = Math.max(kitchen.radius, 120)
      const shots: { view: string; dataUrl: string }[] = []
      for (const shot of CAPTURE_SHOTS) {
        controls.target.copy(c)
        const dir = new THREE.Vector3(...shot.dir).normalize()
        camera.position.copy(c.clone().add(dir.multiplyScalar(r * shot.distMul)))
        controls.update()
        renderer.render(scene, camera)
        shots.push({ view: shot.view, dataUrl: toResizedJpeg() })
      }
      camera.position.copy(savedPos)
      controls.target.copy(savedTarget)
      controls.update()
      renderer.render(scene, camera)
      return shots
    }

    const onCaptureRequest = () => {
      if (capturing) return
      const shots = capturePhotos()
      window.dispatchEvent(new CustomEvent('bbq:photos-captured', { detail: { shots } }))
    }
    window.addEventListener('bbq:capture-photos', onCaptureRequest)

    // ---------- AI video: record a scripted orbit of the real model ----------

    async function runFlythrough() {
      if (!kitchen || capturing) return
      capturing = true
      const savedPos = camera.position.clone()
      const savedTarget = controls.target.clone()
      const savedEnabled = controls.enabled
      controls.enabled = false
      const c = kitchen.center
      const r = Math.max(kitchen.radius, 140)
      const DURATION = 7000

      let stream: MediaStream
      try {
        stream = renderer.domElement.captureStream(30)
      } catch {
        capturing = false
        controls.enabled = savedEnabled
        window.dispatchEvent(
          new CustomEvent('bbq:flythrough-error', { detail: { message: 'Video recording is not supported in this browser' } }),
        )
        return
      }
      const mime =
        ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) ||
        'video/webm'
      const chunks: BlobPart[] = []
      let rec: MediaRecorder
      try {
        rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6_000_000 })
      } catch {
        capturing = false
        controls.enabled = savedEnabled
        window.dispatchEvent(new CustomEvent('bbq:flythrough-error', { detail: { message: 'Could not start the recorder' } }))
        return
      }
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data)
      }
      const stopped = new Promise<Blob>((resolve) => {
        rec.onstop = () => resolve(new Blob(chunks, { type: mime }))
      })
      rec.start()

      const t0 = performance.now()
      await new Promise<void>((resolve) => {
        function step(now: number) {
          const t = Math.min(1, (now - t0) / DURATION)
          window.dispatchEvent(new CustomEvent('bbq:flythrough-progress', { detail: { pct: Math.round(t * 100) } }))
          // ~1.3 turns around the kitchen with a gentle rise/fall and a slow push-in
          const angle = -Math.PI * 0.55 + t * Math.PI * 1.3
          const height = 0.28 + 0.24 * Math.sin(t * Math.PI)
          const dist = r * (2.6 - 0.75 * Math.sin(t * Math.PI * 0.85))
          const dir = new THREE.Vector3(Math.sin(angle), height, Math.cos(angle))
          camera.position.copy(c.clone().add(dir.multiplyScalar(dist)))
          camera.lookAt(c.clone().add(new THREE.Vector3(0, 20, 0)))
          renderer.render(scene, camera)
          if (t < 1) requestAnimationFrame(step)
          else resolve()
        }
        requestAnimationFrame(step)
      })

      rec.stop()
      const blob = await stopped
      camera.position.copy(savedPos)
      controls.target.copy(savedTarget)
      controls.enabled = savedEnabled
      controls.update()
      capturing = false
      window.dispatchEvent(new CustomEvent('bbq:flythrough-done', { detail: { url: URL.createObjectURL(blob) } }))
    }
    const onFlythroughRequest = () => {
      runFlythrough()
    }
    window.addEventListener('bbq:flythrough-start', onFlythroughRequest)

    // ---------- picking ----------

    function pick(clientX: number, clientY: number): THREE.Intersection | null {
      if (!kitchen) return null
      const r = renderer.domElement.getBoundingClientRect()
      pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1)
      raycaster.setFromCamera(pointer, camera)
      const hits = raycaster.intersectObjects(kitchen.pickables, true)
      return hits[0] ?? null
    }

    function frameOf(obj: THREE.Object3D): string | null {
      const ud = obj.userData
      if (ud.kind === 'frame') return ud.id
      if (ud.kind === 'appliance') {
        const s = useStore.getState()
        const placed = s.design.appliances.find((a) => a.id === ud.id)
        return placed?.frameId ?? null
      }
      return null
    }

    function setEmissive(obj: THREE.Object3D | null, on: boolean) {
      if (!obj || !(obj instanceof THREE.Mesh)) return
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
      for (const m of mats) {
        const ms = m as THREE.MeshStandardMaterial
        if (ms.emissive) ms.emissive.setHex(on ? 0x6b4708 : 0x000000)
      }
    }

    // ---------- pointer handlers ----------

    function onPointerDown(e: PointerEvent) {
      if (e.button !== 0 || capturing) return
      const s = useStore.getState()
      const hit = pick(e.clientX, e.clientY)
      downPos = { x: e.clientX, y: e.clientY }
      downHit = hit?.object ?? null

      if (s.measuring && hit) {
        addMeasurePoint(hit.point)
        downPos = null
        return
      }

      if (hit && hit.object.userData.kind === 'counter' && hit.object.userData.run === 'island' && !hit.object.userData.struct && kitchen) {
        const island = kitchen.scene2d.runs.find((r) => r.id === 'island' && !r.struct)
        if (island) {
          islandDrag = {
            plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), -hit.point.y),
            start: hit.point.clone(),
            orig: { x: island.plan.x + island.plan.w / 2, z: island.plan.z },
          }
          controls.enabled = false
          renderer.domElement.style.cursor = 'grabbing'
        }
      }
    }

    function onPointerMove(e: PointerEvent) {
      if (capturing) return
      const s = useStore.getState()
      if (islandDrag && kitchen) {
        const r = renderer.domElement.getBoundingClientRect()
        pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
        raycaster.setFromCamera(pointer, camera)
        const pt = new THREE.Vector3()
        if (raycaster.ray.intersectPlane(islandDrag.plane, pt)) {
          const dx = Math.round((pt.x - islandDrag.start.x) / 5) * 5
          const dz = Math.round((pt.z - islandDrag.start.z) / 5) * 5
          kitchen.islandGroup.position.set(dx, 0, dz)
        }
        return
      }
      if (downPos && downHit && downHit.userData.kind === 'frame' && !drag) {
        if (Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) > 6) {
          drag = { frameId: downHit.userData.id, runId: downHit.userData.run, struct: downHit.userData.struct, u: 0 }
          controls.enabled = false
        }
      }
      if (drag && kitchen) {
        const hit = pick(e.clientX, e.clientY)
        if (hit) {
          // nearest run by picked point
          let best: { key: string; u: number; d: number } | null = null
          for (const [key, basis] of kitchen.bases) {
            const u = Math.max(0, Math.min(basis.len, basis.uOf(hit.point)))
            const p = basis.pos(u, 50)
            const d = p.distanceTo(hit.point)
            if (!best || d < best.d) best = { key, u, d }
          }
          if (best && best.d < 160) {
            const basis = kitchen.bases.get(best.key)!
            drag.runId = basis.id
            drag.struct = basis.struct
            drag.u = best.u
            // snap marker to insertion boundary
            const runScene = kitchen.scene2d.runs.find((r) => r.id === basis.id && r.struct === basis.struct)!
            let bx = 0
            for (const fl of runScene.elev.frames) {
              if (best.u > fl.body.x + fl.body.w / 2) bx = fl.body.x + fl.body.w
            }
            marker.position.copy(basis.pos(bx, 50))
            marker.rotation.y = basis.rotY
            marker.visible = true
          }
        }
        return
      }

      // hover
      const hit = pick(e.clientX, e.clientY)
      const obj = hit && ['frame', 'appliance'].includes(hit.object.userData.kind) ? hit.object : null
      if (obj !== hovered) {
        setEmissive(hovered, false)
        hovered = obj
        setEmissive(hovered, true)
      }
      renderer.domElement.style.cursor = s.measuring ? 'crosshair' : obj ? 'pointer' : 'grab'
    }

    function onPointerUp(e: PointerEvent) {
      const s = useStore.getState()
      if (islandDrag && kitchen) {
        const off = kitchen.islandGroup.position
        if (Math.abs(off.x) > 0.1 || Math.abs(off.z) > 0.1) {
          const g = kitchen.scene2d.ground
          const island = kitchen.scene2d.runs.find((r) => r.id === 'island' && !r.struct)
          const halfW = (island?.plan.w ?? 60) / 2
          const nx = Math.min(g.x + g.w - halfW, Math.max(g.x + halfW, islandDrag.orig.x + off.x))
          const nz = Math.min(g.z + g.d - 70, Math.max(RUN_DEPTH + 10, islandDrag.orig.z + off.z))
          s.setIslandPos(nx, nz)
        }
        islandDrag = null
        controls.enabled = true
        renderer.domElement.style.cursor = 'default'
        downPos = null
        return
      }
      if (drag && kitchen) {
        const runScene = kitchen.scene2d.runs.find((r) => r.id === drag!.runId && r.struct === drag!.struct)
        if (runScene) {
          let idx = 0
          for (const fl of runScene.elev.frames) {
            if (drag.u > fl.body.x + fl.body.w / 2) idx = fl.index + 1
          }
          const frame = s.design.frames.find((f) => f.id === drag!.frameId)
          if (frame && (frame.run ?? 'back') === drag.runId && frame.struct === drag.struct) {
            const cur = runScene.frames.findIndex((f) => f.id === frame.id)
            if (idx > cur) idx -= 1
          }
          s.moveFrame(drag.frameId, idx, drag.runId, drag.struct)
          s.select({ kind: 'frame', id: drag.frameId })
        }
        drag = null
        marker.visible = false
        controls.enabled = true
        downPos = null
        return
      }
      if (downPos && Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y) < 5) {
        const hit = pick(e.clientX, e.clientY)
        const ud = hit?.object.userData
        if (ud?.kind === 'frame' && e.shiftKey) {
          // shift-click builds a multi-selection (for grouping)
          s.toggleMultiSelect(ud.id)
        } else if (ud?.kind === 'appliance' && e.shiftKey) {
          // shift on an appliance selects its frame into the multi-selection
          const placed = s.design.appliances.find((a) => a.id === ud.id)
          if (placed) s.toggleMultiSelect(placed.frameId)
        } else if (!ud) s.select({ kind: 'none' })
        else if (ud.kind === 'corner') s.select({ kind: 'corner', id: ud.id })
        else if (ud.kind === 'struct') s.select({ kind: 'struct', id: ud.id })
        else if (ud.kind === 'ground') s.select({ kind: 'ground' })
        else if (ud.kind === 'frame') s.select({ kind: 'frame', id: ud.id })
        else if (ud.kind === 'appliance') s.select({ kind: 'appliance', id: ud.id })
        else if (ud.kind === 'counter') s.select({ kind: 'counter' })
      }
      downPos = null
    }

    renderer.domElement.addEventListener('pointerdown', onPointerDown)
    renderer.domElement.addEventListener('pointermove', onPointerMove)
    renderer.domElement.addEventListener('pointerup', onPointerUp)

    // ---------- measure tool ----------

    function addMeasurePoint(p: THREE.Vector3) {
      measurePts.push(p.clone())
      if (measurePts.length > 2) {
        measurePts = [p.clone()]
      }
      redrawMeasure()
    }

    function redrawMeasure() {
      measureGroup.clear()
      for (const p of measurePts) {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), new THREE.MeshBasicMaterial({ color: ACCENT }))
        dot.position.copy(p)
        measureGroup.add(dot)
      }
      if (measurePts.length === 2) {
        const [a, b] = measurePts
        const geo = new THREE.BufferGeometry().setFromPoints([a, b])
        const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: ACCENT }))
        measureGroup.add(line)
        const dist = a.distanceTo(b)
        const label = labelSprite(formatLen(Math.round(dist), useStore.getState().unit), 1.1, 'rgba(120,72,10,0.95)')
        label.position.copy(a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 10, 0)))
        measureGroup.add(label)
      }
    }

    // ---------- catalog drag & drop ----------

    function onDragOver(e: DragEvent) {
      const s = useStore.getState()
      if (!s.dragging || !kitchen) return
      e.preventDefault()
      const hit = pick(e.clientX, e.clientY)
      dropBox.visible = false
      marker.visible = false
      if (!hit) return
      if (s.dragging.kind === 'appliance') {
        const frameId = hit.object ? frameOf(hit.object) : null
        const frame = s.design.frames.find((f) => f.id === frameId)
        const type = getAppliance(s.dragging.typeId)
        if (frame && checkPlacement(s.design, frame, type).ok) {
          const mesh = kitchen.pickables.find((o) => o.userData.kind === 'frame' && o.userData.id === frame.id)
          if (mesh) {
            ;(dropBox.box as THREE.Box3).setFromObject(mesh)
            dropBox.visible = true
            dropBox.userData = { frameId: frame.id }
          }
        } else {
          dropBox.userData = {}
        }
      } else if (s.dragging.kind === 'frame') {
        let best: { key: string; u: number; d: number } | null = null
        for (const [key, basis] of kitchen.bases) {
          const u = Math.max(0, Math.min(basis.len, basis.uOf(hit.point)))
          const d = basis.pos(u, 50).distanceTo(hit.point)
          if (!best || d < best.d) best = { key, u, d }
        }
        if (best && best.d < 220) {
          const basis = kitchen.bases.get(best.key)!
          const runScene = kitchen.scene2d.runs.find((r) => r.id === basis.id && r.struct === basis.struct)!
          let bx = 0
          for (const fl of runScene.elev.frames) {
            if (best.u > fl.body.x + fl.body.w / 2) bx = fl.body.x + fl.body.w
          }
          marker.position.copy(basis.pos(bx, 50))
          marker.rotation.y = basis.rotY
          marker.visible = true
          marker.userData = { run: basis.id, struct: basis.struct, u: best.u }
        }
      }
    }

    function onDrop(e: DragEvent) {
      e.preventDefault()
      const s = useStore.getState()
      if (s.dragging?.kind === 'appliance' && dropBox.visible && dropBox.userData.frameId) {
        s.placeAppliance(dropBox.userData.frameId, s.dragging.typeId)
      } else if (s.dragging?.kind === 'appliance' && kitchen) {
        // dropped on blank space → auto-create a compatible frame there
        const hit = pick(e.clientX, e.clientY)
        let run: RunId = 'back'
        let struct: string | undefined
        let idx: number | undefined
        if (hit) {
          let best: { key: string; u: number; d: number } | null = null
          for (const [key, basis] of kitchen.bases) {
            const u = Math.max(0, Math.min(basis.len, basis.uOf(hit.point)))
            const d = basis.pos(u, 50).distanceTo(hit.point)
            if (!best || d < best.d) best = { key, u, d }
          }
          if (best && best.d < 260) {
            const basis = kitchen.bases.get(best.key)!
            run = basis.id
            struct = basis.struct
            const runScene = kitchen.scene2d.runs.find((r) => r.id === basis.id && r.struct === basis.struct)
            if (runScene) {
              idx = 0
              for (const fl of runScene.elev.frames) {
                if (best.u > fl.body.x + fl.body.w / 2) idx = fl.index + 1
              }
            }
          }
        }
        s.addFrameForAppliance(s.dragging.typeId, run, idx, struct)
      } else if (s.dragging?.kind === 'frame' && marker.visible && kitchen) {
        const { run, struct, u } = marker.userData as { run: RunId; struct?: string; u: number }
        const runScene = kitchen.scene2d.runs.find((r) => r.id === run && r.struct === struct)!
        let idx = 0
        for (const fl of runScene.elev.frames) {
          if (u > fl.body.x + fl.body.w / 2) idx = fl.index + 1
        }
        s.addFrame(s.dragging.width, idx, s.dragging.lowered, run, struct)
      }
      dropBox.visible = false
      marker.visible = false
      s.setDragging(null)
    }

    function onDragLeave() {
      dropBox.visible = false
      marker.visible = false
    }

    renderer.domElement.addEventListener('dragover', onDragOver)
    renderer.domElement.addEventListener('drop', onDrop)
    renderer.domElement.addEventListener('dragleave', onDragLeave)

    // ---------- x-ray occlusion ----------

    const dimmed = new Set<THREE.Mesh>()

    function updateXray() {
      if (!kitchen) return
      for (const m of dimmed) {
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        mats.forEach((mm) => {
          mm.opacity = 1
          if ('__origTransparent' in mm.userData) mm.transparent = mm.userData.__origTransparent
        })
      }
      dimmed.clear()
      const s = useStore.getState()
      if (s.selection.kind !== 'frame' && s.selection.kind !== 'appliance') return
      const targetId = s.selection.id
      let target: THREE.Object3D | null = null
      kitchen.group.traverse((o) => {
        if (!target && o.userData.id === targetId && (o.userData.kind === 'frame' || o.userData.kind === 'appliance')) target = o
      })
      if (!target) return
      const tc = new THREE.Box3().setFromObject(target).getCenter(new THREE.Vector3())
      const dir = tc.clone().sub(camera.position)
      const dist = dir.length()
      raycaster.set(camera.position, dir.normalize())
      raycaster.far = dist - 4
      const hits = raycaster.intersectObjects(kitchen.pickables, true)
      raycaster.far = Infinity
      for (const h of hits) {
        const obj = h.object as THREE.Mesh
        if (obj === target || obj.userData.id === targetId || obj.userData.kind === 'ground') continue
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material]
        mats.forEach((mm) => {
          if (!('__origTransparent' in mm.userData)) mm.userData.__origTransparent = mm.transparent
          mm.transparent = true
          mm.opacity = 0.22
        })
        dimmed.add(obj)
      }
    }

    // ---------- selection box + render loop ----------

    let raf = 0
    function loop() {
      const s = useStore.getState()
      const extras = JSON.stringify([s.unit, s.showDims])
      const dj = JSON.stringify(s.design)
      if (dj !== designJson || extras !== extrasJson) {
        designJson = dj
        extrasJson = extras
        const firstBuild = !kitchen
        rebuild()
        if (firstBuild) fit()
      }
      if (!s.measuring && measurePts.length) {
        measurePts = []
        measureGroup.clear()
      }

      // open-animation lerp
      const targetOpen = s.openMode ? 1 : 0
      openT += (targetOpen - openT) * 0.14
      if (Math.abs(targetOpen - openT) < 0.001) openT = targetOpen
      if (kitchen) {
        for (const p of kitchen.anim) {
          if (p.kind === 'hingeY') p.obj.rotation.y = p.amount * openT
          else if (p.kind === 'liftX') p.obj.rotation.x = p.amount * openT
          else if (p.kind === 'slideZ') p.obj.position.z = p.base + p.amount * openT
          else if (p.kind === 'liftY') p.obj.position.y = p.base + p.amount * openT
        }
      }

      // selection helper box
      if (kitchen && s.selection.kind === 'counter') {
        const box = new THREE.Box3()
        let found = false
        kitchen.group.traverse((o) => { if (o.userData.kind === 'counter') { box.union(new THREE.Box3().setFromObject(o)); found = true } })
        selectBox.visible = found
        if (found) (selectBox.box as THREE.Box3).copy(box.expandByScalar(1))
      } else if (kitchen && (s.selection.kind === 'frame' || s.selection.kind === 'appliance' || s.selection.kind === 'corner')) {
        const id = s.selection.id
        const kind = s.selection.kind
        const box = new THREE.Box3()
        let found = false
        kitchen.group.traverse((o) => {
          if (o.userData.kind === kind && o.userData.id === id) {
            box.union(new THREE.Box3().setFromObject(o))
            found = true
          }
        })
        selectBox.visible = found
        if (found) (selectBox.box as THREE.Box3).copy(box.expandByScalar(1.5))
      } else {
        selectBox.visible = false
      }

      // multi / group highlight: one box per member frame
      {
        const memberIds =
          s.selection.kind === 'multi'
            ? s.selection.ids
            : s.selection.kind === 'group'
              ? (s.design.groups?.find((g) => g.id === (s.selection as { id: string }).id)?.frameIds ?? [])
              : []
        const key = memberIds.join(',') + '|' + designJson.length
        if (key !== multiSelJson) {
          multiSelJson = key
          multiSel.clear()
          if (kitchen && memberIds.length) {
            for (const fid of memberIds) {
              const box = new THREE.Box3()
              let found = false
              kitchen.group.traverse((o) => {
                if (o.userData.kind === 'frame' && o.userData.id === fid) {
                  box.union(new THREE.Box3().setFromObject(o))
                  found = true
                }
              })
              if (found) multiSel.add(new THREE.Box3Helper(box.expandByScalar(1.5), ACCENT))
            }
          }
        }
      }

      updateXray()
      controls.update()
      renderer.render(scene, camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('bbq:fit', onFit)
      window.removeEventListener('bbq:zoom', onZoom)
      window.removeEventListener('bbq:capture-photos', onCaptureRequest)
      window.removeEventListener('bbq:flythrough-start', onFlythroughRequest)
      renderer.domElement.remove()
      renderer.dispose()
      controls.dispose()
    }
  }, [])

  const measuring = useStore((s) => s.measuring)
  return (
    <div ref={wrapRef} className="canvas-wrap stage3d">
      {measuring && <div className="measure-hint">📏 Click two points to measure — Esc to exit</div>}
    </div>
  )
}
