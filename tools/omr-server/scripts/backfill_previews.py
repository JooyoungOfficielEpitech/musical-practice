"""One-off backfill: generate page-1 preview JPEGs for existing OMR results.

Previews ship with new jobs automatically (job_processor uploads them beside
the MusicXML). Results processed before that change have no preview — this
script renders page 1 of each done job's PDF and uploads the missing ones.

Usage:
    source venv/bin/activate && set -a && source .env && set +a
    python scripts/backfill_previews.py
"""
import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from omr_io.pdf_to_png import pdf_to_png  # noqa: E402
from omr_queue.supabase_client import get_supabase_client  # noqa: E402
from pipeline.preview import make_preview_jpeg, preview_storage_path  # noqa: E402

PDF_BUCKET = "omr-pdfs"
RESULT_BUCKET = "omr-results"


def preview_exists(client, path: str) -> bool:
    folder, _, name = path.rpartition("/")
    entries = client.storage.from_(RESULT_BUCKET).list(folder)
    return any(e.get("name") == name for e in entries)


def main() -> None:
    client = get_supabase_client()
    jobs = (
        client.table("omr_jobs")
        .select("id, pdf_storage_path, result_storage_path, user_id, status")
        .eq("status", "done")
        .execute()
        .data
    )
    print(f"{len(jobs)} done jobs found")

    uploaded = skipped = failed = 0
    for job in jobs:
        result_path = job.get("result_storage_path")
        pdf_path = job.get("pdf_storage_path")
        if not result_path or not pdf_path:
            skipped += 1
            continue

        target = preview_storage_path(result_path)
        try:
            if preview_exists(client, target):
                skipped += 1
                continue

            pdf_bytes = client.storage.from_(PDF_BUCKET).download(pdf_path)
            with tempfile.TemporaryDirectory() as tmp:
                local_pdf = os.path.join(tmp, "in.pdf")
                with open(local_pdf, "wb") as fh:
                    fh.write(pdf_bytes)
                chunks = pdf_to_png(local_pdf, [(1, 1)], tmp, dpi=150)
                first_png = chunks[0][0] if chunks and chunks[0] else None
                data = make_preview_jpeg(first_png) if first_png else None

            if data is None:
                failed += 1
                print(f"  FAIL (render) {job['id']}")
                continue

            client.storage.from_(RESULT_BUCKET).upload(
                target, data, {"content-type": "image/jpeg", "upsert": "true"}
            )
            uploaded += 1
            print(f"  OK {target}")
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"  FAIL {job['id']}: {exc}")

    print(f"done — uploaded={uploaded} skipped={skipped} failed={failed}")


if __name__ == "__main__":
    main()
