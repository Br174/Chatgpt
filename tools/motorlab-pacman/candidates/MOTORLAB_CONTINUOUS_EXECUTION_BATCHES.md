# MotorLab — Continuous Execution Batches (LAB candidate)

## Default execution policy
After the user's initial approval of a defined scope, execute up to six meaningful, authorized development interventions consecutively without seeking redundant approval between progress updates. A progress update is informational, not a pause or permission gate.

## Intervention definition
One intervention is an independently meaningful change, fix, verification, or test with recorded evidence and outcome. Do not pad batches with trivial actions. Group work by dependency order, stopping earlier if a blocker makes further work unsafe or unproductive.

## Progress and reporting
At each checkpoint, display exactly three progress percentages (overall project, current phase, current activity), each with a signed delta in percentage points from a comparable previous checkpoint. Green for verified increases, red for verified regressions, neutral for unchanged, and unavailable when no comparable baseline exists. Distinguish estimated and verified values. Record every meaningful intermediate checkpoint, even if a user-visible summary is deferred until batch end.

## Authorization and hard stops
An initial approval never grants authority beyond its exact scope. Stop and request approval before changing repository/branch/path authorization, MADRE/main, production, deployment, real D1 or Cloudflare runtime, secrets, external access, spending, or other sensitive actions not explicitly covered. Preserve single-writer and anti-regression checks. Do not perform unapproved live write probes.

## Execution environment
Continue within the active response while tools and time permit. Do not claim asynchronous or background execution, or that work continues after a response without a scheduled task. At the end of a batch (default six interventions), give a compact status and next dependencies. If an error is recoverable within scope, fix and retest without stopping to ask permission.

## Scope of adoption
This is a shared MotorLab policy candidate for Pac-Man, MusicLab, StudyBook AI, MotorAI and other orchestrated projects. Committing this file to the Pac-Man LAB candidate does not deploy or modify the real shared CORE or other projects.
