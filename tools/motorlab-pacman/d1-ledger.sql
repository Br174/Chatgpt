-- Apply ONLY to an isolated, authorized Cloudflare D1 staging database.
-- Never run against production without separate approval.
CREATE TABLE IF NOT EXISTS pacman_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  receipt_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
