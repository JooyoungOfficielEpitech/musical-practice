# M3: Supabase Queue Loop

**Goal:** Close the end-to-end loop — user confirms page ranges → PDF uploaded to Supabase Storage → `omr_jobs` row inserted → Mac OMR server polls, processes, uploads MusicXML result → app receives result via Supabase Realtime → saved locally.

**Scope:** Large (3 independent systems: DB migration, server poller, mobile queue)
**Approach:** Parallel agent team — Track S (server) and Track A (mobile) run concurrently after migration is in place.

**Commands:**
- `test-cmd`: `npx jest`
- `python-test-cmd`: `cd tools/omr-server && python -m pytest`
- `lint-cmd`: `npx expo lint`
- `tsc-cmd`: `npx tsc --noEmit`

**Key decisions:**
- Auth mode: anonymous (no `auth.uid()`) — users don't need to be logged in
- Null Supabase: throw `OmrQueueError` with clear message (no silent fallback)
- MusicXML stored locally on device only (no server sync)
- Server polls every 5s manually (no cron)

---

## Phase 0 — DB Migration [MAIN THREAD]

**Layer:** Frameworks & Drivers (Supabase SQL)
**Files:**
- `supabase/migrations/001_omr_jobs.sql` [TO CREATE]

**Schema:**
```sql
create table omr_jobs (
  id           uuid primary key default gen_random_uuid(),
  status       text not null default 'pending'
               check (status in ('pending','processing','done','failed')),
  pdf_storage_path    text not null,
  page_ranges  jsonb not null default '[]',
  result_storage_path text,
  error        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- RLS: public read/write for dev (anonymous mode)
alter table omr_jobs enable row level security;
create policy "public_all" on omr_jobs for all using (true) with check (true);
```

**Buckets (configured via Supabase dashboard or migration):**
- `omr-pdfs` — public upload, authenticated read
- `omr-results` — service-role upload, public read

**Quality gate:** Migration file is valid SQL, no `ALTER DATABASE`, no session-level SET.

---

## Track S — Server Poller (Python)

**Phases: S1 → S2**
**CA Layer:** Infrastructure (tools/omr-server/)

### Phase S1 — Supabase client + job processor

**Files:**
- `tools/omr-server/queue/__init__.py` [TO CREATE]
- `tools/omr-server/queue/supabase_client.py` [TO CREATE]
- `tools/omr-server/queue/job_processor.py` [TO CREATE]
- `tools/omr-server/queue/errors.py` [TO CREATE]
- `tools/omr-server/tests/test_queue_client.py` [TO CREATE]
- `tools/omr-server/tests/test_job_processor.py` [TO CREATE]
- `tools/omr-server/requirements.txt` [MODIFY — add supabase, python-dotenv]

**Interfaces:**
```python
# errors.py
class OmrQueueError(Exception): ...

# supabase_client.py
def get_supabase_client() -> supabase.Client:
    """Read SUPABASE_URL + SUPABASE_SERVICE_KEY from env. Raises OmrQueueError if missing."""

# job_processor.py
def process_job(job: dict, client: supabase.Client) -> str:
    """Download PDF from storage, run OMR on page ranges, upload MusicXML, return result_storage_path.
    Raises OmrQueueError on any failure."""
```

**Test scenarios (S1):**
- `get_supabase_client` raises `OmrQueueError` when env vars missing
- `get_supabase_client` returns client when vars are set
- `process_job` downloads PDF, calls pdf_to_png + run_best_strategy per page range
- `process_job` uploads assembled MusicXML to omr-results bucket
- `process_job` raises `OmrQueueError` on storage download failure

**Quality gate:**
- [ ] `python -m pytest tools/omr-server/tests/test_queue_client.py tools/omr-server/tests/test_job_processor.py` green
- [ ] No file > 120 lines
- [ ] No function > 40 lines

---

### Phase S2 — Poller loop

**Files:**
- `tools/omr-server/queue/poller.py` [TO CREATE]
- `tools/omr-server/tests/test_poller.py` [TO CREATE]

**Interface:**
```python
def poll_once(client: supabase.Client) -> bool:
    """Claim one pending job, process it, update status. Returns True if a job was found."""

def run_poll_loop(interval_seconds: float = 5.0) -> None:
    """Infinite loop: poll_once every interval_seconds. Ctrl+C to stop."""
```

**Test scenarios (S2):**
- `poll_once` returns False when no pending jobs
- `poll_once` claims job (status → processing), calls process_job, updates status → done
- `poll_once` marks job failed with error message on OmrQueueError
- `poll_once` does NOT process a job already in processing status (no double-claim)
- Concurrent claim uses UPDATE … WHERE status='pending' RETURNING to prevent double-processing

**Quality gate:**
- [ ] `python -m pytest tools/omr-server/` green (all tests including prior 83)
- [ ] `ruff check tools/omr-server/queue/` clean
- [ ] No file > 120 lines

---

## Track A — Mobile Queue (TypeScript)

**Phases: A1 → A2 → A3**

### Phase A1 — omrQueue lib

**CA Layer:** Entities / lib
**Files:**
- `client/lib/omrQueue.ts` [TO CREATE]
- `__tests__/unit/lib/omrQueue.test.ts` [TO CREATE]

