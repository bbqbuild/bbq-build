import type { Design, SavedDesign } from '../types'
import { currentAccessToken, supabase } from './supabase'

/** Cached email of the signed-in user (for display). */
let cachedEmail: string | null = null

export function getEmail(): string | null {
  return cachedEmail
}

export function setCachedEmail(email: string | null) {
  cachedEmail = email
}

export async function clearSession() {
  await supabase.auth.signOut().catch(() => {})
  cachedEmail = null
}

class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...(options.headers as Record<string, string>) }
  const token = await currentAccessToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { ...options, headers })
  if (res.status === 401) {
    window.dispatchEvent(new Event('bbq:logout'))
    throw new ApiError(401, 'Session expired')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export interface AuthResult {
  needsConfirmation: boolean
}

/** Sign in with email + password via Supabase. */
export async function login(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
  if (error) throw new ApiError(400, error.message)
  cachedEmail = email.trim()
}

/** Create a new account. Returns whether email confirmation is required. */
export async function signup(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password })
  if (error) throw new ApiError(400, error.message)
  cachedEmail = email.trim()
  return { needsConfirmation: !data.session }
}

export async function listDesigns(): Promise<SavedDesign[]> {
  return request<SavedDesign[]>('/api/designs')
}

export async function createDesign(design: Design): Promise<SavedDesign> {
  return request<SavedDesign>('/api/designs', { method: 'POST', body: JSON.stringify({ name: design.name, data: design }) })
}

export async function updateDesign(id: number, design: Design): Promise<SavedDesign> {
  return request<SavedDesign>(`/api/designs/${id}`, { method: 'PUT', body: JSON.stringify({ name: design.name, data: design }) })
}

export async function deleteDesign(id: number): Promise<void> {
  await request<{ ok: true }>(`/api/designs/${id}`, { method: 'DELETE' })
}

// ---- AI ----

import type { AiProduct } from '../catalog/aiProducts'

export interface ChatOperation {
  op: string
  [key: string]: unknown
}

export interface ChatResponse {
  reply: string
  operations: ChatOperation[]
}

export interface ValidationReport {
  feasible: boolean
  score: number
  summary: string
  issues: { severity: 'error' | 'warning' | 'info'; message: string }[]
  suggestions: string[]
}

export async function aiSearchAppliances(query: string): Promise<{ items: AiProduct[]; cached: boolean }> {
  return request('/api/ai/appliances', { method: 'POST', body: JSON.stringify({ query }) })
}

export async function aiValidate(design: Design, catalogSummary: string): Promise<ValidationReport> {
  return request('/api/ai/validate', { method: 'POST', body: JSON.stringify({ design, catalogSummary }) })
}

export async function aiChat(
  messages: { role: 'user' | 'assistant'; content: string }[],
  design: Design,
  catalogSummary: string,
): Promise<ChatResponse> {
  return request('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages, design, catalogSummary }) })
}
