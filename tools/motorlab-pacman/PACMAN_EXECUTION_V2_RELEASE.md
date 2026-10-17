# Pac-Man Execution V2 — MotorLab function integration

Pac-Man is the existing MotorLab AutoSetup function, subordinate to MotorLab's
single coordinator. This change integrates its verified Execution V2 source into
MotorLab's stable repository. It creates no separate application, product,
orchestrator, Android package or independent MADRE.

## Candidate provenance

- CANDIDATA 01 source baseline: MotorLab `main` at
  `88d6940c71d519b00f444fa50970f6e35ba4bd8c`.
- Verified LAB source: `2818f80ec9c75ce376a83b50d91744f70c73c5f8`.
- Copy the 266 LAB additions by exact Git blob identity; preserve every existing
  main file, including newer R38 continuity work, the r37 release pin, and the
  existing Pac-Man CORE policy tests.
- Integration-only additions: this evidence record, main/PR regression CI, and
  a scoped entry in the existing service integration status registry.
- Freeze the candidate ref after successful local verification and review.
  Promotion uses that same immutable source through a normal GitHub PR.

## Verified operational scope

- Owner Android passkey -> WebAuthn staging -> private Service Binding ->
  Execution staging -> GitHub create/read/delete/read -> D1 final receipt.
- Capability: `github.lab-file-cycle` on
  `motorlab/pacman-execution-v2-lab-20261014`, limited to
  `tools/motorlab-pacman/probe-webauthn-cycle-20261017.txt`.
- Completed operation: `pacman-webauthn-lab-20261017-ff59959a-01`.
- Create commit: `ed5a4cc61063f73349ddd6f7935bc626d9160149`.
- Cleanup commit: `bf2bea705188d2c01be462e514c8c385c8342a72`.
- Independent protected final audit:
  https://github.com/Br174/Chatgpt/actions/runs/39062615761
- Final D1 state: `VERIFIED_AND_REMOVED`; single-use claim present;
  challenges `4`, consumed `4`; exact schema and readiness verified.
- The completed operation is audit evidence, never a fresh execution link.

## Compatibility and release boundaries

Existing MotorLab bootstrap/reentry owns routing. Existing Pac-Man Workers,
approval gate, D1 claim/checkpoint stores and the single LAB rollout retain their
responsibilities. The new main/PR CI only tests source and the local Workers
runtime; it has read-only GitHub permissions and no provider secrets or deploy.
LAB deployment/migration/bootstrap workflow branch restrictions remain intact.

Merging source does not deploy a production Worker, broaden the capability,
change a D1 schema, repeat enrollment or consume another approval. Generic
provider administration and a connected ChatGPT MCP app remain unverified;
PR #49 is historical implementation lineage, not proof of those capabilities.
The active MotorLab release remains r37; this is no R38 release/fanout activation.

## Verification and recovery

Re-run the complete Pac-Man suite with preserved main policy tests, the actual
Workers runtime smoke, and all applicable main PR gates on the candidate result.
Local candidate verification: 765/765 Pac-Man and preserved main policy tests;
40/40 applicable CORE/r37/r38 checks; actual workerd runtime smoke passed with
`PACMAN_WORKERS_RUNTIME_POST_CYCLE_REDIRECT_AND_INERT_DIAGNOSTIC_VERIFIED`.
Preserve the completed LAB ref and pre-integration main SHA as immutable recovery
sources. Any later revert goes through review; provider state and consumed claims
must not be rolled back or replayed as part of a source-only recovery.

A broad pre-integration scan of all historical root test files on unchanged main
ran 160 tests: 156 passed, 4 failed. Three failures are the old r35-only tests
requiring an r35 pin/capsule on the current r37 main; their workflow is scoped to
r35 branches. One is a pre-existing Project Feedback Worker shape assertion,
whose provider files are unchanged by this integration. These results are
recorded rather than hidden or weakened. The current applicable PR gates and
Pac-Man integration checks must pass independently before promotion.
