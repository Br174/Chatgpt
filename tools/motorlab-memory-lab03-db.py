#!/usr/bin/env python3
"""LAB03 ONLY: on-disk SQLite lab persistence, no Cloudflare credentials or endpoints.

Source documents are attested by LAB02 GitHub read-only verifier, outside this process.
This importer validates the attestation shape and consistency; it does not re-contact GitHub.
"""
import argparse
import datetime as dt
import json
import os
import re
import sqlite3
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_SOURCE = {
    "core.release": "MOTORLAB_RELEASE_MANIFEST_V1.txt",
    "authority.github": "MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt",
    "authority.d1": "MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt",
    "authority.kv": "MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt",
    "authority.notion": "MOTORLAB_AUTHORITY_DATA_OWNERSHIP_V1.txt",
    "infra.d1": "MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt",
    "infra.kv": "MOTORLAB_SERVICE_INTEGRATION_STATUS_V1.txt",
    "memory.lab01.scope": "docs/memory-core-lab01/README.md",
}
EXPECTED_MAIN = "aca9245b97f807f02ea9e122d8b2a3aae40feb9a"
EXPECTED_LAB01 = "800a1c49bacaa81a2844c147247752df408f217e"
EXPECTED_RUN = 38482460935
RECORD_FIELDS = ("memory_id", "project_id", "scope", "kind", "memory_key", "content",
                 "state", "source_class", "evidence_ref", "approval_ref", "valid_at", "recorded_at")
LINK_FIELDS = ("from_id", "to_id", "relation", "evidence_ref")
SOURCE_FIELDS = ("memory_id", "source_kind", "source_id", "source_ref")
ID_RE = re.compile(r"^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$")
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
SECRET_RE = re.compile(r"(?i)(?:ghp_[a-z0-9]{12,}|github_pat_[a-z0-9_]{8,}|sk-proj-[a-z0-9-]{8,}|bearer\s+\S+|password\s*[:=]\s*\S+|-----BEGIN [A-Z ]*PRIVATE KEY-----)")
SCHEMA_ADDITION = """
CREATE TABLE IF NOT EXISTS memory_source_links (
    memory_id TEXT NOT NULL,
    source_kind TEXT NOT NULL CHECK(source_kind IN ('GITHUB_COMMIT','GITHUB_ACTIONS','OPERATION_EVENT','VELOCITY_LESSON')),
    source_id TEXT NOT NULL,
    source_ref TEXT NOT NULL,
    PRIMARY KEY(memory_id, source_kind, source_id),
    FOREIGN KEY(memory_id) REFERENCES memory_records(memory_id)
);
CREATE INDEX IF NOT EXISTS idx_memory_source_links_kind_id ON memory_source_links(source_kind,source_id);
"""

def now_iso():
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")

def fail(code):
    raise ValueError(code)

def require(condition, code):
    if not condition:
        fail(code)

def canonical_schema():
    # Load existing D1 SQLite schema verbatim; NEVER fork a second handwritten projects/operations schema.
    script = ("import {SCHEMA_SQL} from './cloudflare/motorlab-state-bridge/src/schema.js';"
              "import {MEMORY_CATALOG_SCHEMA_SQL} from './cloudflare/motorlab-state-bridge/src/memory-catalog.mjs';"
              "process.stdout.write(SCHEMA_SQL+'\\n'+MEMORY_CATALOG_SCHEMA_SQL);")
    result = subprocess.run(["node", "--input-type=module", "--eval", script], cwd=ROOT,
                            check=True, capture_output=True, text=True, timeout=15)
    return result.stdout + "\n" + SCHEMA_ADDITION

def connect(path):
    require(path != ":memory:" and path.is_absolute(), "absolute_on_disk_db_required")
    require(not path.is_symlink(), "symlink_db_forbidden")
    path.parent.mkdir(parents=True, exist_ok=True)
    db = sqlite3.connect(str(path), timeout=10, isolation_level=None)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA busy_timeout=10000")
    db.execute("PRAGMA journal_mode=WAL")
    return db

def init(db):
    db.executescript(canonical_schema())
    db.execute("""INSERT OR IGNORE INTO projects(project_id,repository,lifecycle_stage,updated_at)
                  VALUES (?,?,?,?)""", ("MotorLab", "Br174/Chatgpt", "LAB", now_iso()))
    require(db.execute("PRAGMA foreign_key_check").fetchall() == [], "baseline_fk_violation")

def keys(obj, allowed):
    require(isinstance(obj, dict) and set(obj) == set(allowed), "invalid_payload_fields")

