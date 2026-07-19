// Builds the THREE.js kitchen from the same runs model as the 2D view.
// Units: 1 unit = 1 cm. x → right, y → up, z → toward viewer. Ground top at y=0.

import * as THREE from 'three'
import { getAppliance } from '../catalog/appliances'
import { computeScene, type SceneLayout3 } from '../canvas/scene'
import type { Design, RunId } from '../types'
import { COUNTER_OVERHANG, COUNTER_T, GROUND_T, RUN_DEPTH, cornerFor, frameBodyH, structCornerFor } from '../types'
import { FINISH_COLORS, frameFrontTexture, groundTopTexture, labelSprite } from './textures'
import { counterMaterial } from '../catalog/frames'
import { baseAppliance3d, topAppliance3d, type AnimPart } from './appliances3d'
import { formatLenBare, type Unit } from '../units'

export interface RunBasis {
  id: RunId
  /** structure this run belongs to (absent = main) */
  struct?: string
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
  /** keyed `${struct ?? ''}:${runId}` so structure runs don't collide with main */
  bases: Map<string, RunBasis>
  scene2d: SceneLayout3
  /** animatable appliance parts (doors, drawers, hoods, lids) */
  anim: AnimPart[]
  /** all island-run objects, for transient drag-translation */
  islandGroup: THREE.Group
  /** center + radius for camera fitting */
  center: THREE.Vector3
  radius: number
}

