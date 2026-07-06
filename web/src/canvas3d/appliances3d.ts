// Real 3D appliance geometry with animatable parts, built in frame-local space:
//   x = along run (centered), y = up (0 = ground), z = depth (+z = front / viewer).
// A frame group is placed + rotated by the run basis; children live in this space.

import * as THREE from 'three'
import type { ApplianceType, PlacedAppliance } from '../types'
import { COUNTER_T, RUN_DEPTH, frameBodyH } from '../types'
import { TOP_HEIGHTS } from '../canvas/layout'
import { applianceWidth } from '../catalog/appliances'

export interface AnimPart {
  /** object whose transform is driven by the open factor */
  obj: THREE.Object3D
  kind: 'hingeY' | 'slideZ' | 'liftX' | 'liftY'
  /** target at fully-open: radians for hinge/lift, cm for slide */
  amount: number
  base: number
}

const FRONT = (RUN_DEPTH - 2) / 2 // z of the body front face
const PANEL_Z = FRONT + 1 // panels sit just proud of the body to avoid z-fighting

const steel = (rough = 0.35) => new THREE.MeshStandardMaterial({ color: '#aab1b8', roughness: rough, metalness: 0.72 })
const dark = () => new THREE.MeshStandardMaterial({ color: '#23272c', roughness: 0.6, metalness: 0.4 })
const handleMat = new THREE.MeshStandardMaterial({ color: '#d7dce0', roughness: 0.3, metalness: 0.85 })
const black = new THREE.MeshStandardMaterial({ color: '#17191c', roughness: 0.7 })

function handleBar(len: number, vertical: boolean): THREE.Mesh {
  const g = vertical ? new THREE.BoxGeometry(1.6, len, 1.8) : new THREE.BoxGeometry(len, 1.6, 1.8)
  return new THREE.Mesh(g, handleMat)
}

/** A hinged panel: returns a pivot group (rotate its y) + the swing amount. */
function hingedDoor(w: number, h: number, hingeRight: boolean, z: number): { pivot: THREE.Group; amount: number } {
  const pivot = new THREE.Group()
  const panel = new THREE.Mesh(new THREE.BoxGeometry(w, h, 1.6), steel(0.4))
  // pivot at the hinge edge; panel offset so its far edge is the free side
  panel.position.x = hingeRight ? -w / 2 : w / 2
  panel.castShadow = true
  pivot.add(panel)
  // inset detail
  const inset = new THREE.Mesh(new THREE.BoxGeometry(w - 6, h - 6, 0.4), dark())
  inset.position.set(panel.position.x, 0, 1)
  pivot.add(inset)
  // vertical handle near the free edge
  const handle = handleBar(h * 0.5, true)
  handle.position.set(hingeRight ? -w + 4 : w - 4, 0, 1.8)
  pivot.add(handle)
  pivot.position.set(hingeRight ? w / 2 : -w / 2, 0, z)
  // opens outward (+z) — rotate so free edge swings toward viewer
  const amount = hingeRight ? Math.PI * 0.62 : -Math.PI * 0.62
  return { pivot, amount }
}

export interface Applied {
  meshes: THREE.Object3D[]
  parts: AnimPart[]
}

