// Pacman LAB concurrency gate. The host MUST provide a durable, atomic ledger.
// An in-memory Map, ordinary get/put pair or unverified lock is not sufficient.
export class ClaimDenied extends Error {
  constructor(code) { super(code); this.code = code; }
}
export async function claimOperation(ledger, operationId, receipt) {
  if (!ledger || typeof ledger.claim !== "function" ||
      ledger.durable !== true || ledger.atomic !== true)
    throw new ClaimDenied("ATOMIC_DURABLE_LEDGER_REQUIRED");
  if (typeof operationId !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{7,119}$/.test(operationId))
    throw new ClaimDenied("INVALID_OPERATION_ID");
  let result;
  try { result = await ledger.claim(operationId, receipt); }
  catch { throw new ClaimDenied("CLAIM_UNVERIFIED"); }
  if (result !== true) throw new ClaimDenied("DUPLICATE_OR_UNVERIFIED_CLAIM");
  return {operationId, state:"CLAIMED"};
}
