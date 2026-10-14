# Pacman V2 concurrency review

Status: BLOCKED FOR AUTOMATED WRITES.

The current execution-v2.mjs ledger.get followed by ledger.put is not an atomic reservation. Concurrent calls with the same operationId could both pass preflight and attempt a write.

Required fix before backend integration:
1. Host ledger implements an atomic durable claim(operationId, receipt), returning true only for the first claimant.
2. Runner refuses writes if claim is absent or returns false.
3. Claim occurs before provider preflight or mutation; persist preflight failure.
4. Add parallel invocation test: Promise.allSettled on same operationId must produce exactly one successful claim and at most one provider create.
5. Validate claim persistence across independent process/Worker instances using staging durable storage; in-memory Map is insufficient.
6. On ambiguous provider outcome, require readback and controlled recovery, never blind retry.

Do not mark execution-v2.mjs production ready until these tests pass. GitHub reversible live probe was separately verified and remains valid.
