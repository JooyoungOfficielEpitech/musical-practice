/**
 * Maestro evalScript: inject a Supabase session into AsyncStorage
 * so the app launches as a logged-in user without going through Apple Sign-In.
 *
 * Usage in Maestro YAML:
 *   - evalScript:
 *       file: ./inject-session.js
 *
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY set as Maestro env vars.
 * The test user must exist (run: npm run test:e2e:seed first).
 */

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
)

async function injectSession() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: process.env.EMAIL,
    password: process.env.PASSWORD,
  })
  if (error) throw new Error(`Login failed: ${error.message}`)

  const session = data.session
  const storageKey = `sb-${new URL(process.env.SUPABASE_URL).hostname.split('.')[0]}-auth-token`

  // Inject into AsyncStorage (React Native)
  await maestro.storage.put(storageKey, JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    user: session.user,
  }))
}

injectSession()