def validate_bundle(payload):
    require(isinstance(payload, dict) and set(payload) == {
        "source_pins", "ci_proof", "records", "links", "receipts", "lineage"
    }, "invalid_bundle_fields")
    require(payload["source_pins"] == {"main": EXPECTED_MAIN, "lab01": EXPECTED_LAB01}, "untrusted_source_pins")
    ci = payload["ci_proof"]
    require(isinstance(ci, dict) and ci.get("run_id") == EXPECTED_RUN
            and ci.get("status") == "success"
            and ci.get("url") == "https://github.com/Br174/Chatgpt/actions/runs/" + str(EXPECTED_RUN),
            "invalid_ci_receipt")
    receipts = payload["receipts"]
    require(isinstance(receipts, list) and len(receipts) == 4, "invalid_receipt_count")
    by_path = {}
    for item in receipts:
        keys(item, ("repository", "path", "commit_sha", "blob_sha", "integrity"))
        path = item["path"]
        expected_sha = EXPECTED_LAB01 if path == "docs/memory-core-lab01/README.md" else EXPECTED_MAIN
        require(path in set(EXPECTED_SOURCE.values()) and path not in by_path
                and item["repository"] == "Br174/Chatgpt"
                and item["commit_sha"] == expected_sha
                and isinstance(item["blob_sha"], str) and SHA_RE.fullmatch(item["blob_sha"])
                and item["integrity"] == "git_blob_sha1_verified", "untrusted_file_receipt")
        by_path[path] = item
    require(len(by_path) == 4, "missing_file_receipt")
    records = payload["records"]
    links = payload["links"]
    require(isinstance(records, list) and len(records) == 9, "unexpected_record_count")
    require(isinstance(links, list) and len(links) == 4, "unexpected_link_count")
    ids, record_by_id = set(), {}
    auto_lineage = []
    for r in records:
        keys(r, RECORD_FIELDS)
        require(isinstance(r["memory_id"], str) and ID_RE.fullmatch(r["memory_id"])
                and r["memory_id"] not in ids, "invalid_or_duplicate_memory_id")
        ids.add(r["memory_id"])
        require(r["project_id"] == "MotorLab"
                and r["state"] == "VERIFIED" and r["source_class"] == "AUTHORITATIVE"
                and r["approval_ref"] is None and r["memory_key"] in set(EXPECTED_SOURCE) | {"memory.lab01.ci"},
                "unexpected_memory_authority")
        require(r["kind"] in ("TECHNICAL_FACT", "RULE", "EVENT")
                and r["scope"] in ("GLOBAL", "PROJECT")
                and isinstance(r["content"], str) and 0 < len(r["content"]) <= 4000
                and not SECRET_RE.search(r["content"]), "unsafe_memory_content")
        require(isinstance(r["valid_at"], str) and isinstance(r["recorded_at"], str), "invalid_timestamp")
        for name in ("valid_at", "recorded_at"):
            try:
                dt.datetime.fromisoformat(r[name].replace("Z", "+00:00"))
            except (ValueError, TypeError):
                fail("invalid_timestamp")
        if r["memory_key"] == "memory.lab01.ci":
            expected_sha = EXPECTED_LAB01
            auto_lineage.append({"memory_id": r["memory_id"], "source_kind": "GITHUB_ACTIONS",
                                  "source_id": str(EXPECTED_RUN), "source_ref": ci["url"]})
        else:
            p = EXPECTED_SOURCE[r["memory_key"]]
            expected_sha = by_path[p]["commit_sha"]
            auto_lineage.append({"memory_id": r["memory_id"], "source_kind": "GITHUB_COMMIT",
                                  "source_id": expected_sha, "source_ref": "Br174/Chatgpt@" + expected_sha + ":" + p})
        require(r["evidence_ref"] == "https://github.com/Br174/Chatgpt/commit/" + expected_sha,
                "mismatched_record_proof")
        record_by_id[r["memory_id"]] = r
    require(set(r["memory_key"] for r in records) == set(EXPECTED_SOURCE) | {"memory.lab01.ci"},
            "missing_or_duplicate_memory_key")
    known_links = set()
    for l in links:
        keys(l, LINK_FIELDS)
        pair = (l["from_id"], l["to_id"], l["relation"])
        require(l["from_id"] in ids and l["to_id"] in ids and l["from_id"] != l["to_id"]
                and l["relation"] == "RELATED_TO" and pair not in known_links
                and l["evidence_ref"] == record_by_id[l["from_id"]]["evidence_ref"],
                "invalid_memory_link")
        known_links.add(pair)
    lineage = payload["lineage"]
    require(isinstance(lineage, list) and len(lineage) <= 12, "invalid_lineage_count")
    for ref in lineage:
        keys(ref, SOURCE_FIELDS)
        require(ref["memory_id"] in ids
                and ref["source_kind"] in ("OPERATION_EVENT", "VELOCITY_LESSON")
                and isinstance(ref["source_id"], str) and ID_RE.fullmatch(ref["source_id"])
                and isinstance(ref["source_ref"], str) and 0 < len(ref["source_ref"]) <= 300
                and not SECRET_RE.search(ref["source_ref"]), "invalid_source_lineage")
    return records, links, auto_lineage + lineage

