#!/usr/bin/env python3
"""LAB06 offline persistent store. Reuses LAB03 importer/schema; NO Cloudflare I/O."""
import argparse
import fcntl
import hashlib
import json
import os
import runpy
import sqlite3
import sys
import tempfile
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
LAB03 = runpy.run_path(str(ROOT / "tools/motorlab-memory-lab03-db.py"))
DB_NAME = "memory-core-lab06.sqlite3"
BACKUP_NAME = "memory-core-lab06-last-good.sqlite3"

def require(ok, code):
    if not ok:
        raise ValueError(code)

def safe_dir(raw):
    require(raw and os.path.isabs(raw), "absolute_data_dir_required")
    p = Path(raw)
    require(not p.is_symlink() and p.resolve() == p, "symlink_data_dir_forbidden")
    require(p != ROOT and ROOT not in p.parents, "repository_storage_forbidden")
    p.mkdir(parents=True, exist_ok=True, mode=0o700)
    require(p.is_dir() and not p.is_symlink(), "invalid_data_dir")
    return p

def safe_file(p):
    require(not p.is_symlink() and (not p.exists() or p.is_file()), "invalid_or_symlink_file")

@contextmanager
def single_writer(directory):
    lockfile = directory / ".memory-core-lab06.lock"
    fd = os.open(str(lockfile), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(fd, fcntl.LOCK_EX)
        yield
    finally:
        fcntl.flock(fd, fcntl.LOCK_UN)
        os.close(fd)

def open_existing(path):
    safe_file(path)
    require(path.is_file(), "store_not_initialized")
    return LAB03["connect"](path)

def check_and_snapshot(db):
    payload = LAB03["export"](db)
    require(db.execute("PRAGMA foreign_key_check").fetchall() == [], "foreign_key_violation")
    counts = {name: db.execute("SELECT COUNT(*) FROM " + name).fetchone()[0]
              for name in ("memory_records", "memory_links", "memory_source_links",
                           "operation_events", "velocity_lessons")}
    stable = json.dumps(payload, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return payload, counts, hashlib.sha256(stable).hexdigest()

def write_json(data):
    print(json.dumps(data, sort_keys=True, ensure_ascii=False))

def main():
    parser = argparse.ArgumentParser(description="MotorLab Memory LAB06 local-only persistent storage")
    parser.add_argument("action", choices=["init", "ingest", "snapshot", "status", "backup", "restore"])
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--bundle")
    parser.add_argument("--backup-file")
    args = parser.parse_args()
    os.umask(0o077)
    directory = safe_dir(args.data_dir)
    path = directory / DB_NAME
    safe_file(path)
    with single_writer(directory):
        if args.action == "init":
            with LAB03["connect"](path) as db:
                LAB03["init"](db)
                data, counts, digest = check_and_snapshot(db)
            write_json({"result": "LAB06_STORE_INITIALIZED", "counts": counts, "sha256": digest,
                        "backend": "on_disk_local_sqlite_only"})
        elif args.action == "ingest":
            require(path.exists(), "store_not_initialized")
            require(args.bundle and Path(args.bundle).is_file() and not Path(args.bundle).is_symlink(),
                    "trusted_bundle_file_required")
            bundle = json.loads(Path(args.bundle).read_text(encoding="utf-8"))
            with open_existing(path) as db:
                # Only the caller can independently attest real GitHub evidence. LAB03 checks
                # strict pinned receipt shape/immutable provenance; never claim independent
                # verification for a caller-supplied JSON bundle.
                inserted = LAB03["ingest"](db, bundle)
                _, counts, digest = check_and_snapshot(db)
            write_json({"result": "LAB06_LOCAL_IMPORT", "ingestion": inserted, "counts": counts,
                        "sha256": digest, "proof": "bundle_shape_only_caller_must_verify_sources"})
        elif args.action in ("snapshot", "status", "backup"):
            with open_existing(path) as db:
                data, counts, digest = check_and_snapshot(db)
                if args.action == "backup":
                    target = directory / BACKUP_NAME
                    safe_file(target)
                    require(not target.exists(), "immutable_backup_already_exists")
                    fd, tmp = tempfile.mkstemp(prefix=".memory-core-lab06-backup-", dir=directory)
                    os.close(fd)
                    try:
                        with sqlite3.connect(tmp) as dst:
                            db.backup(dst)
                        with sqlite3.connect(tmp) as chk:
                            chk.row_factory = sqlite3.Row
                            snap, copy_counts, copy_digest = check_and_snapshot(chk)
                            require(counts == copy_counts and digest == copy_digest,
                                    "backup_integrity_mismatch")
                        os.replace(tmp, target)
                    finally:
                        if os.path.exists(tmp):
                            os.unlink(tmp)
            if args.action == "snapshot":
                write_json({"result": "LAB06_SNAPSHOT", "data": data,
                            "counts": counts, "sha256": digest})
            elif args.action == "backup":
                write_json({"result": "LAB06_BACKUP_CREATED", "backup_file": str(target),
                            "counts": counts, "sha256": digest})
            else:
                write_json({"result": "LAB06_LOCAL_STATUS", "counts": counts,
                            "sha256": digest, "backend": "on_disk_local_sqlite_only"})
        else:
            require(not path.exists(), "restore_refuses_existing_database")
            require(args.backup_file and os.path.isabs(args.backup_file), "absolute_backup_file_required")
            source = Path(args.backup_file)
            require(source.is_file() and not source.is_symlink() and source.resolve() == source,
                    "invalid_restore_source")
            fd, tmp = tempfile.mkstemp(prefix=".memory-core-lab06-restore-", dir=directory)
            os.close(fd)
            try:
                with sqlite3.connect(str(source)) as src:
                    src.row_factory = sqlite3.Row
                    _, initial_counts, initial_digest = check_and_snapshot(src)
                    with sqlite3.connect(tmp) as dst:
                        src.backup(dst)
                with sqlite3.connect(tmp) as chk:
                    chk.row_factory = sqlite3.Row
                    _, restored_counts, restored_digest = check_and_snapshot(chk)
                require(initial_counts == restored_counts and initial_digest == restored_digest,
                        "restore_integrity_mismatch")
                require(not path.exists(), "restore_refuses_existing_database")
                os.replace(tmp, path)
            finally:
                if os.path.exists(tmp):
                    os.unlink(tmp)
            write_json({"result": "LAB06_RESTORED_NEW_STORE", "counts": restored_counts,
                        "sha256": restored_digest, "source": "verified_local_backup"})
if __name__ == "__main__":
    try:
        main()
    except (ValueError, sqlite3.Error, OSError, json.JSONDecodeError) as exc:
        # Do not echo input payloads or paths (which may include sensitive material).
        msg = str(exc)
        safe = msg if msg.isidentifier() or all(c.islower() or c.isdigit() or c in "_-" for c in msg) else "operation_rejected"
        print("LAB06_LOCAL_STORE_BLOCKED:" + safe, file=sys.stderr)
        sys.exit(1)
