import test from "node:test";
import assert from "node:assert/strict";
import {capabilityStatus, runGithubLabFileCycle, PacmanDenied} from "./execution-v2.mjs";
const branch = "motorlab/pacman-execution-v2-lab-20261014";
const path = "tools/motorlab-pacman/probe.txt";
const content = "synthetic probe";
function setup() {
  const store = new Map();
  const ledger = {get: async id => store.get(id), put: async (id, value) => {store.set(id, value);}};
  const checkpoints = [];
  let current = null;
  const adapter = {
    read: async () => current === null ? {exists:false} : {exists:true,content:current,sha:"blob-sha"},
    create: async ({content:value}) => {current = value;},
    remove: async ({sha}) => {assert.equal(sha,"blob-sha");current=null;}
  };
  return {ledger, adapter, checkpoints, onCheckpoint: async x => {checkpoints.push(x);}};
}
test("unconnected providers remain unavailable", () => {
  assert.equal(capabilityStatus("github.lab-file-cycle").available,false);
  assert.equal(capabilityStatus("cloudflare.staging-config").available,false);
  assert.equal(capabilityStatus("other.provider").blocker,"UNKNOWN_CAPABILITY");
});
test("denies without approval and without ledger", async () => {
  const s=setup();
  await assert.rejects(runGithubLabFileCycle({operationId:"pacman-probe-001",branch,path,content,
    adapter:s.adapter,ledger:s.ledger,onCheckpoint:s.onCheckpoint}), {code:"OWNER_APPROVAL_REQUIRED"});
  await assert.rejects(runGithubLabFileCycle({operationId:"pacman-probe-002",branch,path,content,
    adapter:s.adapter,approval:true,onCheckpoint:s.onCheckpoint}), {code:"DURABLE_LEDGER_REQUIRED"});
});
test("isolated create/read/delete verifies cleanup and rejects replay", async () => {
  const s=setup();
  const args={operationId:"pacman-probe-003",branch,path,content,adapter:s.adapter,
    ledger:s.ledger,onCheckpoint:s.onCheckpoint,approval:true};
  const receipt=await runGithubLabFileCycle(args);
  assert.equal(receipt.state,"VERIFIED_AND_REMOVED");
  assert.equal((await s.adapter.read()).exists,false);
  await assert.rejects(runGithubLabFileCycle(args), {code:"OPERATION_ALREADY_RECORDED"});
});
test("readback mismatch enters recovery, never reports success", async () => {
  const s=setup();
  s.adapter.read=async () => ({exists:false});
  await assert.rejects(runGithubLabFileCycle({operationId:"pacman-probe-004",branch,path,content,
    adapter:s.adapter,ledger:s.ledger,onCheckpoint:s.onCheckpoint,approval:true}),
    {code:"READBACK_MISMATCH"});
  assert.equal((await s.ledger.get("pacman-probe-004")).state,"RECOVERY_REQUIRED");
});
test("rejects unsafe branch and path", async () => {
  const s=setup();
  await assert.rejects(runGithubLabFileCycle({operationId:"pacman-probe-005",branch:"main",path,
    content,adapter:s.adapter,ledger:s.ledger,onCheckpoint:s.onCheckpoint,approval:true}),
    {code:"LAB_BRANCH_REQUIRED"});
  await assert.rejects(runGithubLabFileCycle({operationId:"pacman-probe-006",branch,
    path:"tools/motorlab-pacman/../other",content,adapter:s.adapter,ledger:s.ledger,
    onCheckpoint:s.onCheckpoint,approval:true}), {code:"LAB_PATH_REQUIRED"});
});
