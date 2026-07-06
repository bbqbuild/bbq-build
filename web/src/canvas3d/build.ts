// Builds the THREE.js kitchen from the same runs model as the 2D view.
// Units: 1 unit = 1 cm. x → right, y → up, z → toward viewer. Ground top at y=0.

import * as THREE from 'three'
import { getAppliance } from '../catalog/appliances'
import { computeScene, type SceneLayout3 } from '../canvas/scene'
import { TOP_HEIGHTS } from '../canvas/layout'
import type { Design, RunId } from '../types'
import { COUNTER_OVERHANG, COUNTER_T, GROUND_T, RUN_DEPTH, frameBodyH } from '../types'
import { FINISH_COLORS, applianceFrontTexture, frameFrontTexture, groundTopTexture, labelSprite } from './textures'
import { formatLenBare, type Unit } from '../units'

export interface RunBasis {
  id: RunId
  rotY: number
  /** world position for a point at run-u (cm along run), height y, centered in depth */
  pos: (u: number, y: number) => THREE.Vector3
  /** world point → run-local u */
  uOf: (p: THREE.Vector3) => number
  len: number
}

export interface Kitchen3D {
  group: THREE.Group
  pickables: THREE.Object3D[]
  bases: Map<RunId, RunBasis>
  scene2d: SceneLayout3
  /** center + radius for camera fitting */
  center: THREE.Vector3
  radius: number
}

const counterMat = new THREE.MeshStandardMaterial({ color: '#d8d2c4', roughness: 0.55, metalness: 0.05 })
const counterEdgeMat = new THREE.MeshStandardMaterial({ color: '#c4bdae', roughness: 0.6 })
const steelMat = new THREE.MeshStandardMaterial({ color: '#aab1b8', roughness: 0.35, metalness: 0.75 })
const darkMat = new THREE.MeshStandardMaterial({ color: '#2b2f34', roughness: 0.7, metalness: 0.3 })

function finishMat(finish: keyof typeof FINISH_COLORS): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: FINISH_COLORS[finish],
    roughness: finish === 'steel' ? 0.35 : 0.75,
    metalness: finish === 'steel' ? 0.7 : 0.15,
  })
}

