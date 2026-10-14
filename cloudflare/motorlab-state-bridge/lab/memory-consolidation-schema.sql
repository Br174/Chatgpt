-- MotorLab Memory Consolidation LAB01: local-only additive schema candidate
-- NOT deployed. Existing production tables untouched.
CREATE TABLE IF NOT EXISTS memory_items_lab (
 id TEXT PRIMARY KEY, project_id TEXT NOT NULL, kind TEXT NOT NULL,
 canonical_path TEXT NOT NULL, summary TEXT NOT NULL, evidence_ref TEXT NOT NULL,
 source_authority TEXT NOT NULL, importance REAL NOT NULL DEFAULT 0.5,
 valid_from TEXT, valid_to TEXT, status TEXT NOT NULL DEFAULT 'ACTIVE',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memory_categories_lab (
 id TEXT PRIMARY KEY, parent_id TEXT REFERENCES memory_categories_lab(id),
 label TEXT NOT NULL, aliases_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS memory_item_categories_lab (
 item_id TEXT NOT NULL REFERENCES memory_items_lab(id),
 category_id TEXT NOT NULL REFERENCES memory_categories_lab(id),
 PRIMARY KEY(item_id,category_id)
);
CREATE TABLE IF NOT EXISTS memory_relations_lab (
 from_id TEXT NOT NULL REFERENCES memory_items_lab(id),
 relation_type TEXT NOT NULL,
 to_id TEXT NOT NULL REFERENCES memory_items_lab(id),
 evidence_ref TEXT NOT NULL,
 PRIMARY KEY(from_id,relation_type,to_id)
);
CREATE TABLE IF NOT EXISTS memory_usage_lab (
 item_id TEXT PRIMARY KEY REFERENCES memory_items_lab(id),
 retrieval_count INTEGER NOT NULL DEFAULT 0,
 last_verified_access TEXT
);
CREATE INDEX IF NOT EXISTS memory_items_lab_project_status ON memory_items_lab(project_id,status);
CREATE INDEX IF NOT EXISTS memory_relations_lab_target ON memory_relations_lab(to_id,relation_type);
