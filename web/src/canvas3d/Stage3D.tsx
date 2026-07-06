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
  u: number
}

export function Stage3D() {
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrap = wrapRef.current!
    const renderer = new THREE.WebGLRenderer({ antialias: true })
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
      if (e.button !== 0) return
      const s = useStore.getState()
      const hit = pick(e.clientX, e.clientY)
      downPos = { x: e.clientX, y: e.clientY }
      downHit = hit?.object ?? null

      if (s.measuring && hit) {
        addMeasurePoint(hit.point)
        downPos = null
        return
      }

      if (hit && hit.object.userData.kind === 'counter' && hit.object.userData.run === 'island' && kitchen) {
        const island = kitchen.scene2d.runs.find((r) => r.id === 'island')
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
          drag = { frameId: downHit.userData.id, runId: downHit.userData.run, u: 0 }
          controls.enabled = false
        }
      }
      if (drag && kitchen) {
        const hit = pick(e.clientX, e.clientY)
        if (hit) {
          // nearest run by picked point
          let best: { run: RunId; u: number; d: number } | null = null
          for (const [id, basis] of kitchen.bases) {
            const u = Math.max(0, Math.min(basis.len, basis.uOf(hit.point)))
            const p = basis.pos(u, 50)
            const d = p.distanceTo(hit.point)
            if (!best || d < best.d) best = { run: id, u, d }
          }
          if (best && best.d < 160) {
            drag.runId = best.run
            drag.u = best.u
            const basis = kitchen.bases.get(best.run)!
            // snap marker to insertion boundary
            const runScene = kitchen.scene2d.runs.find((r) => r.id === best.run)!
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
          const island = kitchen.scene2d.runs.find((r) => r.id === 'island')
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
        const runScene = kitchen.scene2d.runs.find((r) => r.id === drag!.runId)
        if (runScene) {
          let idx = 0
          for (const fl of runScene.elev.frames) {
            if (drag.u > fl.body.x + fl.body.w / 2) idx = fl.index + 1
          }
          const frame = s.design.frames.find((f) => f.id === drag!.frameId)
          if (frame && (frame.run ?? 'back') === drag.runId) {
            const cur = runScene.frames.findIndex((f) => f.id === frame.id)
            if (idx > cur) idx -= 1
          }
          s.moveFrame(drag.frameId, idx, drag.runId)
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
        if (!ud) s.select({ kind: 'none' })
        else if (ud.kind === 'corner') s.select({ kind: 'corner', id: ud.id })
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
        let best: { run: RunId; u: number; d: number } | null = null
        for (const [id, basis] of kitchen.bases) {
          const u = Math.max(0, Math.min(basis.len, basis.uOf(hit.point)))
          const d = basis.pos(u, 50).distanceTo(hit.point)
          if (!best || d < best.d) best = { run: id, u, d }
        }
        if (best && best.d < 220) {
          const basis = kitchen.bases.get(best.run)!
          const runScene = kitchen.scene2d.runs.find((r) => r.id === best.run)!
          let bx = 0
          for (const fl of runScene.elev.frames) {
            if (best.u > fl.body.x + fl.body.w / 2) bx = fl.body.x + fl.body.w
          }
          marker.position.copy(basis.pos(bx, 50))
          marker.rotation.y = basis.rotY
          marker.visible = true
          marker.userData = { run: best.run, u: best.u }
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
        let idx: number | undefined
        if (hit) {
          let best: { run: RunId; u: number; d: number } | null = null
          for (const [id, basis] of kitchen.bases) {
            const u = Math.max(0, Math.min(basis.len, basis.uOf(hit.point)))
            const d = basis.pos(u, 50).distanceTo(hit.point)
            if (!best || d < best.d) best = { run: id, u, d }
          }
          if (best && best.d < 260) {
            run = best.run
            const runScene = kitchen.scene2d.runs.find((r) => r.id === best.run)
            if (runScene) {
              idx = 0
              for (const fl of runScene.elev.frames) {
                if (best.u > fl.body.x + fl.body.w / 2) idx = fl.index + 1
              }
            }
          }
        }
        s.addFrameForAppliance(s.dragging.typeId, run, idx)
      } else if (s.dragging?.kind === 'frame' && marker.visible && kitchen) {
        const { run, u } = marker.userData as { run: RunId; u: number }
        const runScene = kitchen.scene2d.runs.find((r) => r.id === run)!
        let idx = 0
        for (const fl of runScene.elev.frames) {
          if (u > fl.body.x + fl.body.w / 2) idx = fl.index + 1
        }
        s.addFrame(s.dragging.width, idx, s.dragging.lowered, run)
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
