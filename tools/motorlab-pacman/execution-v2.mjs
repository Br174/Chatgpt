import {claimOperation} from "./atomic-claim.mjs";
// Pacman Execution V2 — fail-closed capability registry and verified operation runner.
// LAB-only module. The host supplies authenticated adapters; this module never handles credentials.
export const CAPABILITIES = Object.freeze({
  "github.lab-file-cycle": Object.freeze({
    provider: "github", mode: "reversible-write", scope: "isolated-lab",
    requires: ["ownerApproval", "branchIsolation", "readback", "cleanup"]
  }),
  "github.main-ruleset": Object.freeze({
    provider: "github", mode: "admin-write", scope: "main",
    requires: ["separateSecurityApproval", "administrationWrite", "readback"]
  }),
  "cloudflare.staging-config": Object.freeze({
    provider: "cloudflare", mode: "staging-write", scope: "staging",
    requires: ["separateStaging", "verifiedNoCost", "ownerApproval", "readback"]
  })
});
export class PacmanDenied extends Error {
  constructor(code) { super(code); this.name = "PacmanDenied"; this.code = code; }
}
const allowedId = /^[a-zA-Z0-9][a-zA-Z0-9._-]{7,119}$/;
const EXECUTION_LAB_BRANCH = "motorlab/pacman-execution-v2-lab-20261014";
const EXECUTION_PROBE_PATH = "tools/motorlab-pacman/probe.txt";
export function capabilityStatus(name, context = {}) {
  const capability = CAPABILITIES[name];
  if (!capability) return {name, available: false, blocker: "UNKNOWN_CAPABILITY"};
  const missing = capability.requires.filter(key => context[key] !== true);
  if (context.adapterConnected !== true) missing.unshift("adapterConnected");
  return {name, provider: capability.provider, scope: capability.scope,
    available: missing.length === 0, missing, blocker: missing[0] || null};
}
function check(value, code) { if (!value) throw new PacmanDenied(code); }
function safeReceipt(operationId, state, extra = {}) {
  return {schema: 1, operationId, state, ...extra};
}
// Idempotency is enforced by a host-owned durable ledger. Without one, refuse mutation.
// The adapter MUST implement create/read/remove with its own authenticated GitHub transport.
// No token, file content, or exception stack is persisted in the returned receipt.
export async function runGithubLabFileCycle({operationId, branch, path, content, adapter,
  approval = false, ledger, onCheckpoint} = {}) {
  check(typeof operationId === "string" && allowedId.test(operationId), "INVALID_OPERATION_ID");
  check(branch === EXECUTION_LAB_BRANCH, "LAB_BRANCH_REQUIRED");
  check(path === EXECUTION_PROBE_PATH || path === "tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt",
    "LAB_PATH_REQUIRED");
  check(typeof content === "string" && content.length > 0 && content.length <= 4096,
    "INVALID_PROBE_CONTENT");
  check(approval === true, "OWNER_APPROVAL_REQUIRED");
  check(adapter && ["read","create","remove"].every(key => typeof adapter[key] === "function"),
    "ADAPTER_MISSING");
  check(ledger && typeof ledger.put === "function", "DURABLE_LEDGER_REQUIRED");
  check(typeof onCheckpoint === "function", "CHECKPOINT_WRITER_REQUIRED");
  await claimOperation(ledger, operationId, safeReceipt(operationId, "CLAIMED", {branch, path}));
  let initial;
  try { initial = await adapter.read({branch, path}); }
  catch { await ledger.put(operationId, safeReceipt(operationId, "PREFLIGHT_FAILED", {branch, path}));
    throw new PacmanDenied("PREFLIGHT_FAILED"); }
  if (initial?.exists !== false) {
    await ledger.put(operationId, safeReceipt(operationId, "PREFLIGHT_FAILED", {branch, path}));
    throw new PacmanDenied("TARGET_NOT_EMPTY_OR_UNVERIFIED");
  }
  await ledger.put(operationId, safeReceipt(operationId, "PREPARED", {branch, path}));
  try { await onCheckpoint(safeReceipt(operationId, "PREPARED", {branch, path})); }
  catch { throw new PacmanDenied("CHECKPOINT_PREPARE_FAILED"); }
  let mutationAttempted = false;
  let cleanupVerified = false;
  try {
    mutationAttempted = true;
    await adapter.create({branch, path, content});
    await ledger.put(operationId, safeReceipt(operationId, "WRITE_ATTEMPTED", {branch, path}));
    const after = await adapter.read({branch, path});
    check(after?.exists === true && after.content === content &&
      typeof after.sha === "string" && after.sha.length > 0, "READBACK_MISMATCH");
    await onCheckpoint(safeReceipt(operationId, "READBACK_VERIFIED", {branch, path}));
    await adapter.remove({branch, path, sha: after.sha});
    const finalRead = await adapter.read({branch, path});
    check(finalRead?.exists === false, "CLEANUP_UNVERIFIED");
    cleanupVerified = true;
    const receipt = safeReceipt(operationId, "VERIFIED_AND_REMOVED", {branch, path});
    await ledger.put(operationId, receipt);
    // A failed notification must never downgrade a verified cleanup to recovery.
    try { await onCheckpoint(receipt); } catch { /* durable receipt is authoritative */ }
    return receipt;
  } catch (error) {
    // Never retry ambiguous writes. Record recovery-needed state, not a false success.
    const receipt = safeReceipt(operationId,
      mutationAttempted && !cleanupVerified ? "RECOVERY_REQUIRED" : "FAILED",
      {branch, path, blocker: error instanceof PacmanDenied ? error.code : "PROVIDER_ERROR"});
    await ledger.put(operationId, receipt);
    await onCheckpoint(receipt);
    throw new PacmanDenied(receipt.blocker);
  }
}
