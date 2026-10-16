# MotorLab CORE — Cross-project progress contract (LAB candidate)
2026-10-16. Applies to MotorLab, MusicLab, StudyBook AI, MotorAI and future projects once integrated and approved in their respective LAB environments.

## Single shared rule
Use exactly THREE visible percentages: project total, current phase, current activity.
Compute with one weighted, hierarchical, bidirectional engine; children propagate immediately to parents, including small increments and verified regressions.
A child reaching 100% raises its parent proportionally; it cannot force the parent to 100% if other mandatory work remains.
Count verified implementation, integration and test slices according to predefined weights; CI passing alone does not certify production functionality.
When completed capabilities regress, subtract only the proven lost weighted completion. Repairs restore that completion.
When mandatory scope changes, revise the denominator transparently and recalculate; do not fabricate progress.
Show at least 2 decimal places and enough precision to reveal a genuine nonzero delta. Never invent evidence or mark historical estimates as certified.
Keep evidence records, versioned task weights, source revisions and audit history. Never accept caller-supplied verified:true as proof.

## Integration requirements
- A single CORE calculator is the source of truth; projects supply versioned scope trees and evidence adapters, NOT custom formulas.
- Project UIs display the three values and their verified/estimated status without adding further percentages.
- Recompute on evidence, regression, scope, or checkpoint changes; preserve atomic snapshots and prior values for audit.
- Roll out through project LAB candidates and regression suites; never mutate approved project UI or production without authorization.
- This document is a specification candidate, NOT proof of rollout to all projects.
