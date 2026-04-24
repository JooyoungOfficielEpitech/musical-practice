#!/usr/bin/env npx tsx
/**
 * Get a Supabase session for the test user and print it as JSON to stdout.
 * Used by inject-session.sh before E2E flows run.
 *
 * Usage: npx tsx e2e/helpers/get-session.ts
 * Output: single-line JSON string of the session object
 */
import { createClient } from '@supabase/supabase-js'
import accounts from '../accounts.json'

const url = process.env.SUPABASE_URL
const anonKey = process.env.SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_ANON_KEY')
  process.exit(1)
}

const supabase = createClient(url, anonKey, { auth: { persistSession: false } })

const role = 'user'
const { email, password } = accounts.roles[role as keyof typeof accounts.roles]

async function main() {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    console.error(`Login failed: ${error.message}`)
    process.exit(1)
  }

  const s = data.session
  // Output the exact JSON structure Supabase JS client stores in AsyncStorage
  process.stdout.write(JSON.stringify({
    access_token: s.access_token,
    token_type: s.token_type,
    expires_in: s.expires_in,
    expires_at: s.expires_at,
    refresh_token: s.refresh_token,
    user: s.user,
  }))
}

main()
