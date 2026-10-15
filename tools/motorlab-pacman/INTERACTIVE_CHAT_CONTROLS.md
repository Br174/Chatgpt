# Pac-Man — Interactive Chat Controls

Status: supported for non-secret choices in ChatGPT conversation; no privileged execution from UI alone.

Controls:
- Checkboxes for selecting one or more services.
- ON/OFF segmented controls (or equivalent switches) for tests and optional features.
- Radio groups for mutually exclusive actions.
- Disabled production option; LAB-only operations.
- Explicit confirmation checkbox before sending an action request.
- Button sends a new user turn with a clear, limited intent. It does not itself execute a GitHub or Cloudflare operation.
- On receiving the new turn, the assistant validates scope and available connector permissions before any side effect, and reports real evidence afterward.

Trust boundaries:
- Never put passwords, PATs, API tokens, signing keys or other secrets into any control whose callback sends chat text, including GenUI.issueNewTurn.
- A UI click is not a signed attestation for the Cloudflare Worker.
- No unattended automation, background action, or secret ingestion is implied by an interactive control.
- Reject attempts to select main/MADRE/production; require a separate explicit authorization and production-grade controls for any future production feature.
- Keep secret-submission controls disabled until a verified host-backed secret channel exists.

Acceptance:
1. Toggling controls updates the visible summary.
2. Submission stays disabled until a nonempty service selection and explicit confirmation.
3. Submitted text contains only non-sensitive choices and LAB scope.
4. Connected tools are used only after assistant receives the authorized turn and performs scope checks.

## Verified chat-to-GitHub execution — 2026-10-15

A user-authorized conversational turn (not a recorded button click) completed a reversible LAB GitHub Contents API probe:
- File: `tools/motorlab-pacman/chat-button-execution-probe-20261015.txt`
- Preflight: 404 absent.
- Create commit: `20b74c14726a94b88d6383e361fe014feda260c6`.
- Read-back: exact content verified; blob SHA `418ebb441740b7c2f4b57dd02130684943f9dc1a`.
- Delete commit: `23a9fa51071b594084aafc7f9dd43ef987444b4d`.
- Postflight: 404 absent.

This establishes authorized assistant-tool GitHub execution only. It does **not** establish that the interactive button was clicked, that the button directly calls GitHub, that Cloudflare execution works, or that credentials can be submitted securely in-chat.

## Interactive button acceptance still pending

The DIL control must send only the six allowlisted non-secret fields: `action`, `branch`, `confirmed`, `scope`, `services`, `tests`. The next assistant turn must validate the command, recheck current permissions and branch, then call the connected GitHub tool explicitly. Record a distinct button-triggered run before claiming end-to-end button acceptance. Never forward input values containing secrets via `GenUI.issueNewTurn`.