/** Build the base-zone (under-counter) appliance for a frame cavity. */
export function baseAppliance3d(placed: PlacedAppliance, type: ApplianceType, frameW: number, bodyH: number): Applied {
  const meshes: THREE.Object3D[] = []
  const parts: AnimPart[] = []
  // real appliances keep their cutout width and centre in the frame; cabinetry fills it
  const openW = applianceWidth(type, frameW) - 6
  const openH = bodyH - 12
  const cy = openH / 2 + 6 // cavity vertical center from ground
  const base = type.paintAs ?? type.id
  const tag = (o: THREE.Object3D) => {
    o.traverse((c) => (c.userData = { kind: 'appliance', id: placed.id, run: '' }))
    return o
  }

  if (base.startsWith('drawers')) {
    const n = 3
    const gap = 1.2
    const dh = (openH - gap * (n - 1)) / n
    for (let i = 0; i < n; i++) {
      const y = 6 + i * (dh + gap) + dh / 2
      const front = new THREE.Group()
      const panel = new THREE.Mesh(new THREE.BoxGeometry(openW, dh, 2), steel(0.4))
      panel.castShadow = true
      front.add(panel)
      const handle = handleBar(openW * 0.5, false)
      handle.position.set(0, dh * 0.28, 1.4)
      front.add(handle)
      front.position.set(0, y, PANEL_Z)
      tag(front)
      meshes.push(front)
      parts.push({ obj: front, kind: 'slideZ', amount: 26, base: PANEL_Z })
    }
    return { meshes, parts }
  }

  if (base.startsWith('trash')) {
    const front = new THREE.Group()
    const panel = new THREE.Mesh(new THREE.BoxGeometry(openW, openH, 2), steel(0.4))
    panel.castShadow = true
    front.add(panel)
    const handle = handleBar(openW * 0.5, false)
    handle.position.set(0, openH * 0.36, 1.4)
    front.add(handle)
    front.position.set(0, cy, PANEL_Z)
    tag(front)
    meshes.push(front)
    parts.push({ obj: front, kind: 'slideZ', amount: 30, base: PANEL_Z })
    return { meshes, parts }
  }

  if (base.startsWith('woodstore')) {
    // firewood stacked with the round cut ends facing the viewer, in a grid
    // filling the opening. The cabinet body is a solid box, so (like the door
    // panels) the logs seat their front ends PROUD of the face and run back
    // into the cavity — otherwise they'd be buried inside the solid body.
    const shelf = new THREE.Group()
    const rad = 3.6
    const pitch = 7.6
    const logLen = 22
    const frontEnd = FRONT + 2.5 // round ends sit proud of the cabinet face
    const cz = frontEnd - logLen / 2
    const cols = Math.max(1, Math.floor(openW / pitch))
    const vGap = pitch * 0.9
    const rows = Math.max(1, Math.floor((openH - rad) / vGap))
    for (let ry = 0; ry < rows; ry++) {
      const stagger = (ry % 2) * (pitch / 2)
      const rowCols = stagger ? cols - 1 : cols
      const rx0 = -((rowCols - 1) * pitch) / 2
      for (let cx = 0; cx < rowCols; cx++) {
        const log = new THREE.Mesh(
          new THREE.CylinderGeometry(rad, rad, logLen, 12),
          new THREE.MeshStandardMaterial({
            color: (cx + ry) % 2 ? '#b1855a' : '#946840',
            roughness: 0.9,
          }),
        )
        log.rotation.x = Math.PI / 2 // lie along depth: round ends face front
        log.position.set(rx0 + cx * pitch, 9 + rad + ry * vGap, cz)
        log.castShadow = true
        // a slightly darker growth-ring face so the cut end reads as wood
        const ring = new THREE.Mesh(
          new THREE.CircleGeometry(rad * 0.96, 12),
          new THREE.MeshStandardMaterial({ color: '#7a5330', roughness: 0.95 }),
        )
        ring.position.set(log.position.x, log.position.y, frontEnd + 0.1)
        shelf.add(log)
        shelf.add(ring)
      }
    }
    tag(shelf)
    meshes.push(shelf)
    return { meshes, parts }
  }

  const isIceMaker = base.startsWith('icemaker')
  const isFridgey = /^(fridge|kegerator)/.test(base)
  const isFridge = isFridgey || isIceMaker
  if (base.startsWith('doors') || base.startsWith('door') || isFridge) {
    const twin = base.startsWith('doors') // double doors
    if (twin) {
      const half = openW / 2 - 0.5
      const left = hingedDoor(half, openH, false, PANEL_Z)
      left.pivot.position.x = -openW / 2 + half / 2 - half / 2 // recompute below
      // place left door: hinge at left edge
      left.pivot.position.set(-openW / 2, cy, PANEL_Z)
      const right = hingedDoor(half, openH, true, PANEL_Z)
      right.pivot.position.set(openW / 2, cy, PANEL_Z)
      for (const d of [left, right]) {
        tag(d.pivot)
        meshes.push(d.pivot)
        parts.push({ obj: d.pivot, kind: 'hingeY', amount: d.amount, base: 0 })
      }
    } else {
      const hingeRight = Boolean(placed.flipped)
      const door = hingedDoor(openW, openH, hingeRight, PANEL_Z)
      door.pivot.position.set(hingeRight ? openW / 2 : -openW / 2, cy, PANEL_Z)
      const panel = door.pivot.children[0]
      if (isIceMaker) {
        // front-vented ice maker: louvered intake grille along the bottom + a
        // small blue control display near the top — distinct from a fridge door
        const ventMat = new THREE.MeshStandardMaterial({ color: '#6b7178', roughness: 0.5, metalness: 0.7 })
        for (let i = 0; i < 4; i++) {
          const slat = new THREE.Mesh(new THREE.BoxGeometry(openW * 0.72, 1.6, 1), ventMat)
          slat.position.set(0, -openH / 2 + 6 + i * 3, 1.2)
          panel.add(slat)
        }
        const display = new THREE.Mesh(
          new THREE.BoxGeometry(openW * 0.42, 4, 0.6),
          new THREE.MeshStandardMaterial({ color: '#0c1c26', emissive: '#2a8fd6', emissiveIntensity: 0.6, roughness: 0.4 }),
        )
        display.position.set(0, openH / 2 - 7, 1)
        panel.add(display)
      } else if (isFridgey) {
        // brand badge on the door
        const badge = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 0.4), black)
        badge.position.set(hingeRight ? -openW * 0.36 : openW * 0.36, openH * 0.28, 1)
        panel.add(badge)
      }
      tag(door.pivot)
      meshes.push(door.pivot)
      parts.push({ obj: door.pivot, kind: 'hingeY', amount: door.amount, base: 0 })
    }
    return { meshes, parts }
  }

  // fallback: a flat panel
  const panel = new THREE.Mesh(new THREE.BoxGeometry(openW, openH, 2), steel(0.5))
  panel.position.set(0, cy, PANEL_Z)
  tag(panel)
  meshes.push(panel)
  return { meshes, parts }
}

