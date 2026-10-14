#!/usr/bin/env python3
"""LAB05 isolated local multi-writer/restart/backup/rollback canary.
Synthesized fixture only; never contact Cloudflare and never access production.
"""
import concurrent.futures as futures
import copy
import json
import os
import runpy
import sqlite3
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LAB03 = ROOT / "tools/motorlab-memory-lab03-db.py"
model = runpy.run_path(str(LAB03))
MAIN = model["EXPECTED_MAIN"]
LAB01 = model["EXPECTED_LAB01"]
RUN = model["EXPECTED_RUN"]
STAMP = "2026-10-13T12:00:00Z"
KEYS = list(model["EXPECTED_SOURCE"]) + ["memory.lab01.ci"]
def synth_bundle():
    records = []
    for n, key in enumerate(KEYS):
        sha = LAB01 if key.startswith("memory.lab01") else MAIN
        records.append({
            "memory_id": "lab05.synthetic." + str(n + 1), "project_id": "MotorLab",
            "scope": "PROJECT" if key.startswith("memory.lab01") else "GLOBAL",
            "kind": "RULE" if key.startswith("authority.") else ("EVENT" if key == "memory.lab01.ci" else "TECHNICAL_FACT"),
            "memory_key": key,
            "content": "LAB05 SYNTHETIC CANARY " + key,
            "state": "VERIFIED", "source_class": "AUTHORITATIVE",
            "evidence_ref": "https://github.com/Br174/Chatgpt/commit/" + sha,
            "approval_ref": None, "valid_at": STAMP, "recorded_at": STAMP
        })
    by_key = {r["memory_key"]: r for r in records}
    def link(a, b):
        return {"from_id": by_key[a]["memory_id"], "to_id": by_key[b]["memory_id"],
                "relation": "RELATED_TO", "evidence_ref": by_key[a]["evidence_ref"]}
    receipts = []
    for p in sorted(set(model["EXPECTED_SOURCE"].values())):
        receipts.append({"repository": "Br174/Chatgpt", "path": p, "commit_sha": LAB01 if p.startswith("docs/") else MAIN,
                         "blob_sha": "a" * 40, "integrity": "git_blob_sha1_verified"})
    return {
        "source_pins": {"main": MAIN, "lab01": LAB01},
        "ci_proof": {"run_id": RUN, "status": "success",
                     "url": "https://github.com/Br174/Chatgpt/actions/runs/" + str(RUN)},
        "receipts": receipts, "records": records,
        "links": [link("authority.d1", "infra.d1"), link("authority.kv", "infra.kv"),
                  link("memory.lab01.scope", "memory.lab01.ci"), link("core.release", "authority.github")],
        "lineage": []
    }
def check(predicate, code):
    if not predicate:
        raise AssertionError("LAB05_CANARY_FAILED:" + code)
def counts(db):
    return {
        t: db.execute("SELECT COUNT(*) FROM " + t).fetchone()[0]
        for t in ("memory_records", "memory_links", "memory_source_links", "operation_events", "velocity_lessons")
    }
def dbconnect(path):
    return model["connect"](path)
