import type { ApplianceType, Design, SavedDesign } from '../types'
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

/** Start an OAuth sign-in (redirects away, returns to the app on success). */
export async function oauth(provider: 'google' | 'apple'): Promise<void> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: window.location.origin },
  })
  if (error) throw new ApiError(400, error.message)
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

export async function aiScanUrl(url: string): Promise<{ item: AiProduct }> {
  return request('/api/ai/scan-url', { method: 'POST', body: JSON.stringify({ url }) })
}

/** The shared catalog of appliances other users have imported (public). */
export async function getSharedCatalog(): Promise<ApplianceType[]> {
  try {
    const { items } = await request<{ items: ApplianceType[] }>('/api/catalog/shared')
    return items ?? []
  } catch {
    return []
  }
}

/** Contribute an imported appliance to the shared catalog (best-effort). */
export async function importAppliance(type: ApplianceType): Promise<{ status: 'approved' | 'pending' } | null> {
  try {
    return await request('/api/catalog/import', { method: 'POST', body: JSON.stringify(type) })
  } catch {
    return null // non-fatal — the item is still added locally
  }
}

// ---- admin ----

export interface Me {
  email: string
  isAdmin: boolean
}
export async function getMe(): Promise<Me | null> {
  try {
    return await request<Me>('/api/me')
  } catch {
    return null
  }
}

export type AdminAppliance = ApplianceType & { key: string; status: 'approved' | 'pending'; addedBy?: string; createdAt?: string }
export interface Company {
  id: number
  name: string
  region?: string | null
  url?: string | null
  phone?: string | null
  email?: string | null
  notes?: string | null
}

export async function adminListAppliances(): Promise<AdminAppliance[]> {
  const { items } = await request<{ items: AdminAppliance[] }>('/api/admin/appliances')
  return items
}
export async function adminApprove(key: string): Promise<void> {
  await request(`/api/admin/appliances/${encodeURIComponent(key)}/approve`, { method: 'POST' })
}
export async function adminReject(key: string): Promise<void> {
  await request(`/api/admin/appliances/${encodeURIComponent(key)}/reject`, { method: 'POST' })
}
export async function adminScan(url: string): Promise<{ item: AiProduct }> {
  return request('/api/admin/scan', { method: 'POST', body: JSON.stringify({ url }) })
}
export async function adminListCompanies(): Promise<Company[]> {
  const { items } = await request<{ items: Company[] }>('/api/admin/companies')
  return items
}
export async function adminAddCompany(c: Omit<Company, 'id'>): Promise<Company> {
  const { item } = await request<{ item: Company }>('/api/admin/companies', { method: 'POST', body: JSON.stringify(c) })
  return item
}
export async function adminRemoveCompany(id: number): Promise<void> {
  await request(`/api/admin/companies/${id}`, { method: 'DELETE' })
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
