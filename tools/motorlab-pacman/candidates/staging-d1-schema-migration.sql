-- Pac-Man LAB staging ONLY. NOT automatically executed by GitHub Actions.
-- Target: motorlab-pacman-staging (D1 ID eb834fc1-5589-4f75-bcb9-d311d0d72261)
-- Review the live schema and backups before manually applying. Never run on production.
CREATE TABLE IF NOT EXISTS pacman_approval_claims (
 operation_id TEXT PRIMARY KEY NOT NULL,
 approval_signature TEXT NOT NULL,
 claimed_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pacman_cycle_checkpoints (
 operation_id TEXT PRIMARY KEY,
 state TEXT NOT NULL,
 branch TEXT NOT NULL,
 path TEXT NOT NULL,
 sha TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