def main():
    # DB scoped to local temp and always deleted after checks (not Cloudflare staging).
    with tempfile.TemporaryDirectory(prefix="motorlab-lab05-local-writers-") as work:
        root = Path(work)
        dbfile = root / "memory-test.sqlite3"
        bundle = synth_bundle()
        inputfile = root / "synthetic-only.json"
        inputfile.write_text(json.dumps(bundle), encoding="utf-8")
        os.chmod(inputfile, 0o600)
        db = dbconnect(dbfile)
        try:
            model["init"](db)
            check(counts(db)["memory_records"] == 0, "db_not_empty")
        finally:
            db.close()
        # A hard process exit midtransaction must cause a complete rollback.
        crash_env = dict(os.environ, MOTORLAB_LAB03_FAILPOINT="CRASH_AFTER_FIRST_RECORD")
        crashed = subprocess.run([sys.executable, str(LAB03), "ingest", "--database", str(dbfile),
                                  "--bundle", str(inputfile)], env=crash_env, capture_output=True, timeout=30)
        check(crashed.returncode == 75, "crash_not_triggered")
        with dbconnect(dbfile) as db:
            check(counts(db)["memory_records"] == 0, "crash_left_partial_rows")
        # Many separate SQLite connections race on the SAME database file: one writer, idempotent retries.
        def writer(n):
            db = dbconnect(dbfile)
            try:
                result = model["ingest"](db, bundle)
                return (n, result["written"], result["already_present"])
            finally:
                db.close()
        with futures.ThreadPoolExecutor(max_workers=6) as pool:
            writes = list(pool.map(writer, range(12)))
        check(sum(v[1] for v in writes) == 9, "race_duplicated_memories")
        check(sum(v[2] for v in writes) == 99, "race_idempotency_mismatch")
        with dbconnect(dbfile) as db:
            first = counts(db)
            check(first == {"memory_records": 9, "memory_links": 4, "memory_source_links": 9,
                            "operation_events": 0, "velocity_lessons": 0}, "inconsistent_after_writers")
            check(db.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "sqlite_corruption")
            check(db.execute("PRAGMA foreign_key_check").fetchall() == [], "fk_corruption")
            first_seen = [r[0] for r in db.execute("SELECT recorded_at FROM memory_records ORDER BY memory_id")]
            # Bitemporal ingestion date must not be replaced by subsequent imports.
            check(all(r != STAMP for r in first_seen), "recorded_at_not_real_ingest")
            # Error during import must roll back changes, not replace authorized memory.
            conflict = copy.deepcopy(bundle)
            conflict["records"][0]["content"] = "LAB05 conflicting synthetic rewrite"
            try:
                model["ingest"](db, conflict)
                raise AssertionError("mutating_identity_accepted")
            except ValueError as error:
                check("immutable_record_conflict" in str(error), "wrong_conflict_error")
            missing = copy.deepcopy(bundle)
            missing["lineage"].append({
                "memory_id": bundle["records"][0]["memory_id"], "source_kind": "OPERATION_EVENT",
                "source_id": "nonexistent-operation-event", "source_ref": "lab05-synthetic"
            })
            try:
                model["ingest"](db, missing)
                raise AssertionError("nonexistent_source_accepted")
            except ValueError as error:
                check("missing_operational_event" in str(error), "wrong_lineage_error")
            check(counts(db) == first, "negative_test_mutated_memory")
            # Reliable SQLite online backup; can be reopened on an independent path.
            backup_path = root / "last-good-backup.sqlite3"
            with sqlite3.connect(str(backup_path)) as backup:
                db.backup(backup)
            check(backup_path.is_file(), "backup_missing")
        with dbconnect(backup_path) as restored:
            check(counts(restored) == first, "backup_restore_mismatch")
            check(restored.execute("PRAGMA integrity_check").fetchone()[0] == "ok", "bad_backup")
            check(restored.execute("PRAGMA foreign_key_check").fetchall() == [], "backup_fk_failed")
            second_seen = [r[0] for r in restored.execute("SELECT recorded_at FROM memory_records ORDER BY memory_id")]
            check(second_seen == first_seen, "backup_timestamp_drift")
        print(json.dumps({
            "result": "LAB05_LOCAL_SQLITE_CONCURRENCY_BACKUP_PASS",
            "workers": 6, "simultaneous_worker_requests": 12,
            "first_committed_memories": 9, "duplicate_record_writes": 0,
            "persisted_relations": 4, "source_pointers": 9,
            "simulated_hard_crash_code": 75, "partial_rows_after_crash": 0,
            "immutable_conflict_blocked": True, "missing_legacy_ref_blocked": True,
            "online_backup_and_new_connection_restore": True,
            "production_cloudflare_writes": 0, "testing_scope": "ephemeral_local_file_sqlite_only"
        }, sort_keys=True))

if __name__ == "__main__":
    try:
        main()
    except Exception as err:
        print("LAB05_LOCAL_CANARY_FAILURE:" + str(err), file=sys.stderr)
        sys.exit(1)
