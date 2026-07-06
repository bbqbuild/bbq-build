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