def validate_referenced_ledger(db, ref):
    if ref["source_kind"] == "OPERATION_EVENT":
        row = db.execute("""SELECT o.project_id FROM operation_events e
                            JOIN operations o ON e.operation_id=o.operation_id WHERE e.event_id=?""",
                         (ref["source_id"],)).fetchone()
        require(row is not None and row["project_id"] == "MotorLab", "missing_operational_event")
    elif ref["source_kind"] == "VELOCITY_LESSON":
        row = db.execute("SELECT project_id FROM velocity_lessons WHERE lesson_id=?",
                         (ref["source_id"],)).fetchone()
        require(row is not None and row["project_id"] == "MotorLab", "missing_verified_lesson")

def ingest(db, payload):
    records, links, lineage = validate_bundle(payload)
    existing = 0
    new_records = 0
    # Single writer plus one atomic transaction. A failure rolls back the whole import.
    db.execute("BEGIN IMMEDIATE")
    try:
        for r in records:
            present = db.execute("SELECT * FROM memory_records WHERE memory_id=?", (r["memory_id"],)).fetchone()
            if present:
                require(all(present[k] == r[k] for k in RECORD_FIELDS if k != "recorded_at"),
                        "immutable_record_conflict")
                existing += 1
                continue
            values = [r[k] if k != "recorded_at" else now_iso() for k in RECORD_FIELDS]
            db.execute("INSERT INTO memory_records("+",".join(RECORD_FIELDS)+") VALUES ("+
                       ",".join("?" for _ in RECORD_FIELDS)+")", values)
            new_records += 1
            # LAB-ONLY fault injection: verify SQLite rolls back on abrupt process death.
            if new_records == 1 and os.environ.get('MOTORLAB_LAB03_FAILPOINT') == 'CRASH_AFTER_FIRST_RECORD':
                os._exit(75)
        for l in links:
            present = db.execute("SELECT evidence_ref FROM memory_links WHERE from_id=? AND to_id=? AND relation=?",
                                 (l["from_id"], l["to_id"], l["relation"])).fetchone()
            if present:
                require(present["evidence_ref"] == l["evidence_ref"], "immutable_link_conflict")
            else:
                db.execute("INSERT INTO memory_links ("+",".join(LINK_FIELDS)+") VALUES (?,?,?,?)",
                           [l[k] for k in LINK_FIELDS])
        for ref in lineage:
            validate_referenced_ledger(db, ref)
            present = db.execute("SELECT source_ref FROM memory_source_links WHERE memory_id=? AND source_kind=? AND source_id=?",
                                 (ref["memory_id"], ref["source_kind"], ref["source_id"])).fetchone()
            if present:
                require(present["source_ref"] == ref["source_ref"], "immutable_source_link_conflict")
            else:
                db.execute("INSERT INTO memory_source_links("+",".join(SOURCE_FIELDS)+") VALUES (?,?,?,?)",
                           [ref[k] for k in SOURCE_FIELDS])
        require(db.execute("PRAGMA foreign_key_check").fetchall() == [], "foreign_key_violation")
        db.commit()
    except Exception:
        db.rollback()
        raise
    return {"written": new_records, "already_present": existing, "links": len(links),
            "source_links": len(lineage), "transaction": "committed"}

def export(db):
    records = [dict(r) for r in db.execute("SELECT * FROM memory_records ORDER BY memory_id")]
    links = [dict(r) for r in db.execute("SELECT * FROM memory_links ORDER BY from_id,to_id,relation")]
    lineage = [dict(r) for r in db.execute("SELECT * FROM memory_source_links ORDER BY memory_id,source_kind,source_id")]
    result = db.execute("PRAGMA integrity_check").fetchone()[0]
    require(result == "ok" and not db.execute("PRAGMA foreign_key_check").fetchall(), "sqlite_integrity_error")
    return {"records": records, "links": links, "lineage": lineage, "integrity": result}

def main():
    parser = argparse.ArgumentParser(description="MotorLab LAB03 SQLite ONLY; no production Cloudflare writes.")
    parser.add_argument("action", choices=["init", "ingest", "export"])
    parser.add_argument("--database", required=True)
    parser.add_argument("--bundle")
    args = parser.parse_args()
    db_path = Path(args.database).expanduser().absolute()
    with connect(db_path) as db:
        if args.action == "init":
            init(db)
            out = {"initialized": True, "backend": "local_sqlite_only"}
        elif args.action == "ingest":
            require(args.bundle is not None, "bundle_required")
            # init is safe and idempotent; unmodified live Worker schema never touched.
            init(db)
            bundle = json.loads(Path(args.bundle).read_text(encoding="utf-8"))
            out = ingest(db, bundle)
        else:
            out = export(db)
        print(json.dumps(out, ensure_ascii=False, sort_keys=True))

if __name__ == "__main__":
    try:
        main()
    except (ValueError, sqlite3.Error, subprocess.CalledProcessError) as exc:
        print("LAB03 rejected: " + str(exc), file=sys.stderr)
        sys.exit(1)