/** Build a top-zone (counter-level) appliance. counterTop = height of counter surface. */
export function topAppliance3d(placed: PlacedAppliance, type: ApplianceType, frameW: number, counterTop: number): Applied {
  const meshes: THREE.Object3D[] = []
  const parts: AnimPart[] = []
  const base = type.paintAs ?? type.id
  // keep the appliance at its true cutout width; a wider frame is extra counter
  const w = applianceWidth(type, frameW) - (type.mount === 'oncounter' ? 12 : 4)
  const h = TOP_HEIGHTS[type.id] ?? (type.paintAs ? TOP_HEIGHTS[type.paintAs] : undefined) ?? 20
  const depth = RUN_DEPTH - 14
  const tag = (o: THREE.Object3D) => {
    o.traverse((c) => (c.userData = { kind: 'appliance', id: placed.id, run: '' }))
    return o
  }

  // ---- sink: recessed basin + faucet (no raised box) ----
  if (base.startsWith('sink')) {
    const g = new THREE.Group()
    const bw = w * 0.62
    const bd = depth * 0.62
    const bh = 16
    // basin walls (open box sunk below counter)
    const wall = steel(0.4)
    const mkWall = (sx: number, sy: number, sz: number, px: number, py: number, pz: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(sx, sy, sz), wall)
      m.position.set(px, py, pz)
      g.add(m)
    }
    const topY = counterTop - 0.5
    mkWall(bw, bh, 1, 0, topY - bh / 2, -bd / 2) // back
    mkWall(bw, bh, 1, 0, topY - bh / 2, bd / 2) // front
    mkWall(1, bh, bd, -bw / 2, topY - bh / 2, 0)
    mkWall(1, bh, bd, bw / 2, topY - bh / 2, 0)
    const bottom = new THREE.Mesh(new THREE.BoxGeometry(bw, 1, bd), new THREE.MeshStandardMaterial({ color: '#8a9097', roughness: 0.3, metalness: 0.8 }))
    bottom.position.set(0, topY - bh, 0)
    g.add(bottom)
    // rim
    const rim = new THREE.Mesh(new THREE.BoxGeometry(bw + 4, 1.2, bd + 4), steel(0.3))
    rim.position.set(0, topY, 0)
    g.add(rim)
    // gooseneck faucet at the back
    const faucet = new THREE.Group()
    const post = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.6, 20, 12), handleMat)
    post.position.set(0, 10, 0)
    faucet.add(post)
    const arc = new THREE.Mesh(new THREE.TorusGeometry(6, 1.3, 10, 20, Math.PI), handleMat)
    arc.position.set(0, 20, 0)
    arc.rotation.z = Math.PI
    arc.rotation.y = Math.PI / 2
    faucet.add(arc)
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 5, 10), handleMat)
    spout.position.set(0, 17, 6)
    faucet.add(spout)
    // lever
    const lever = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 6), handleMat)
    lever.position.set(3, 6, 0)
    faucet.add(lever)
    faucet.position.set(0, counterTop, -bd / 2 - 1)
    g.add(faucet)
    tag(g)
    meshes.push(g)
    return { meshes, parts }
  }

  // ---- ice bin: recessed with ice ----
  if (base.startsWith('icebin')) {
    const g = new THREE.Group()
    const bin = new THREE.Mesh(new THREE.BoxGeometry(w * 0.7, 12, depth * 0.6), steel(0.4))
    bin.position.set(0, counterTop - 6, 0)
    g.add(bin)
    const ice = new THREE.Mesh(new THREE.BoxGeometry(w * 0.64, 4, depth * 0.54), new THREE.MeshStandardMaterial({ color: '#cfe6f5', roughness: 0.5 }))
    ice.position.set(0, counterTop, 0)
    g.add(ice)
    tag(g)
    meshes.push(g)
    return { meshes, parts }
  }

  // ---- griddle: low flat plate ----
  if (base.startsWith('griddle')) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, 8, depth), steel(0.4))
    body.position.set(0, counterTop + 4, 0)
    g.add(body)
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w - 6, 1.5, depth - 6), new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.25, metalness: 0.6 }))
    plate.position.set(0, counterTop + 8.5, 0)
    g.add(plate)
    tag(g)
    meshes.push(g)
    return { meshes, parts }
  }

  // ---- kamado: dome with a lifting lid ----
  if (type.mount === 'kamado') {
    const g = new THREE.Group()
    const isEgg = base.startsWith('egg')
    const r = Math.min(w * 0.36, 30)
    const mat = new THREE.MeshStandardMaterial({ color: isEgg ? '#2f6a3c' : '#26292d', roughness: 0.35 })
    // bottom half (static)
    const bottom = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), mat)
    bottom.scale.set(1, 1.18, 1)
    bottom.position.set(0, counterTop + r * 0.95, 0)
    g.add(bottom)
    // lid (top half) — hinge at back
    const lidPivot = new THREE.Group()
    const lid = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat)
    lid.scale.set(1, 1.18, 1)
    lidPivot.add(lid)
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 5, 12), steel(0.4))
    cap.position.y = r * 1.18
    lidPivot.add(cap)
    lidPivot.position.set(0, counterTop + r * 0.95, -r * 0.6)
    g.add(lidPivot)
    tag(g)
    meshes.push(g)
    parts.push({ obj: lidPivot, kind: 'liftX', amount: -Math.PI * 0.42, base: 0 })
    return { meshes, parts }
  }

  // ---- pizza oven: dome with mouth + chimney ----
  if (base.startsWith('pizza')) {
    const g = new THREE.Group()
    const body = new THREE.Mesh(new THREE.BoxGeometry(w, h - 6, depth), steel(0.4))
    body.position.set(0, counterTop + (h - 6) / 2 + 6, 0)
    g.add(body)
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(w * 0.5, (h - 6) * 0.4, 2), new THREE.MeshStandardMaterial({ color: '#1a120c', emissive: '#c2410c', emissiveIntensity: 0.6, roughness: 0.9 }))
    mouth.position.set(0, counterTop + (h - 6) * 0.4, depth / 2)
    g.add(mouth)
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 10, 12), steel(0.5))
    chimney.position.set(w * 0.2, counterTop + h + 2, -depth * 0.2)
    g.add(chimney)
    tag(g)
    meshes.push(g)
    return { meshes, parts }
  }

  // ---- santa maria: open Argentine grill (posts, crank wheel, raised grate, coals) ----
  if (base.startsWith('santamaria')) {
    const g = new THREE.Group()
    const fireH = 14
    // firebox with glowing coals
    const box = new THREE.Mesh(new THREE.BoxGeometry(w, fireH, depth), steel(0.4))
    box.position.set(0, counterTop + fireH / 2, 0)
    g.add(box)
    const coals = new THREE.Mesh(
      new THREE.BoxGeometry(w - 8, 3, depth - 8),
      new THREE.MeshStandardMaterial({ color: '#c2410c', emissive: '#ff7a1a', emissiveIntensity: 0.85, roughness: 0.9 }),
    )
    coals.position.set(0, counterTop + fireH - 1.5, 0)
    g.add(coals)
    // two side posts
    const postMat = new THREE.MeshStandardMaterial({ color: '#3d434a', roughness: 0.6, metalness: 0.5 })
    const postH = h - fireH
    for (const sx of [-w / 2 + 3, w / 2 - 3]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(3, postH, 3), postMat)
      post.position.set(sx, counterTop + fireH + postH / 2, -depth / 2 + 3)
      post.castShadow = true
      g.add(post)
    }
    // crossbar
    const cross = new THREE.Mesh(new THREE.BoxGeometry(w, 3, 3), postMat)
    cross.position.set(0, counterTop + h - 1.5, -depth / 2 + 3)
    g.add(cross)
    // crank wheel on the right post
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(5, 1, 8, 20), steel(0.35))
    wheel.position.set(w / 2 - 3, counterTop + fireH + postH * 0.5, -depth / 2 + 6)
    g.add(wheel)
    // raised grate on chains (liftable)
    const gratePivot = new THREE.Group()
    const grate = new THREE.Mesh(new THREE.BoxGeometry(w - 8, 1.5, depth - 6), new THREE.MeshStandardMaterial({ color: '#2a2d31', roughness: 0.4, metalness: 0.6 }))
    grate.castShadow = true
    gratePivot.add(grate)
    for (const sx of [-w / 2 + 6, w / 2 - 6]) {
      const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, postH * 0.5, 6), postMat)
      chain.position.set(sx, postH * 0.25, -depth / 2 + 4)
      gratePivot.add(chain)
    }
    const grateY = counterTop + fireH + postH * 0.4
    gratePivot.position.set(0, grateY, 0)
    g.add(gratePivot)
    tag(g)
    meshes.push(g)
    // "open" raises the grate up the posts
    parts.push({ obj: gratePivot, kind: 'liftY', amount: postH * 0.45, base: grateY })
    return { meshes, parts }
  }

  // ---- grill: body with a lifting hood ----
  const g = new THREE.Group()
  const bandH = 10
  const band = new THREE.Mesh(new THREE.BoxGeometry(w, bandH, depth), steel(0.4))
  band.position.set(0, counterTop + bandH / 2, 0)
  g.add(band)
  // control knobs on the counter fascia (front of the frame — drawn on band)
  const hoodH = h - bandH
  const hoodPivot = new THREE.Group()
  const hood = new THREE.Mesh(new THREE.BoxGeometry(w, hoodH, depth), steel(0.35))
  hood.position.set(0, hoodH / 2, 0)
  hood.castShadow = true
  hoodPivot.add(hood)
  const bar = handleBar(w * 0.6, false)
  bar.position.set(0, hoodH * 0.5, depth / 2 + 1)
  hoodPivot.add(bar)
  // hinge at back-top edge of the band
  hoodPivot.position.set(0, counterTop + bandH, -depth / 2)
  // shift hood so it rests forward of the hinge
  hood.position.z = depth / 2
  bar.position.z = depth + 1
  g.add(hoodPivot)
  // interior grates revealed when open
  const grate = new THREE.Mesh(new THREE.BoxGeometry(w - 8, 1, depth - 8), black)
  grate.position.set(0, counterTop + bandH + 1, 0)
  g.add(grate)
  tag(g)
  meshes.push(g)
  parts.push({ obj: hoodPivot, kind: 'liftX', amount: -Math.PI * 0.4, base: 0 })
  return { meshes, parts }
}

export { FRONT, frameBodyH, COUNTER_T }
