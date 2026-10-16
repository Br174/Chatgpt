-- Pac-Man WebAuthn/passkey LAB staging ONLY.
-- Exact target D1: motorlab-pacman-staging
-- Exact D1 ID: eb834fc1-5589-4f75-bcb9-d311d0d72261
-- Additive only. Do not alter/drop/write existing Pac-Man tables.

CREATE TABLE IF NOT EXISTS pacman_webauthn_credentials (
 credential_id TEXT PRIMARY KEY NOT NULL,
 public_key_jwk TEXT NOT NULL,
 sign_count INTEGER NOT NULL DEFAULT 0,
 owner_subject TEXT NOT NULL UNIQUE,
 bootstrap_nonce TEXT NOT NULL UNIQUE,
 bootstrap_comment_id INTEGER NOT NULL UNIQUE,
 registration_sha256 TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 disabled_at INTEGER
);

CREATE TABLE IF NOT EXISTS pacman_webauthn_challenges (
 challenge TEXT PRIMARY KEY NOT NULL,
 operation_id TEXT NOT NULL,
 capability TEXT NOT NULL,
 branch TEXT NOT NULL,
 path TEXT NOT NULL,
 content_sha256 TEXT NOT NULL,
 rp_id TEXT NOT NULL,
 origin TEXT NOT NULL,
 issued_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 consumed_at INTEGER
);
