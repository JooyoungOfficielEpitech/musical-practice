/**
 * E2E API Client — Backend-agnostic test helper.
 * Simulates "other users" during hybrid E2E tests (1 Maestro device + API).
 *
 * Usage: import and call from api-setup.ts / api-assert.ts scripts.
 * The harness-init skill will fill in the backend details for each project.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TestUser {
  id: string
  email: string
  role: string
  token: string
}

export interface ApiClientConfig {
  backend: 'supabase' | 'firebase' | 'custom'
  url: string
  serviceKey?: string   // Supabase service role key (bypasses RLS)
  customHeaders?: Record<string, string>
}

// ── Config (filled by harness-init per project) ───────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name]
  if (!val) throw new Error(`Missing required E2E env var: ${name}. Set it in .env.test`)
  if (process.env.NODE_ENV === 'production') {
    throw new Error(`E2E api-client must never run in production. NODE_ENV=${process.env.NODE_ENV}`)
  }
  return val
}

const CONFIG: ApiClientConfig = {
  backend: 'supabase',
  url: process.env.SUPABASE_URL ?? '',
  serviceKey: process.env.SUPABASE_SERVICE_KEY,
}

// ── Supabase Client ───────────────────────────────────────────────────────────

import type { SupabaseClient } from '@supabase/supabase-js'
let _client: SupabaseClient | null = null

async function getClient(): Promise<SupabaseClient> {
  if (_client) return _client
  if (CONFIG.backend !== 'supabase') {
    throw new Error(`Unsupported backend: ${CONFIG.backend}. Only 'supabase' is implemented.`)
  }
  const url = requireEnv('SUPABASE_URL')
  const key = requireEnv('SUPABASE_SERVICE_KEY')
  const { createClient } = await import('@supabase/supabase-js')
  _client = createClient(url, key, { auth: { persistSession: false } })
  return _client
}

// ── User management ───────────────────────────────────────────────────────────

/**
 * Create a test user and return their credentials.
 * Uses service key to bypass email confirmation.
 */
export async function createTestUser(email: string, password: string, metadata?: Record<string, unknown>): Promise<TestUser> {
  const client = await getClient()
  const { data, error } = await client.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: metadata ?? {},
  })
  if (error) throw new Error(`createTestUser failed: ${error.message}`)
  return { id: data.user.id, email, role: metadata?.role as string ?? 'user', token: '' }
}

/**
 * Login as a test user and return their session token.
 */
export async function loginAs(email: string, password: string): Promise<TestUser> {
  const client = await getClient()
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`loginAs failed: ${error.message}`)
  return {
    id: data.user.id,
    email,
    role: data.user.user_metadata?.role ?? 'user',
    token: data.session.access_token,
  }
}

/**
 * Delete all test users matching the email pattern.
 */
export async function deleteTestUser(userId: string): Promise<void> {
  const client = await getClient()
  const { error } = await client.auth.admin.deleteUser(userId)
  if (error) throw new Error(`deleteTestUser failed: ${error.message}`)
}

// ── Data helpers ──────────────────────────────────────────────────────────────

/**
 * Insert a row as a specific user (bypasses RLS using service key).
 */
export async function insertAs(table: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
  const client = await getClient()
  const { data: result, error } = await client.from(table).insert(data).select().single()
  if (error) throw new Error(`insertAs(${table}) failed: ${error.message}`)
  return result
}

/**
 * Query rows from a table (bypasses RLS using service key).
 */
export async function queryAs(table: string, filters: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  if (Object.keys(filters).length === 0) {
    throw new Error(`queryAs(${table}): filters must not be empty — would return entire table`)
  }
  const client = await getClient()
  let query = client.from(table).select('*')
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value)
  }
  const { data, error } = await query
  if (error) throw new Error(`queryAs(${table}) failed: ${error.message}`)
  return data ?? []
}

/**
 * Delete rows matching filters (bypasses RLS using service key).
 */
export async function deleteWhere(table: string, filters: Record<string, unknown>): Promise<void> {
  const client = await getClient()
  let query = client.from(table).delete()
  for (const [key, value] of Object.entries(filters)) {
    query = query.eq(key, value)
  }
  const { error } = await query
  if (error) throw new Error(`deleteWhere(${table}) failed: ${error.message}`)
}

// ── Assertions ────────────────────────────────────────────────────────────────

/**
 * Assert a row exists in the database matching the given filters.
 * Throws if not found within timeout.
 */
export async function assertRowExists(
  table: string,
  filters: Record<string, unknown>,
  timeoutMs = 5000
): Promise<void> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    const rows = await queryAs(table, filters)
    if (rows.length > 0) return
    await new Promise(r => setTimeout(r, 500))
  }
  throw new Error(`assertRowExists(${table}) timed out. Filters: ${JSON.stringify(filters)}`)
}
