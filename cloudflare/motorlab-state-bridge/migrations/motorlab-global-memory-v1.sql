-- LAB PROPOSAL ONLY: additive Cloudflare D1 memory + team data. NOT DEPLOYED.
-- GitHub is technical authority; D1 is operational/index metadata; Vectorize is rebuildable.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS knowledge_items(
 id TEXT PRIMARY KEY,
 project_id TEXT NOT NULL REFERENCES projects(project_id),
 category TEXT NOT NULL CHECK(category IN ('FACT','PROBLEM','CAUSE','FIX','TEST','ARTIFACT','LESSON','DECISION')),
 summary TEXT NOT NULL CHECK(length(summary) BETWEEN 1 AND 4000),
 source_repo TEXT NOT NULL,source_ref TEXT NOT NULL,source_sha TEXT NOT NULL,
 content_hash TEXT NOT NULL,
 verification TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(verification IN ('UNVERIFIED','VERIFIED','DISPUTED','REVOKED')),
 privacy TEXT NOT NULL DEFAULT 'TECHNICAL' CHECK(privacy IN ('TECHNICAL','PRIVATE','RESTRICTED')),
 observed_at TEXT NOT NULL,valid_from TEXT NOT NULL,valid_to TEXT,
 created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 CHECK(valid_to IS NULL OR valid_to>=valid_from),
 UNIQUE(project_id,source_sha,content_hash,category)
);
CREATE INDEX IF NOT EXISTS idx_kitems_project_time ON knowledge_items(project_id,valid_from DESC);
CREATE INDEX IF NOT EXISTS idx_kitems_source ON knowledge_items(source_repo,source_sha);
CREATE TABLE IF NOT EXISTS knowledge_links(
 id TEXT PRIMARY KEY,
 from_id TEXT NOT NULL REFERENCES knowledge_items(id),
 to_id TEXT NOT NULL REFERENCES knowledge_items(id),
 relation TEXT NOT NULL CHECK(relation IN ('CAUSED_BY','FIXED_BY','TESTED_BY','SUPERSEDES','CONTRADICTS','SIMILAR_TO','APPLICABLE_TO','REFERENCES')),
 verification TEXT NOT NULL DEFAULT 'PROPOSED' CHECK(verification IN ('PROPOSED','VERIFIED','REJECTED','REVOKED')),
 evidence_ref TEXT,created_at TEXT NOT NULL,reviewed_at TEXT,
 CHECK(from_id<>to_id),UNIQUE(from_id,to_id,relation)
);
CREATE INDEX IF NOT EXISTS idx_klinks_from ON knowledge_links(from_id,relation,verification);
CREATE INDEX IF NOT EXISTS idx_klinks_to ON knowledge_links(to_id,relation,verification);
CREATE TABLE IF NOT EXISTS knowledge_timeline(
 id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES knowledge_items(id),
 event_type TEXT NOT NULL CHECK(event_type IN ('CREATED','VERIFIED','DISPUTED','REVOKED','SUPERSEDED','REVIEWED')),
 actor TEXT NOT NULL,reason TEXT NOT NULL,evidence_ref TEXT,created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_ktimeline ON knowledge_timeline(item_id,created_at DESC);
CREATE TABLE IF NOT EXISTS technical_lessons(
 id TEXT PRIMARY KEY,
 item_id TEXT NOT NULL UNIQUE REFERENCES knowledge_items(id),
 defect_id TEXT REFERENCES knowledge_items(id),
 prevention_test_ref TEXT,
 state TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(state IN ('UNVERIFIED','VERIFIED','REVOKED')),
 reviewed_at TEXT
);
CREATE TABLE IF NOT EXISTS memory_vector_refs(
 item_id TEXT PRIMARY KEY REFERENCES knowledge_items(id),
 vector_key TEXT NOT NULL UNIQUE,
 embedding_model TEXT NOT NULL,source_hash TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('PENDING','INDEXED','STALE','DELETED')),
 updated_at TEXT NOT NULL
);
-- Tables are source-only; endpoints, authentication, ACL enforcement are NOT yet enabled.
CREATE TABLE IF NOT EXISTS team_rooms(
 id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(project_id),
 name TEXT NOT NULL,created_at TEXT NOT NULL,archived_at TEXT
);
CREATE TABLE IF NOT EXISTS team_members(
 room_id TEXT NOT NULL REFERENCES team_rooms(id),
 principal_id TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('OWNER','EDITOR','READER','AGENT')),
 joined_at TEXT NOT NULL,revoked_at TEXT,
 PRIMARY KEY(room_id,principal_id)
);
CREATE TABLE IF NOT EXISTS team_messages(
 id TEXT PRIMARY KEY,room_id TEXT NOT NULL REFERENCES team_rooms(id),
 operation_id TEXT REFERENCES operations(operation_id),
 run_id TEXT NOT NULL,author_id TEXT NOT NULL,target_id TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('USER','AGENT','HANDOFF','EVIDENCE','SYSTEM')),
 body TEXT NOT NULL CHECK(length(body) BETWEEN 1 AND 10000),
 source TEXT NOT NULL,source_ref TEXT,
 parent_id TEXT REFERENCES team_messages(id),
 verification TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK(verification IN ('UNVERIFIED','VERIFIED','REVOKED')),
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_team_timeline ON team_messages(room_id,created_at,id);
CREATE INDEX IF NOT EXISTS idx_team_run ON team_messages(run_id,created_at);
CREATE TABLE IF NOT EXISTS team_receipts(
 id TEXT PRIMARY KEY,message_id TEXT NOT NULL REFERENCES team_messages(id),
 recipient_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('QUEUED','DELIVERED','ACKNOWLEDGED','FAILED')),
 updated_at TEXT NOT NULL,UNIQUE(message_id,recipient_id)
);