export function buildKitchen(design: Design, unit: Unit, showDims: boolean): Kitchen3D {
  const scene2d = computeScene(design)
  const group = new THREE.Group()
  const pickables: THREE.Object3D[] = []
  const bases = new Map<RunId, RunBasis>()

  // ---- ground ----
  const g = scene2d.ground
  const groundGeo = new THREE.BoxGeometry(g.w, GROUND_T, g.d)
  const topTex = groundTopTexture(design.ground.type, g.w, g.d)
  const sideMat = new THREE.MeshStandardMaterial({ color: '#4a4038', roughness: 0.9 })
  const groundMats = [
    sideMat,
    sideMat,
    new THREE.MeshStandardMaterial({ map: topTex, roughness: 0.85 }),
    sideMat,
    sideMat,
    sideMat,
  ]
  const ground = new THREE.Mesh(groundGeo, groundMats)
  ground.position.set(g.x + g.w / 2, -GROUND_T / 2, g.z + g.d / 2)
  ground.receiveShadow = true
  ground.userData = { kind: 'ground' }
  group.add(ground)
  pickables.push(ground)

  // ---- run bases ----
  for (const run of scene2d.runs) {
    let basis: RunBasis
    if (run.id === 'back') {
      const ox = run.face.origin.x
      basis = {
        id: 'back',
        rotY: 0,
        pos: (u, y) => new THREE.Vector3(ox + u, y, RUN_DEPTH / 2),
        uOf: (p) => p.x - ox,
        len: run.elev.len,
      }
    } else if (run.id === 'island') {
      const ox = run.face.origin.x
      const z0 = run.plan.z
      basis = {
        id: 'island',
        rotY: 0,
        pos: (u, y) => new THREE.Vector3(ox + u, y, z0 + RUN_DEPTH / 2),
        uOf: (p) => p.x - ox,
        len: run.elev.len,
      }
    } else if (run.id === 'left') {
      const cx = run.plan.x + RUN_DEPTH / 2
      basis = {
        id: 'left',
        rotY: Math.PI / 2,
        pos: (u, y) => new THREE.Vector3(cx, y, RUN_DEPTH + u),
        uOf: (p) => p.z - RUN_DEPTH,
        len: run.elev.len,
      }
    } else {
      const cx = run.plan.x + RUN_DEPTH / 2
      basis = {
        id: 'right',
        rotY: -Math.PI / 2,
        pos: (u, y) => new THREE.Vector3(cx, y, RUN_DEPTH + u),
        uOf: (p) => p.z - RUN_DEPTH,
        len: run.elev.len,
      }
    }
    bases.set(run.id, basis)

    // ---- frames ----
    for (const fl of run.elev.frames) {
      const frame = fl.frame
      const bodyH = frameBodyH(frame)
      const base = design.appliances.find((a) => a.frameId === frame.id && a.zone === 'base')
      const frontTex = frameFrontTexture(frame, base)
      const fmat = finishMat(frame.finish)
      const mats = [fmat, fmat, fmat, fmat, new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.6 }), fmat]
      const box = new THREE.Mesh(new THREE.BoxGeometry(frame.width, bodyH, RUN_DEPTH - 2), mats)
      const c = basis.pos(fl.body.x + frame.width / 2, bodyH / 2)
      box.position.copy(c)
      box.rotation.y = basis.rotY
      box.castShadow = true
      box.receiveShadow = true
      box.userData = { kind: 'frame', id: frame.id, run: run.id }
      group.add(box)
      pickables.push(box)
    }

    // ---- counters (per segment) ----
    for (const seg of run.elev.counters) {
      const ce = counterEdgeMat.clone()
      const cbox = new THREE.Mesh(
        new THREE.BoxGeometry(seg.w, COUNTER_T, RUN_DEPTH + COUNTER_OVERHANG * 2),
        [ce, ce, counterMat.clone(), ce, ce, ce],
      )
      const cc = basis.pos(seg.x + seg.w / 2, -seg.y + COUNTER_T / 2)
      cbox.position.copy(cc)
      cbox.rotation.y = basis.rotY
      cbox.castShadow = true
      cbox.receiveShadow = true
      // counters pick as their run's nearest frame? keep unpickable-through: tag run
      cbox.userData = { kind: 'counter', run: run.id }
      group.add(cbox)
      pickables.push(cbox)
    }

    // ---- top-zone appliances ----
    for (const al of run.elev.appliances) {
      if (al.placed.zone !== 'top') continue
      let type
      try {
        type = getAppliance(al.placed.typeId)
      } catch {
        continue
      }
      const h = TOP_HEIGHTS[type.id] ?? (type.paintAs ? TOP_HEIGHTS[type.paintAs] : undefined) ?? 20
      const w = al.rect.w
      const counterTop = -al.frame.counterTopY
      const uCenter = al.rect.x + w / 2

      if (type.mount === 'kamado') {
        const paint = (type.paintAs ?? type.id).startsWith('egg')
        const r = Math.min(w * 0.36, 30)
        const kam = new THREE.Mesh(
          new THREE.SphereGeometry(r, 24, 18),
          new THREE.MeshStandardMaterial({ color: paint ? '#2f6a3c' : '#26292d', roughness: 0.35, metalness: 0.15 }),
        )
        kam.scale.set(1, 1.18, 1)
        kam.position.copy(basis.pos(uCenter, counterTop + r * 0.95))
        kam.castShadow = true
        kam.userData = { kind: 'appliance', id: al.placed.id, run: run.id }
        group.add(kam)
        pickables.push(kam)
        // chimney cap
        const cap = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 5, 12), steelMat.clone())
        cap.position.copy(basis.pos(uCenter, counterTop + r * 0.95 + r * 1.18))
        cap.userData = { kind: 'appliance', id: al.placed.id, run: run.id }
        group.add(cap)
        pickables.push(cap)
        continue
      }

      const depth = type.mount === 'oncounter' ? RUN_DEPTH - 18 : RUN_DEPTH - 12
      const texH = h + COUNTER_T
      const tex = applianceFrontTexture(al.placed, type, w, texH)
      const front = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.45, metalness: 0.4 })
      const sm = steelMat.clone()
      const mats = [sm, sm, sm, sm, front, darkMat.clone()]
      const abox = new THREE.Mesh(new THREE.BoxGeometry(w, texH, depth), mats)
      abox.position.copy(basis.pos(uCenter, counterTop + texH / 2 - COUNTER_T))
      abox.rotation.y = basis.rotY
      // shift toward the face so the art sits proud of the counter front
      abox.castShadow = true
      abox.userData = { kind: 'appliance', id: al.placed.id, run: run.id }
      group.add(abox)
      pickables.push(abox)
    }

    // ---- dimension sprites ----
    if (showDims && run.elev.frames.length) {
      const tops = run.elev.appliances.filter((a) => a.placed.zone === 'top').map((a) => -a.rect.y)
      const topY = Math.max(96, ...tops) + 14
      for (const fl of run.elev.frames) {
        const sp = labelSprite(formatLenBare(fl.frame.width, unit), 0.8)
        sp.position.copy(basis.pos(fl.body.x + fl.body.w / 2, topY))
        group.add(sp)
      }
      if (run.elev.frames.length > 1) {
        const total = labelSprite(`${formatLenBare(run.elev.len, unit)}${unit === 'cm' ? ' cm' : ''} total`, 0.9)
        total.position.copy(basis.pos(run.elev.len / 2, topY + 16))
        group.add(total)
      }
    }
  }

  // ---- corner units ----
  const layout = design.layout ?? 'straight'
  const hasL = layout === 'l-left' || layout === 'u'
  const hasR = layout === 'l-right' || layout === 'u'
  const cornerFinish = design.frames[0]?.finish ?? 'graphite'
  for (const side of [hasL ? 'L' : null, hasR ? 'R' : null]) {
    if (!side) continue
    const back = scene2d.runs.find((r) => r.id === 'back')!
    const x = side === 'L' ? back.plan.x - 60 : back.plan.x + back.plan.w
    const cbody = new THREE.Mesh(new THREE.BoxGeometry(60, 82, RUN_DEPTH - 2), finishMat(cornerFinish))
    cbody.position.set(x + 30, 41, RUN_DEPTH / 2)
    cbody.castShadow = true
    cbody.receiveShadow = true
    cbody.userData = { kind: 'corner' }
    group.add(cbody)
    pickables.push(cbody)
    const ctop = new THREE.Mesh(new THREE.BoxGeometry(60 + COUNTER_OVERHANG, COUNTER_T, RUN_DEPTH + COUNTER_OVERHANG * 2), counterMat.clone())
    ctop.position.set(x + 30, 82 + COUNTER_T / 2, RUN_DEPTH / 2)
    ctop.castShadow = true
    ctop.userData = { kind: 'corner' }
    group.add(ctop)
    pickables.push(ctop)
  }

  // ---- bounds ----
  const bbox = new THREE.Box3().setFromObject(group)
  const center = bbox.getCenter(new THREE.Vector3())
  const radius = Math.max(120, bbox.getSize(new THREE.Vector3()).length() / 2)

  return { group, pickables, bases, scene2d, center, radius }
}
