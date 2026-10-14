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

test("dedicated Pacman staging D1 differs from operational and Memory CORE",async()=>{
  const pacman=JSON.parse(await readFile(new URL("./wrangler.pacman-staging.jsonc",import.meta.url),"utf8"));
  const operational=JSON.parse(await readFile(new URL("../../cloudflare/motorlab-state-bridge/wrangler.jsonc",import.meta.url),"utf8"));
  const pacmanId=pacman.d1_databases?.[0]?.database_id;
  assert.equal(pacman.d1_databases?.[0]?.database_name,"motorlab-pacman-staging");
  assert.equal(pacmanId,"eb834fc1-5589-4f75-bcb9-d311d0d72261");
  assert.notEqual(pacmanId,"fd3ff45b-694a-45ec-8d5c-5653fdba092e");
  assert.equal(compareD1Isolation(operational,pacman).safe,true);
  assert.equal(compareD1Isolation(operational,pacman).mutationAllowed,false);
});
