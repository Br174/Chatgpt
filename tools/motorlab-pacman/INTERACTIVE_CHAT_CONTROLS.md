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