**Interface:**
```typescript
export class OmrQueueError extends Error {}

export type OmrJobStatus = 'pending' | 'processing' | 'done' | 'failed';

export interface OmrJob {
  id: string;
  status: OmrJobStatus;
  pdfStoragePath: string;
  pageRanges: PageRange[];
  resultStoragePath: string | null;
  error: string | null;
}

export async function uploadPdfToStorage(
  pdfB64: string,
  jobId: string,
): Promise<string>;  // returns storage path

export async function submitOmrJob(
  pdfStoragePath: string,
  pageRanges: PageRange[],
): Promise<string>;  // returns jobId

export async function downloadResult(
  resultStoragePath: string,
  sheetId: string,
): Promise<string>;  // returns local MusicXML URI
```

**Test scenarios (A1):**
- `uploadPdfToStorage` calls `supabase.storage.from('omr-pdfs').upload(...)` with correct path
- `uploadPdfToStorage` throws `OmrQueueError` when supabase is null
- `submitOmrJob` inserts row with status 'pending' and returns id
- `submitOmrJob` throws `OmrQueueError` on insert error
- `downloadResult` downloads file, saves to `Paths.document/musicxml/{sheetId}.musicxml`, returns URI
- `downloadResult` throws `OmrQueueError` on download failure

**Quality gate:**
- [ ] `npx jest __tests__/unit/lib/omrQueue.test.ts` green
- [ ] `lib/omrQueue.ts` imports nothing from hooks, context, screens, components
- [ ] No `any` types
- [ ] All exports have explicit return types

---

### Phase A2 — useOmrJob hook

**CA Layer:** Use Cases / hooks
**Files:**
- `client/hooks/useOmrJob.ts` [TO CREATE]
- `__tests__/unit/hooks/useOmrJob.test.ts` [TO CREATE]

**Interface:**
```typescript
export type OmrJobState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'queued'; jobId: string }
  | { status: 'processing'; jobId: string }
  | { status: 'done'; musicXmlUri: string }
  | { status: 'failed'; error: string };

export function useOmrJob(): {
  state: OmrJobState;
  submitJob: (pdfB64: string, pageRanges: PageRange[], sheetId: string) => void;
  reset: () => void;
};
```

**Test scenarios (A2):**
- `submitJob` transitions idle → submitting → queued
- Realtime subscription fires with status 'processing' → state transitions to processing
- Realtime subscription fires with status 'done' → downloads result → transitions to done with musicXmlUri
- Realtime subscription fires with status 'failed' → transitions to failed with error message
- `reset` returns state to idle and unsubscribes Realtime channel
- OmrQueueError during submit → transitions to failed

**Quality gate:**
- [ ] `npx jest __tests__/unit/hooks/useOmrJob.test.ts` green
- [ ] `hooks/useOmrJob.ts` imports nothing from screens or components
- [ ] Realtime channel is cleaned up on unmount (useEffect return)

---

### Phase A3 — PdfImportScreen integration

**CA Layer:** Frameworks & Drivers / screens
**Files:**
- `client/screens/PdfImportScreen.tsx` [MODIFY]

**Changes:**
- Import `useOmrJob` hook
- After `confirmRanges`: read pdfB64 from pdfImport state, generate `sheetId` (uuid), call `submitJob`
- Add render cases for new states: `queued` ("Waiting in queue…"), `processing` ("Recognizing music…"), `done` (show success + "View Sheet" button → navigate to PracticeDetail or Library)
- Error state now also handles OmrJob `failed` state

**No new test file** — existing `usePdfImport` and `useOmrJob` tests cover logic. Screen is a thin render layer.

**Quality gate:**
- [ ] `npx jest` passes (all existing + new tests)
- [ ] `npx tsc --noEmit` clean
- [ ] `npx expo lint` clean (one known pre-existing Deno lint error in supabase/functions is acceptable)
- [ ] `PdfImportScreen.tsx` ≤ 200 lines

---

## Global Quality Gates (post all phases)

- [ ] `npx jest` — all JS/TS tests green
- [ ] `cd tools/omr-server && python -m pytest` — all Python tests green  
- [ ] `npx tsc --noEmit` — zero errors
- [ ] `npx expo lint` — zero new errors
- [ ] No file > 250 lines
- [ ] No `any` types introduced
- [ ] CA dependency rules not violated

---

## Execution Plan — Agent Team

**Main thread** executes Phase 0 (migration file), then spawns two agents simultaneously:

| Agent | Phases | Files owned |
|-------|--------|-------------|
| `server-agent` | S1 → S2 | `tools/omr-server/queue/`, `tools/omr-server/tests/test_queue_*.py`, `tools/omr-server/tests/test_poller.py`, `requirements.txt` |
| `mobile-agent` | A1 → A2 → A3 | `client/lib/omrQueue.ts`, `client/hooks/useOmrJob.ts`, `client/screens/PdfImportScreen.tsx`, `__tests__/unit/lib/omrQueue.test.ts`, `__tests__/unit/hooks/useOmrJob.test.ts` |

Main thread runs quality gates after each agent reports done.

---

## Progress Tracker

- [x] Phase 0 — DB Migration
- [x] Phase S1 — Server: supabase_client + job_processor
- [x] Phase S2 — Server: poller loop
- [x] Phase A1 — Mobile: omrQueue lib
- [x] Phase A2 — Mobile: useOmrJob hook
- [x] Phase A3 — Mobile: PdfImportScreen integration
- [x] Global quality gates
