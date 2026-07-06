// Oblique (cabinet) projection for the plan.
// Plan coords: x → right, z → toward the viewer, y → up (drawn as -y on screen).
// Front-facing faces (normal +z) render 1:1 — the elevation art stays crisp.
// Depth (z) recedes down-right at DEPTH_SCALE.

export const DEPTH_ANGLE = (32 * Math.PI) / 180
export const DEPTH_SCALE = 0.52
export const KX = Math.cos(DEPTH_ANGLE) * DEPTH_SCALE // screen-x per plan-z cm
export const KZ = Math.sin(DEPTH_ANGLE) * DEPTH_SCALE // screen-y per plan-z cm

export interface PlanPoint {
  x: number
  z: number
}

/**
 * Project a plan point at height y (cm above ground) to world-screen cm.
 * `mirror` flips the depth drift (used for the left wing so it recedes
 * outward instead of into the kitchen).
 */
export function project(x: number, z: number, y = 0, mirror = false): { x: number; y: number } {
  return { x: x + z * (mirror ? -KX : KX), y: z * KZ - y }
}

/**
 * A vertical face along a horizontal direction: p(u, v) = origin + u·dir, at height v.
 * Returns the canvas transform [a,b,c,d,e,f] mapping face-local (u, yDown) to
 * world-screen, where yDown = 0 at the face's top and grows downward to `height`.
 */
export interface FaceBasis {
  /** plan origin of the face's left edge */
  origin: PlanPoint
  /** unit plan direction of the face's u axis */
  dir: PlanPoint
  /** face length in cm */
  len: number
  /** face height in cm (top of counter/appliances zone down to ground) */
  top: number
}

export function faceTransform(
  f: FaceBasis,
  mirror = false,
): { a: number; b: number; c: number; d: number; e: number; f: number } {
  const kx = mirror ? -KX : KX
  const o = project(f.origin.x, f.origin.z, f.top, mirror)
  const uStep = { x: f.dir.x + f.dir.z * kx, y: f.dir.z * KZ }
  return { a: uStep.x, b: uStep.y, c: 0, d: 1, e: o.x, f: o.y }
}

/** Invert a face transform: world-screen point → face-local (u, yDown), or null if degenerate. */
export function faceInverse(f: FaceBasis, sx: number, sy: number, mirror = false): { u: number; v: number } | null {
  const t = faceTransform(f, mirror)
  // [sx] = [a 0][u] + [e]   →  u = (sx - e)/a ; v = sy - f - u·b
  if (Math.abs(t.a) < 1e-6) return null
  const u = (sx - t.e) / t.a
  const v = sy - t.f - u * t.b
  return { u, v }
}
