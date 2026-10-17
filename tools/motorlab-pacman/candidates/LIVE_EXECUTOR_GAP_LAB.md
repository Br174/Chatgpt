# Pac-Man LAB — critical runtime/candidate gap

## Verified source-level discrepancy
The deployed-staging candidate entry point `worker-execution-staging.mjs` calls `writeApprovedLabProbe` from `github-lab-write.mjs` for `mode=github-lab-write`. That live-path helper is **not** `candidates/verified-lab-cycle.mjs`.

The runtime helper:
1. Consumes an approval in D1.
2. GETs an **existing** GitHub probe file and requires HTTP 200 and a SHA.
3. PUTs new content to that existing file using its SHA.
4. Returns `LAB_PROBE_WRITTEN` after a successful write.

The 28-test candidate suite exercises a **different** behavior: requires target **absent** before create, verifies readback, deletes the probe, verifies absence, and checkpoints the lifecycle.

## Consequences
- Green candidate cycle tests **do not validate** the staging runtime GitHub write path.
- Runtime's existing-file overwrite is not equivalent to a reversible create/delete cycle.
- Runtime does not currently provide the candidate's cleanup/readback and checkpoint recovery guarantees.
- Never enable `PACMAN_GITHUB_LAB_WRITE_ENABLED` based on candidate suite success.

## Remediation before any live operation
1. Decide and document a single canonical LAB probe contract (absent-target create/delete vs existing-file update with reversible restore).
2. Audit and explicitly integrate the chosen lifecycle into staging runtime, including durable checkpoints and recovery.
3. Add end-to-end tests invoking the actual staging handler with mocked GitHub and D1.
4. Verify authenticated trusted issuer, staging D1 and scoped GitHub token before enabling flags.
5. Ensure deployment workflow cannot auto-enable the changed runtime before approvals.

## Verdict
**BLOCKER / NO-GO.** This is a source-level gap, not a confirmed production incident. No runtime files or deployment configuration were modified during this audit.