// counter materials are built per-design from design.counterMaterial
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
  const cm = counterMaterial(design.counterMaterial)
  const counterMat = new THREE.MeshStandardMaterial({ color: cm.color, roughness: cm.roughness, metalness: 0.05 })
  const counterEdgeMat = new THREE.MeshStandardMaterial({ color: cm.edge, roughness: cm.roughness + 0.1 })
  const group = new THREE.Group()
  const islandGroup = new THREE.Group()
  group.add(islandGroup)
  const pickables: THREE.Object3D[] = []
  const bases = new Map<string, RunBasis>()
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
      const zc = run.plan.z + RUN_DEPTH / 2 // struct back runs sit at their origin z
      basis = {
        id: 'back',
        rotY: 0,
        pos: (u, y) => new THREE.Vector3(ox + u, y, zc),
        uOf: (p) => p.x - ox,
        len: run.elev.len,
      }
    } else if (run.id === 'island') {
      const ox = run.face.origin.x
      const z0 = run.plan.z
      // bar islands face the cook (−z, toward the main run); guests sit on the +z side
      const bar = Boolean(run.reversed)
      basis = {
        id: 'island',
        rotY: bar ? Math.PI : 0,
        pos: (u, y) => new THREE.Vector3(ox + (bar ? run.elev.len - u : u), y, z0 + RUN_DEPTH / 2),
        uOf: (p) => (bar ? run.elev.len - (p.x - ox) : p.x - ox),
        len: run.elev.len,
      }
    } else if (run.id === 'left') {
      const cx = run.plan.x + RUN_DEPTH / 2
      const z0 = run.plan.z
      basis = {
        id: 'left',
        rotY: Math.PI / 2,
        pos: (u, y) => new THREE.Vector3(cx, y, z0 + u),
        uOf: (p) => p.z - z0,
        len: run.elev.len,
      }
    } else if (run.id === 'island-wing') {
      // the island's L leg — a vertical run in island space
      const cx = run.plan.x + RUN_DEPTH / 2
      const z0 = run.plan.z
      basis = {
        id: 'island-wing',
        rotY: -Math.PI / 2,
        pos: (u, y) => new THREE.Vector3(cx, y, z0 + u),
        uOf: (p) => p.z - z0,
        len: run.elev.len,
      }
    } else {
      const cx = run.plan.x + RUN_DEPTH / 2
      const z0 = run.plan.z
      basis = {
        id: 'right',
        rotY: -Math.PI / 2,
        pos: (u, y) => new THREE.Vector3(cx, y, z0 + u),
        uOf: (p) => p.z - z0,
        len: run.elev.len,
      }
    }
    basis.struct = run.struct
    bases.set(`${run.struct ?? ''}:${run.id}`, basis)
    // only the MAIN island rides the drag group; structure islands stay put
    const onIsland = (run.id === 'island' || run.id === 'island-wing') && !run.struct

    // ---- frames (per-frame group so appliance parts can animate in local space) ----
    for (const fl of run.elev.frames) {
      const frame = fl.frame
      const bodyH = frameBodyH(frame)
      const centerU = fl.body.x + frame.width / 2

      const fgroup = new THREE.Group()
      fgroup.position.copy(basis.pos(centerU, 0))
      fgroup.rotation.y = basis.rotY
      ;(onIsland ? islandGroup : group).add(fgroup)
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
      body.userData = { kind: 'frame', id: frame.id, run: run.id, struct: run.struct }
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
      // -seg.y is the counter TOP surface height; center the slab just below it
      // so it sits ON the cabinet (and flush with the corner counter)
      cbox.position.copy(basis.pos(seg.x + seg.w / 2, -seg.y - COUNTER_T / 2))
      cbox.rotation.y = basis.rotY
      cbox.castShadow = true
      cbox.receiveShadow = true
      cbox.userData = { kind: 'counter', run: run.id, struct: run.struct }
      ;(onIsland ? islandGroup : group).add(cbox)
      pickables.push(cbox)
    }

    // ---- dimension sprites ----
    if (showDims && run.elev.frames.length) {
      const tops = run.elev.appliances.filter((a) => a.placed.zone === 'top').map((a) => -a.rect.y)
      const topY = Math.max(96, ...tops) + 14
      const dimTarget = onIsland ? islandGroup : group
      for (const fl of run.elev.frames) {
        const sp = labelSprite(formatLenBare(fl.frame.width, unit), 0.8)
        sp.position.copy(basis.pos(fl.body.x + fl.body.w / 2, topY))
        dimTarget.add(sp)
      }
      if (run.elev.frames.length > 1) {
        const total = labelSprite(`${formatLenBare(run.elev.len, unit)}${unit === 'cm' ? ' cm' : ''} total`, 0.9)
        total.position.copy(basis.pos(run.elev.len / 2, topY + 16))
        dimTarget.add(total)
      }
    }
  }

  // ---- diagonal corner units (pentagon 90×90 with a 45° front) ----
  // one job per corner: the main kitchen's two sides plus each structure's
  const cornerJobs: Array<{
    side: 'left' | 'right'
    corner: NonNullable<ReturnType<typeof cornerFor>>
    backPlan: { x: number; z: number; w: number }
    pick: { kind: string; id: string }
  }> = []
  const mainBack = scene2d.runs.find((r) => r.id === 'back' && !r.struct)
  for (const side of ['left', 'right'] as const) {
    const corner = cornerFor(design, side)
    if (corner && mainBack) cornerJobs.push({ side, corner, backPlan: mainBack.plan, pick: { kind: 'corner', id: side } })
  }
  for (const st of design.structures ?? []) {
    const sback = scene2d.runs.find((r) => r.id === 'back' && r.struct === st.id)
    if (!sback) continue
    for (const side of ['left', 'right'] as const) {
      const corner = structCornerFor(st, design.frames.filter((f) => f.struct === st.id), side)
      if (corner) cornerJobs.push({ side, corner, backPlan: sback.plan, pick: { kind: 'struct', id: st.id } })
    }
  }
  for (const { side, corner, backPlan, pick } of cornerJobs) {
    const bodyH = corner.lowered ? 58 : 82
    const CN = 90
    const x = side === 'left' ? backPlan.x - CN : backPlan.x + backPlan.w
    const cz = backPlan.z
    // pentagon in plan (local dx, dz), diagonal facing the interior
    const pts =
      side === 'left'
        ? [ [0, 0], [CN, 0], [CN, RUN_DEPTH], [RUN_DEPTH, CN], [0, CN] ]
        : [ [0, 0], [CN, 0], [CN, CN], [CN - RUN_DEPTH, CN], [0, RUN_DEPTH] ]
    const mkPent = (h: number, yBase: number, mat: THREE.Material, grow = 0) => {
      const shape = new THREE.Shape()
      pts.forEach(([dx, dz], i) => {
        const px = dx + (dx > CN / 2 ? grow : -grow)
        const pz = dz + (dz > CN / 2 ? grow : -grow)
        i === 0 ? shape.moveTo(px, pz) : shape.lineTo(px, pz)
      })
      shape.closePath()
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
      ;(mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide
      const mesh = new THREE.Mesh(geo, mat)
      // shape plane is (x, z); extrusion along +z of shape → rotate so it extrudes up
      mesh.rotation.x = Math.PI / 2
      mesh.position.set(x, yBase + h, cz)
      mesh.scale.z = 1
      mesh.castShadow = true
      mesh.receiveShadow = true
      return mesh
    }
    // a counter-level oven on the corner (Gozney / pizza / taboon)
    const ovenTopY = bodyH + COUNTER_T
    const ovenCx = x + CN / 2
    const ovenCz = cz + CN / 2
    if (corner.top) {
      const taboon = corner.top.startsWith('taboon')
      const oven = new THREE.Group()
      const r = 24
      const domeMat = taboon
        ? new THREE.MeshStandardMaterial({ color: '#b06a3c', roughness: 0.9 })
        : new THREE.MeshStandardMaterial({ color: '#d8dce0', roughness: 0.4, metalness: 0.5 })
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 22, 14, 0, Math.PI * 2, 0, Math.PI / 2), domeMat)
      dome.scale.y = taboon ? 1.25 : 0.95
      dome.position.y = ovenTopY + 1
      dome.castShadow = true
      dome.userData = pick
      oven.add(dome)
      // glowing mouth / opening facing the interior (+? toward viewer)
      const mouth = new THREE.Mesh(
        new THREE.CircleGeometry(r * 0.42, 16, 0, Math.PI),
        new THREE.MeshStandardMaterial({ color: '#1a120c', emissive: '#ff7a1a', emissiveIntensity: 0.8, roughness: 0.9 }),
      )
      mouth.position.set(0, ovenTopY + r * 0.42, r * 0.86)
      mouth.rotation.x = 0
      oven.add(mouth)
      // chimney
      const chimney = new THREE.Mesh(new THREE.CylinderGeometry(3, 3.4, taboon ? 8 : 12, 12), domeMat)
      chimney.position.set(0, ovenTopY + r * (taboon ? 1.25 : 0.95) + 4, taboon ? 0 : -r * 0.3)
      oven.add(chimney)
      oven.position.set(ovenCx, 0, ovenCz)
      group.add(oven)
      pickables.push(oven)
    }

    if (corner.style === 'square') {
      // plain box corner (90×90)
      const cbody = new THREE.Mesh(new THREE.BoxGeometry(CN, bodyH, CN), finishMat(corner.finish))
      cbody.position.set(x + CN / 2, bodyH / 2, cz + CN / 2)
      cbody.castShadow = true
      cbody.receiveShadow = true
      cbody.userData = pick
      group.add(cbody)
      pickables.push(cbody)
      const ctop = new THREE.Mesh(
        new THREE.BoxGeometry(CN + COUNTER_OVERHANG, COUNTER_T, CN + COUNTER_OVERHANG),
        counterMat.clone(),
      )
      ctop.position.set(x + CN / 2, bodyH + COUNTER_T / 2, cz + CN / 2)
      ctop.userData = pick
      group.add(ctop)
      pickables.push(ctop)
    } else {
      const body = mkPent(bodyH, 0, finishMat(corner.finish))
      body.userData = pick
      group.add(body)
      pickables.push(body)
      const top = mkPent(COUNTER_T, bodyH, counterMat.clone(), COUNTER_OVERHANG)
      top.userData = pick
      group.add(top)
      pickables.push(top)
    }

    // under-counter storage in the corner base — a cabinet door on the
    // interior-facing (45°) face of the corner unit.
    if (corner.base) {
      const doorW = 42
      const doorH = bodyH - 16
      const cy = bodyH / 2
      // diagonal face midpoint (local) + outward normal for this side
      const [mlx, mlz, rotY, nx, nz] =
        side === 'left'
          ? [(CN + RUN_DEPTH) / 2, (RUN_DEPTH + CN) / 2, Math.PI / 4, 0.707, 0.707]
          : [(CN - RUN_DEPTH) / 2, (CN + RUN_DEPTH) / 2, -Math.PI / 4, -0.707, 0.707]
      const doorGroup = new THREE.Group()
      const panel = new THREE.Mesh(new THREE.BoxGeometry(doorW, doorH, 2), finishMat(corner.finish))
      doorGroup.add(panel)
      const inset = new THREE.Mesh(
        new THREE.BoxGeometry(doorW - 7, doorH - 7, 0.6),
        new THREE.MeshStandardMaterial({ color: '#23272c', roughness: 0.6, metalness: 0.4 }),
      )
      inset.position.z = 1
      doorGroup.add(inset)
      const handle = new THREE.Mesh(
        new THREE.BoxGeometry(doorW * 0.5, 1.8, 2),
        new THREE.MeshStandardMaterial({ color: '#d7dce0', roughness: 0.3, metalness: 0.85 }),
      )
      handle.position.set(0, doorH * 0.32, 1.6)
      doorGroup.add(handle)
      doorGroup.position.set(x + mlx + nx * 1.5, cy, cz + mlz + nz * 1.5)
      doorGroup.rotation.y = rotY
      doorGroup.traverse((o) => (o.userData = pick))
      group.add(doorGroup)
      pickables.push(doorGroup)
    }
  }

  // ---- pergola (posts + beams + slatted roof over the kitchen) ----
  if (design.pergola) {
    const ex = scene2d.extents
    const m = 40 // overhang past the kitchen
    const x0 = ex.x0 - m
    const x1 = ex.x1 + m
    const z0 = ex.z0 - m
    const z1 = ex.z1 + m
    const H = 235
    const wood = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.85 })
    const woodDark = new THREE.MeshStandardMaterial({ color: '#553a22', roughness: 0.85 })
    const post = (px: number, pz: number) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(10, H, 10), wood)
      p.position.set(px, H / 2, pz)
      p.castShadow = true
      group.add(p)
    }
    post(x0, z0)
    post(x1, z0)
    post(x0, z1)
    post(x1, z1)
    // perimeter beams along x (front/back)
    for (const pz of [z0, z1]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 + 12, 12, 8), woodDark)
      beam.position.set((x0 + x1) / 2, H + 6, pz)
      beam.castShadow = true
      group.add(beam)
    }
    // rafters/slats spanning z, spaced along x
    const slatGap = 26
    for (let x = x0 + slatGap; x < x1; x += slatGap) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(5, 8, z1 - z0 + 12), wood)
      slat.position.set(x, H + 16, (z0 + z1) / 2)
      slat.castShadow = true
      group.add(slat)
    }
  }

  // ---- island bar: guest-side overhang + stools ----
  if (design.island && design.islandBar) {
    const island = scene2d.runs.find((r) => r.id === 'island')
    if (island && island.frames.length) {
      const p = island.plan
      const counterTopY = 88 + COUNTER_T // approx; matches standard frame counters
      const overhang = 34
      // guest side is +z (front, toward viewer); extend the counter there
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(p.w + COUNTER_OVERHANG * 2, COUNTER_T, overhang),
        counterMat.clone(),
      )
      const guestZ = p.z + p.d + COUNTER_OVERHANG + overhang / 2
      bar.position.set(p.x + p.w / 2, counterTopY - COUNTER_T / 2, guestZ)
      bar.castShadow = true
      bar.userData = { kind: 'counter', run: 'island' }
      group.add(bar)
      pickables.push(bar)
      // stools along the guest edge
      const stoolMat = new THREE.MeshStandardMaterial({ color: '#3a3f45', roughness: 0.6, metalness: 0.4 })
      const seatMat = new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.8 })
      const n = Math.max(2, Math.round(p.w / 60))
      const stoolZ = guestZ + overhang / 2 + 22
      for (let i = 0; i < n; i++) {
        const sx = p.x + ((i + 0.5) * p.w) / n
        const seatY = 62
        const seat = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 4, 16), seatMat)
        seat.position.set(sx, seatY, stoolZ)
        seat.castShadow = true
        group.add(seat)
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(2, 3, seatY, 10), stoolMat)
        leg.position.set(sx, seatY / 2, stoolZ)
        group.add(leg)
        const ring = new THREE.Mesh(new THREE.TorusGeometry(11, 1, 8, 18), stoolMat)
        ring.rotation.x = Math.PI / 2
        ring.position.set(sx, 20, stoolZ)
        group.add(ring)
      }
    }
  }

  // ---- island L corner (pentagon/box, in island space) ----
  if (scene2d.islandCorner) {
    const ic = scene2d.islandCorner
    const CN = 90
    const bodyH = 82
    const localPts: Array<[number, number]> =
      ic.style === 'square'
        ? [[0, 0], [CN, 0], [CN, CN], [0, CN]]
        : [[0, 0], [CN, 0], [CN, CN], [CN - RUN_DEPTH, CN], [0, RUN_DEPTH]]
    const mkPent = (h: number, yBase: number, mat: THREE.Material, grow = 0) => {
      const shape = new THREE.Shape()
      localPts.forEach(([dx, dz], i) => {
        const px = dx + (dx > CN / 2 ? grow : -grow)
        const pz = dz + (dz > CN / 2 ? grow : -grow)
        i === 0 ? shape.moveTo(px, pz) : shape.lineTo(px, pz)
      })
      shape.closePath()
      const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
      ;(mat as THREE.MeshStandardMaterial).side = THREE.DoubleSide
      const mesh = new THREE.Mesh(geo, mat)
      mesh.rotation.x = Math.PI / 2
      mesh.position.set(ic.x0, yBase + h, ic.z0)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData = { kind: 'counter', run: 'island' }
      return mesh
    }
    const finish = design.frames.find((f) => (f.run ?? '') === 'island')?.finish ?? design.frames[0]?.finish ?? 'graphite'
    const cbody = mkPent(bodyH, 0, finishMat(finish))
    islandGroup.add(cbody)
    pickables.push(cbody)
    const ctop = mkPent(COUNTER_T, bodyH, counterMat.clone(), COUNTER_OVERHANG)
    islandGroup.add(ctop)
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

  return { group, pickables, bases, scene2d, anim, islandGroup, center, radius }
}
