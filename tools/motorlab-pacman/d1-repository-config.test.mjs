import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {compareD1Isolation} from "./d1-isolation-audit.mjs";
import {assessStagingReadiness} from "./staging-readiness.mjs";

test("repository operational D1 cannot be used as Pacman staging",async()=>{
  const config=JSON.parse(await readFile(new URL("../../cloudflare/motorlab-state-bridge/wrangler.jsonc",import.meta.url),"utf8"));
  assert.ok(config.d1_databases?.length>0,"operational D1 config must be present");
  const audit=compareD1Isolation(config,config);
  assert.equal(audit.safe,false);
  assert.equal(audit.reason,"PRODUCTION_D1_COLLISION");
  assert.equal(audit.mutationAllowed,false);
});
test("without independently verified staging evidence remote writes remain blocked",()=>{
  const readiness=assessStagingReadiness();
  assert.equal(readiness.ready,false);
  assert.equal(readiness.mutationAllowed,false);
  assert.ok(readiness.missing.includes("isolatedDatabase"));
});
