#!/usr/bin/env npx ts-node
/**
 * E2E cleanup script — removes test accounts and data after E2E runs.
 * Run: npx ts-node e2e/helpers/cleanup.ts
 */
import { deleteTestUser, loginAs } from './api-client.js'
import accounts from '../accounts.json'

async function cleanup() {
  console.log('🧹 Cleaning up E2E test data...')

  // ── Project-specific cleanup (before users) ────────────────────────────────
  // harness-init will add project-specific teardown here
  // e.g.: await deleteWhere('messages', { content: { startsWith: '[E2E]' } })

  // ── Delete test accounts ───────────────────────────────────────────────────
  for (const [role, config] of Object.entries(accounts.roles)) {
    try {
      const user = await loginAs(config.email, config.password)
      await deleteTestUser(user.id)
      console.log(`  ✅ Deleted ${role}: ${config.email}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('not found') || message.includes('Invalid login')) {
        console.log(`  ℹ️  ${role}: not found, skipping`)
      } else {
        console.warn(`  ⚠️  ${role} cleanup error:`, message)
      }
    }
  }

  console.log('✅ Cleanup complete')
}

cleanup().catch(err => {
  console.error('❌ Cleanup failed:', err)
  process.exit(1)
})
