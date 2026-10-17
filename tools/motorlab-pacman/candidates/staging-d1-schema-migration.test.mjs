import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {APPROVAL_CLAIMS_SCHEMA} from "../approval-single-use.mjs";
import {CHECKPOINT_SCHEMA} from "./staging-checkpoint-d1.mjs";
const migration=readFileSync(new URL("./staging-d1-schema-migration.sql",import.meta.url),"utf8");
function compact(s){return s.replace(/--[^\n]*/g,"").replace(/\s+/g," ").trim().replace(/;$/,"").trim()}
test("migration includes exact approval ledger definition",()=>{assert.ok(compact(migration).includes(compact(APPROVAL_CLAIMS_SCHEMA)))});
test("migration includes exact checkpoint definition",()=>{assert.ok(compact(migration).includes(compact(CHECKPOINT_SCHEMA)))});
test("migration contains only two idempotent table creations",()=>{const statements=compact(migration).split(";").map(x=>x.trim()).filter(Boolean);assert.equal(statements.length,2);for(const statement of statements)assert.match(statement,/^CREATE TABLE IF NOT EXISTS pacman_(approval_claims|cycle_checkpoints) \(/);});
