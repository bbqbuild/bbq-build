import type { Design, SavedDesign } from '../types'

const TOKEN_KEY = 'bbq_token'
const EMAIL_KEY = 'bbq_email'

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function getEmail(): string | null {
  return localStorage.getItem(EMAIL_KEY)
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(EMAIL_KEY)
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
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(path, { ...options, headers })
  if (res.status === 401) {
    clearSession()
    window.dispatchEvent(new Event('bbq:logout'))
    throw new ApiError(401, 'Session expired')
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }))
    throw new ApiError(res.status, body.error ?? res.statusText)
  }
  return res.json() as Promise<T>
}

export async function login(email: string, password: string): Promise<void> {
  const { token } = await request<{ token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  localStorage.setItem(TOKEN_KEY, token)
  localStorage.setItem(EMAIL_KEY, email)
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
