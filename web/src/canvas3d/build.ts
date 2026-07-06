// Builds the THREE.js kitchen from the same runs model as the 2D view.
// Units: 1 unit = 1 cm. x → right, y → up, z → toward viewer. Ground top at y=0.

import * as THREE from 'three'
import { getAppliance } from '../catalog/appliances'
import { computeScene, type SceneLayout3 } from '../canvas/scene'
import type { Design, RunId } from '../types'
import { COUNTER_OVERHANG, COUNTER_T, GROUND_T, RUN_DEPTH, cornerFor, frameBodyH } from '../types'
import { FINISH_COLORS, frameFrontTexture, groundTopTexture, labelSprite } from './textures'
import { baseAppliance3d, topAppliance3d, type AnimPart } from './appliances3d'
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
  /** animatable appliance parts (doors, drawers, hoods, lids) */
  anim: AnimPart[]
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
  const anim: AnimPart[] = []

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

    // ---- frames (per-frame group so appliance parts can animate in local space) ----
    for (const fl of run.elev.frames) {
      const frame = fl.frame
      const bodyH = frameBodyH(frame)
      const centerU = fl.body.x + frame.width / 2

      const fgroup = new THREE.Group()
      fgroup.position.copy(basis.pos(centerU, 0))
      fgroup.rotation.y = basis.rotY
      group.add(fgroup)
      pickables.push(fgroup)

      // body with a dark cavity front (base appliance is real 3D geometry)
      const hasBase = design.appliances.some((a) => a.frameId === frame.id && a.zone === 'base')
      const frontTex = frameFrontTexture(frame, hasBase)
      const fmat = finishMat(frame.finish)
      const mats = [fmat, fmat, fmat, fmat, new THREE.MeshStandardMaterial({ map: frontTex, roughness: 0.6 }), fmat]
      const body = new THREE.Mesh(new THREE.BoxGeometry(frame.width, bodyH, RUN_DEPTH - 2), mats)
      body.position.set(0, bodyH / 2, 0)
      body.castShadow = true
      body.receiveShadow = true
      body.userData = { kind: 'frame', id: frame.id, run: run.id }
      fgroup.add(body)

      // base appliance
      const base = design.appliances.find((a) => a.frameId === frame.id && a.zone === 'base')
      if (base) {
        try {
          const bt = getAppliance(base.typeId)
          const built = baseAppliance3d(base, bt, frame.width, bodyH)
          for (const m of built.meshes) {
            m.traverse((c) => {
              if (c.userData.kind === 'appliance') c.userData.run = run.id
            })
            fgroup.add(m)
          }
          anim.push(...built.parts)
        } catch {
          /* unknown type */
        }
      }

      // top appliance
      const top = design.appliances.find((a) => a.frameId === frame.id && a.zone === 'top')
      if (top) {
        try {
          const tt = getAppliance(top.typeId)
          const built = topAppliance3d(top, tt, frame.width, -fl.counterTopY)
          for (const m of built.meshes) {
            m.traverse((c) => {
              if (c.userData.kind === 'appliance') c.userData.run = run.id
            })
            fgroup.add(m)
          }
          anim.push(...built.parts)
        } catch {
          /* unknown type */
        }
      }
    }

    // ---- counters (per segment) ----
    for (const seg of run.elev.counters) {
      const ce = counterEdgeMat.clone()
      const cbox = new THREE.Mesh(
        new THREE.BoxGeometry(seg.w, COUNTER_T, RUN_DEPTH + COUNTER_OVERHANG * 2),
        [ce, ce, counterMat.clone(), ce, ce, ce],
      )
      cbox.position.copy(basis.pos(seg.x + seg.w / 2, -seg.y + COUNTER_T / 2))
      cbox.rotation.y = basis.rotY
      cbox.castShadow = true
      cbox.receiveShadow = true
      cbox.userData = { kind: 'counter', run: run.id }
      group.add(cbox)
      pickables.push(cbox)
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
  const back = scene2d.runs.find((r) => r.id === 'back')
  for (const side of ['left', 'right'] as const) {
    const corner = cornerFor(design, side)
    if (!corner || !back) continue
    const bodyH = corner.lowered ? 58 : 82
    const x = side === 'left' ? back.plan.x - 60 : back.plan.x + back.plan.w
    const cbody = new THREE.Mesh(new THREE.BoxGeometry(60, bodyH, RUN_DEPTH - 2), finishMat(corner.finish))
    cbody.position.set(x + 30, bodyH / 2, RUN_DEPTH / 2)
    cbody.castShadow = true
    cbody.receiveShadow = true
    cbody.userData = { kind: 'corner', id: side }
    group.add(cbody)
    pickables.push(cbody)
    const ctop = new THREE.Mesh(new THREE.BoxGeometry(60 + COUNTER_OVERHANG, COUNTER_T, RUN_DEPTH + COUNTER_OVERHANG * 2), counterMat.clone())
    ctop.position.set(x + 30, bodyH + COUNTER_T / 2, RUN_DEPTH / 2)
    ctop.castShadow = true
    ctop.userData = { kind: 'corner', id: side }
    group.add(ctop)
    pickables.push(ctop)
  }

  // ---- ground dimension lines (measures on the canvas) ----
  if (showDims) {
    const dimMat = new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.7 })
    const mkDim = (a: THREE.Vector3, b: THREE.Vector3, text: string) => {
      const geo = new THREE.BufferGeometry().setFromPoints([a, b])
      group.add(new THREE.Line(geo, dimMat))
      const tick = (p: THREE.Vector3, dir: THREE.Vector3) => {
        const t = new THREE.BufferGeometry().setFromPoints([p.clone().add(dir), p.clone().sub(dir)])
        group.add(new THREE.Line(t, dimMat))
      }
      const perp = new THREE.Vector3(0, 6, 0)
      tick(a, perp)
      tick(b, perp)
      const sp = labelSprite(text, 0.85)
      sp.position.copy(a.clone().add(b).multiplyScalar(0.5).add(new THREE.Vector3(0, 8, 0)))
      group.add(sp)
    }
    const y = 2
    // width along the front edge
    mkDim(
      new THREE.Vector3(g.x, y, g.z + g.d + 10),
      new THREE.Vector3(g.x + g.w, y, g.z + g.d + 10),
      formatLenBare(design.ground.width, unit) + (unit === 'cm' ? ' cm' : ''),
    )
    // depth along the right edge
    mkDim(
      new THREE.Vector3(g.x + g.w + 10, y, g.z),
      new THREE.Vector3(g.x + g.w + 10, y, g.z + g.d),
      formatLenBare(g.d, unit) + (unit === 'cm' ? ' cm' : ''),
    )
  }

  // ---- bounds ----
  const bbox = new THREE.Box3().setFromObject(group)
  const center = bbox.getCenter(new THREE.Vector3())
  const radius = Math.max(120, bbox.getSize(new THREE.Vector3()).length() / 2)

  return { group, pickables, bases, scene2d, anim, center, radius }
}
