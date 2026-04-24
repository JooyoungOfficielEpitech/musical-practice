#!/usr/bin/env npx ts-node
/**
 * E2E seed script — creates test accounts and initial data before E2E runs.
 * Populated by harness-init based on detected roles and backend.
 * Run: npx ts-node e2e/helpers/seed.ts
 */
import { createTestUser } from './api-client.js'
import accounts from '../accounts.json'

async function seed() {
  console.log('🌱 Seeding E2E test accounts...')

  for (const [role, config] of Object.entries(accounts.roles)) {
    try {
      const user = await createTestUser(config.email, config.password, { role })
      console.log(`  ✅ ${role}: ${config.email} (${user.id})`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('already') || message.includes('already exists')) {
        console.log(`  ℹ️  ${role}: already exists, skipping`)
      } else {
        throw err
      }
    }
  }

  // ── Project-specific seed data ─────────────────────────────────────────────
  // harness-init will add project-specific setup here
  // e.g.: await insertAs('channels', { name: 'general', created_by: adminId })

  console.log('✅ Seed complete')
}

seed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
