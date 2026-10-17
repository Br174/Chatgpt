// Pacman Execution V2: Cloudflare D1 atomic claim adapter (LAB, not deployed).
// Schema must be applied to an isolated staging D1 database before use.
// D1 INSERT OR IGNORE with UNIQUE operation_id is the single-writer arbiter.
export const D1_SCHEMA = `CREATE TABLE IF NOT EXISTS pacman_operations (
  operation_id TEXT PRIMARY KEY NOT NULL,
  receipt_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;
const safeId = /^[A-Za-z0-9][A-Za-z0-9._-]{7,119}$/;
export function createD1Ledger(db) {
  if (!db || typeof db.prepare !== "function") throw new Error("D1_BINDING_REQUIRED");
  return Object.freeze({
    durable: true, atomic: true,
    async claim(id, receipt) {
      if (!safeId.test(id)) throw new Error("INVALID_OPERATION_ID");
      const statement = db.prepare(
        "INSERT OR IGNORE INTO pacman_operations (operation_id, receipt_json) VALUES (?, ?)"
      );
      const result = await statement.bind(id, JSON.stringify(receipt)).run();
      // Do not accept ambiguous success; exactly one inserted row is required.
      if (result?.success !== true || result?.meta?.changes !== 1) return false;
      return true;
    },
    async get(id) {
      if (!safeId.test(id)) throw new Error("INVALID_OPERATION_ID");
      const row = await db.prepare(
        "SELECT receipt_json FROM pacman_operations WHERE operation_id = ?"
      ).bind(id).first();
      return row ? JSON.parse(row.receipt_json) : null;
    },
    async put(id, receipt) {
      if (!safeId.test(id)) throw new Error("INVALID_OPERATION_ID");
      const result = await db.prepare(
        "UPDATE pacman_operations SET receipt_json = ?, updated_at = CURRENT_TIMESTAMP WHERE operation_id = ?"
      ).bind(JSON.stringify(receipt), id).run();
      if (result?.success !== true || result?.meta?.changes !== 1)
        throw new Error("LEDGER_UPDATE_UNVERIFIED");
    }
  });
}
