#!/usr/bin/env python3
"""LAB06 adversarial, independent-process LOCAL canary; no Cloudflare secrets/network."""
import concurrent.futures
import copy
import json
import os
import runpy
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / "tools/memory-core-lab06/persistent-store.py"
NODE = ROOT / "tools/memory-core-lab06/local-memory.mjs"
lab05 = runpy.run_path(str(ROOT / "tools/memory-core-lab05/concurrency-backup-canary.py"))
fixture = lab05["synth_bundle"]

class MemoryLAB06(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="motorlab-memory-lab06-")
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        self.data = self.home / "first"
        self.data.mkdir()
        self.bundle = self.home / "synthetic.json"
        self.bundle.write_text(json.dumps(fixture()), encoding="utf-8")
        os.chmod(self.bundle, 0o600)

    def call(self, action, data=None, options=(), ok=True):
        proc = subprocess.run(
            [sys.executable, str(CLI), action, "--data-dir", str(data or self.data), *options],
            capture_output=True, text=True, timeout=60)
        if ok:
            self.assertEqual(proc.returncode, 0, proc.stderr)
            return json.loads(proc.stdout)
        self.assertNotEqual(proc.returncode, 0, proc.stdout)
        self.assertIn("LAB06_LOCAL_STORE_BLOCKED:", proc.stderr)
        return proc.stderr

    def boot(self):
        return self.call("init")

    def ingest(self, data=None, bundle=None):
        return self.call("ingest", data=data, options=("--bundle", str(bundle or self.bundle)))

    def test_empty_init_does_not_change_legacy_ledgers(self):
        result = self.boot()
        self.assertEqual(result["counts"]["memory_records"], 0)
        self.assertEqual(result["counts"]["operation_events"], 0)
        self.assertEqual(result["counts"]["velocity_lessons"], 0)
        self.assertEqual(self.call("status")["sha256"], result["sha256"])

    def test_multiple_processes_persist_recall_and_idempotence(self):
        self.boot()
        initial = self.ingest()
        self.assertEqual(initial["ingestion"]["written"], 9)
        self.assertEqual(self.ingest()["ingestion"]["already_present"], 9)
        self.assertEqual(self.call("status")["sha256"], initial["sha256"])
        proc = subprocess.run(
            ["node", str(NODE), "recall", "--data-dir", str(self.data), "--query", "GitHub"],
            capture_output=True, text=True, timeout=30)
        self.assertEqual(proc.returncode, 0, proc.stderr)
        found = json.loads(proc.stdout)
        self.assertEqual(found["result"], "LAB06_RECOVERED_FROM_DISK")
        self.assertTrue(found["found"])
        self.assertEqual(found["hot_capsule_entries"], 9)
        self.assertEqual(found["master_book_pages"], 9)
        self.assertEqual(found["records"], 9)
        self.assertEqual(found["cloudflare_remote_writes"], 0)

    def test_independent_concurrent_processes_single_writer(self):
        self.boot()
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            results = list(pool.map(lambda _: self.ingest(), range(8)))
        self.assertEqual(sum(r["ingestion"]["written"] for r in results), 9)
        self.assertEqual(self.call("status")["counts"]["memory_records"], 9)
        self.assertEqual(self.call("status")["counts"]["memory_source_links"], 9)

    def test_backup_readback_and_restore_to_new_store_only(self):
        self.boot()
        original = self.ingest()
        saved = self.call("backup")
        backup = saved["backup_file"]
        self.assertEqual(saved["sha256"], original["sha256"])
        self.call("backup", ok=False)  # immutable LAST_GOOD: no silent overwrite
        self.call("restore", options=("--backup-file", backup), ok=False) # current DB protected
        target = self.home / "recovery"
        restored = self.call("restore", data=target, options=("--backup-file", backup))
        self.assertEqual(restored["sha256"], original["sha256"])
        self.assertEqual(self.call("status", data=target)["sha256"], original["sha256"])
        self.assertEqual(self.ingest(data=target)["ingestion"]["written"], 0)

    def test_immutable_conflict_rejected_without_partial_mutation(self):
        self.boot()
        self.ingest()
        initial = self.call("status")["sha256"]
        bad = fixture()
        bad["records"][0]["content"] = "malicious-overwrite"
        path = self.home / "tampered.json"
        path.write_text(json.dumps(bad), encoding="utf-8")
        self.call("ingest", options=("--bundle", str(path)), ok=False)
        self.assertEqual(self.call("status")["sha256"], initial)

    def test_reject_untrusted_lineage_without_changes(self):
        self.boot()
        self.ingest()
        before = self.call("status")["sha256"]
        bad = fixture()
        bad["lineage"].append({"memory_id": bad["records"][0]["memory_id"],
           "source_kind":"OPERATION_EVENT","source_id":"not-existent",
           "source_ref":"lab06-synthetic-only"})
        path = self.home / "bad-lineage.json"
        path.write_text(json.dumps(bad), encoding="utf-8")
        self.call("ingest", options=("--bundle", str(path)), ok=False)
        self.assertEqual(self.call("status")["sha256"], before)

    def test_production_and_symlinks_forbidden(self):
        self.call("status", ok=False)
        outside = self.home / "redirect"
        outside.symlink_to(self.data)
        self.call("init", data=outside, ok=False)
        self.call("init", data=ROOT, ok=False)

    def test_invalid_or_corrupted_backup_rejected(self):
        destination = self.home / "destination"
        damaged = self.home / "invalid-backup.sqlite3"
        damaged.write_text("not a database", encoding="utf-8")
        self.call("restore", data=destination,
                  options=("--backup-file", str(damaged)), ok=False)
        self.assertFalse((destination / "memory-core-lab06.sqlite3").exists())

    def test_failure_before_commit_and_recover(self):
        self.boot()
        db = self.data / "memory-core-lab06.sqlite3"
        env = {**os.environ, "MOTORLAB_LAB03_FAILPOINT":"CRASH_AFTER_FIRST_RECORD"}
        bad = subprocess.run([sys.executable, str(ROOT / "tools/motorlab-memory-lab03-db.py"),
            "ingest","--database",str(db),"--bundle",str(self.bundle)],
            env=env, capture_output=True, timeout=30)
        self.assertEqual(bad.returncode, 75)
        self.assertEqual(self.call("status")["counts"]["memory_records"], 0)
        self.assertEqual(self.ingest()["ingestion"]["written"], 9)

if __name__ == "__main__":
    unittest.main(verbosity=2)
