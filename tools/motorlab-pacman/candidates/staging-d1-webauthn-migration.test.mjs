import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("./staging-d1-webauthn-migration.sql",import.meta.url),"utf8");

test("WebAuthn D1 migration is additive and targets only two namespaced tables",()=>{
 const normalized=sql.replace(/--.*$/gm,"").trim();
 const creates=[...normalized.matchAll(/CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+([a-z0-9_]+)/gi)].map(x=>x[1]);
 assert.deepEqual(creates,["pacman_webauthn_credentials","pacman_webauthn_challenges"]);
 assert.doesNotMatch(normalized,/\b(?:DROP|ALTER|DELETE|UPDATE|INSERT|REPLACE|TRUNCATE)\b/i);
 assert.doesNotMatch(normalized,/\bpacman_operations\b/i);
 assert.doesNotMatch(normalized,/\bpacman_approval_claims\b/i);
 assert.doesNotMatch(normalized,/\bpacman_cycle_checkpoints\b/i);
 const statements=normalized.split(";").map(x=>x.trim()).filter(Boolean);
 assert.equal(statements.length,2);
 assert.ok(statements.every(x=>/^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+/i.test(x)));
});

test("credential table enforces one owner and one bootstrap binding",()=>{
 assert.match(sql,/owner_subject\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
 assert.match(sql,/bootstrap_nonce\s+TEXT\s+NOT\s+NULL\s+UNIQUE/i);
 assert.match(sql,/bootstrap_comment_id\s+INTEGER\s+NOT\s+NULL\s+UNIQUE/i);
 assert.match(sql,/credential_id\s+TEXT\s+PRIMARY\s+KEY\s+NOT\s+NULL/i);
});

test("challenge table has durable single-use fields",()=>{
 assert.match(sql,/challenge\s+TEXT\s+PRIMARY\s+KEY\s+NOT\s+NULL/i);
 assert.match(sql,/expires_at\s+INTEGER\s+NOT\s+NULL/i);
 assert.match(sql,/consumed_at\s+INTEGER/i);
});
