#!/usr/bin/env python3
import argparse
import json
import math
import os
import re
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

SCHEMA_VERSION = 1
APPROVAL_SECONDS = {
    "BANAL": 10,
    "LESS_BANAL": 20,
    "IMPORTANT": 60,
    "VERY_IMPORTANT": 300,
}
PRIORITY_PATTERNS = (
    "questa ha priorità",
    "questo ha priorità",
    "prima fai questo",
    "prima fai questa",
    "ferma quello attuale",
    "ferma ciò che stai facendo",
    "interrompi e fai questo",
    "interrompi e fai questa",
)
CANCEL_PATTERNS = (
    "annulla quello precedente",
    "annulla la richiesta precedente",
    "non farlo più",
    "cancella quel task",
    "cancella quella richiesta",
)
REJECT_PATTERNS = (
    "non approvo",
    "non sono d'accordo",
    "non sono d’accordo",
    "rifiuto",
    "ferma l'approvazione",
    "ferma l’approvazione",
    "annulla approvazione",
)
APPROVE_PATTERNS = (
    "approvo",
    "approvato",
    "sì procedi",
    "si procedi",
    "va bene procedi",
)

def now_iso(ts=None):
    value = time.time() if ts is None else float(ts)
    return datetime.fromtimestamp(value, timezone.utc).isoformat().replace("+00:00", "Z")

def safe_id(value):
    return re.sub(r"[^A-Za-z0-9._-]", "_", str(value or "unknown"))[:160]

def repo_root(cwd):
    try:
        p = subprocess.run(["git", "-C", cwd, "rev-parse", "--show-toplevel"], text=True, capture_output=True, timeout=2)
        if p.returncode == 0 and p.stdout.strip():
            return Path(p.stdout.strip()).resolve()
    except Exception:
        pass
    return Path(cwd).resolve()

def state_dir(cwd):
    override = os.environ.get("MOTORLAB_RUNTIME_STATE_DIR", "").strip()
    if override:
        path = Path(override).resolve()
    else:
        try:
            p = subprocess.run(["git", "-C", cwd, "rev-parse", "--git-dir"], text=True, capture_output=True, timeout=2)
            if p.returncode == 0 and p.stdout.strip():
                raw = Path(p.stdout.strip())
                if not raw.is_absolute():
                    raw = Path(cwd) / raw
                path = raw.resolve() / "motorlab" / "runtime"
            else:
                raise RuntimeError("no git dir")
        except Exception:
            path = Path(tempfile.gettempdir()) / "motorlab-runtime"
    path.mkdir(parents=True, exist_ok=True)
    return path

def pointer_path(cwd):
    return state_dir(cwd) / "current-session"

def state_path(cwd, session_id):
    return state_dir(cwd) / f"{safe_id(session_id)}.json"

def blank_state(session_id):
    return {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_id,
        "checkpoint_seq": 0,
        "checkpoints": [],
        "active": None,
        "queue": [],
        "paused_stack": [],
        "barriers": {},
        "approval": None,
        "updated_at": now_iso(),
    }

def load_state(cwd, session_id):
    path = state_path(cwd, session_id)
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(data, dict) or data.get("schema_version") != SCHEMA_VERSION:
            return blank_state(session_id)
        return data
    except Exception:
        return blank_state(session_id)

def save_state(cwd, state):
    state["updated_at"] = now_iso()
    path = state_path(cwd, state["session_id"])
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(path)
    pointer_path(cwd).write_text(str(state["session_id"]), encoding="utf-8")

def resolve_session(cwd, explicit=None):
    if explicit:
        return explicit
    env = os.environ.get("CODEX_SESSION_ID", "").strip()
    if env:
        return env
    try:
        value = pointer_path(cwd).read_text(encoding="utf-8").strip()
        if value:
            return value
    except Exception:
        pass
    return "unknown"

def open_barriers(state):
    return [v for v in state.get("barriers", {}).values() if v.get("status") == "OPEN"]

def checkpoint(state, reason, turn_id=None, detail=None):
    state["checkpoint_seq"] = int(state.get("checkpoint_seq", 0)) + 1
    cp = {
        "seq": state["checkpoint_seq"],
        "created_at": now_iso(),
        "reason": reason,
        "turn_id": turn_id,
        "active_queue_id": (state.get("active") or {}).get("queue_id"),
        "active_status": (state.get("active") or {}).get("status"),
        "progress_floor": (state.get("active") or {}).get("progress_floor", 0),
        "next_safe_step": (state.get("active") or {}).get("next_safe_step"),
    }
    if detail:
        cp["detail"] = str(detail)[:1000]
    state.setdefault("checkpoints", []).append(cp)
    state["checkpoints"] = state["checkpoints"][-50:]
    return cp

def request_item(payload):
    turn_id = str(payload.get("turn_id") or f"turn-{int(time.time()*1000)}")
    return {
        "queue_id": f"q-{safe_id(turn_id)}-{int(time.time()*1000)}",
        "turn_id": turn_id,
        "prompt": str(payload.get("prompt") or "")[:12000],
        "created_at": now_iso(),
        "status": "RUNNING",
        "progress_floor": 0,
        "next_safe_step": "continue approved/current scope",
    }

def contains_any(text, patterns):
    low = text.casefold()
    return any(p.casefold() in low for p in patterns)

def approval_eval(state, now_value=None):
    approval = state.get("approval")
    if not approval:
        return None
    if approval.get("state") != "WAITING_USER":
        return approval
    current = time.time() if now_value is None else float(now_value)
    deadline = approval.get("auto_approve_at_epoch")
    if deadline is not None and current >= float(deadline):
        approval["state"] = "AUTO_APPROVED"
        approval["decision_at"] = now_iso(current)
        approval["decision_evidence"] = "eligible countdown elapsed without explicit rejection"
    return approval

def approval_view(approval, now_value=None):
    if not approval:
        return {"state": "NONE"}
    current = time.time() if now_value is None else float(now_value)
    deadline = approval.get("auto_approve_at_epoch")
    remaining = None
    if deadline is not None and approval.get("state") == "WAITING_USER":
        remaining = max(0, int(math.ceil(float(deadline) - current)))
    duration = int(approval.get("auto_approve_after_seconds") or 0)
    shown = duration if remaining is None else remaining
    mm, ss = divmod(shown, 60)
    return {
        "state": approval.get("state"),
        "category": approval.get("category"),
        "remaining_seconds": remaining,
        "auto_approve_after_seconds": approval.get("auto_approve_after_seconds"),
        "display": f"Prova ⏱ {mm:02d}:{ss:02d}" if approval.get("state") == "WAITING_USER" else f"Prova — {approval.get('state')}",
        "scope_hash": approval.get("scope_hash"),
    }

def next_after_completion(state):
    if open_barriers(state):
        return None
    if state.get("paused_stack"):
        item = state["paused_stack"].pop()
        item["status"] = "RUNNING"
        item["resumed_at"] = now_iso()
        state["active"] = item
        return ("resume_priority", item)
    if state.get("queue"):
        item = state["queue"].pop(0)
        item["status"] = "RUNNING"
        item["started_at"] = now_iso()
        state["active"] = item
        return ("dequeue", item)
    state["active"] = None
    return ("empty", None)

def hook_context(state):
    active = state.get("active")
    q = state.get("queue", [])
    barriers = open_barriers(state)
    parts = [
        "MotorLab runtime governance is active.",
        "Every user prompt is a checkpoint/wake event.",
        "Ordinary new requests queue FIFO and MUST NOT preempt the current operation.",
        "Only explicit Bruno priority wording may preempt at a safe checkpoint.",
        "Before naturally stopping a completed operation, run: python3 .codex/hooks/motorlab_runtime.py mark-complete",
        "For a real blocking defect, run open-barrier; close it only after root cause/prevention/verification are complete.",
    ]
    if active:
        parts.append(f"ACTIVE: {active.get('prompt','')[:1000]}")
    if q:
        parts.append(f"QUEUED: {len(q)} request(s); oldest={q[0].get('prompt','')[:500]}")
    if barriers:
        parts.append("BLOCKING BARRIERS: " + ", ".join(b.get("fingerprint","?") for b in barriers))
    return " ".join(parts)

def output_context(event, context, system_message=None):
    data = {
        "hookSpecificOutput": {
            "hookEventName": event,
            "additionalContext": context,
        }
    }
    if system_message:
        data["systemMessage"] = system_message
    sys.stdout.write(json.dumps(data, ensure_ascii=False))

def handle_prompt(payload, state):
    prompt = str(payload.get("prompt") or "")
    turn_id = str(payload.get("turn_id") or "")
    checkpoint(state, "USER_PROMPT_SUBMIT", turn_id, "automatic lightning/checkpoint")

    approval = state.get("approval")
    if approval and approval.get("state") == "WAITING_USER":
        if contains_any(prompt, REJECT_PATTERNS) or prompt.strip().casefold() in {"no", "no."}:
            approval["state"] = "EXPLICIT_REJECTED"
            approval["decision_at"] = now_iso()
            approval["decision_evidence"] = prompt[:1000]
            save_state(payload.get("cwd") or os.getcwd(), state)
            output_context("UserPromptSubmit", "MotorLab approval explicitly rejected by Bruno. Do not perform the protected write. Preserve the active operation/checkpoint and continue only safe work.", "MotorLab: approvazione rifiutata.")
            return
        if contains_any(prompt, APPROVE_PATTERNS):
            approval["state"] = "EXPLICIT_APPROVED"
            approval["decision_at"] = now_iso()
            approval["decision_evidence"] = prompt[:1000]
            save_state(payload.get("cwd") or os.getcwd(), state)
            output_context("UserPromptSubmit", "MotorLab approval explicitly granted by Bruno for the persisted scope. Continue from the current checkpoint subject to safety/barrier/single-writer checks.", "MotorLab: approvazione esplicita acquisita.")
            return

    item = request_item(payload)
    active = state.get("active")

    if contains_any(prompt, CANCEL_PATTERNS) and active:
        active["status"] = "CANCELLED_BY_USER"
        active["cancelled_at"] = now_iso()
        active["completion_requested"] = True
        advanced = next_after_completion(state)
        save_state(payload.get("cwd") or os.getcwd(), state)
        next_text = advanced[1].get("prompt","") if advanced and advanced[1] else "none"
        output_context("UserPromptSubmit", f"Bruno explicitly cancelled the prior active operation. Next eligible work: {next_text}. Preserve queue ordering and safety gates.", "MotorLab: cancellazione esplicita registrata.")
        return

    if active and active.get("status") not in {"COMPLETED", "CANCELLED_BY_USER", "FAILED_SAFE"}:
        if contains_any(prompt, PRIORITY_PATTERNS):
            active["status"] = "PAUSED_BY_PRIORITY"
            active["paused_at"] = now_iso()
            state.setdefault("paused_stack", []).append(active)
            item["priority_override"] = True
            state["active"] = item
            context = (
                "Explicit Bruno priority override detected. The previous operation was checkpointed and paused safely. "
                "Execute this priority request through normal approval/safety gates; when it completes, resume the paused operation before FIFO queue work."
            )
        else:
            item["status"] = "QUEUED"
            state.setdefault("queue", []).append(item)
            pos = len(state["queue"])
            context = (
                f"This new request is queued in FIFO position {pos}. DO NOT execute it now and do not treat it as cancellation. "
                "Resume the prior active MotorLab operation from the checkpoint created for this prompt. "
                f"Queued request: {prompt[:1500]}"
            )
    else:
        state["active"] = item
        context = "This request is the active MotorLab operation. Continue it from the current checkpoint until verified completion or a genuine blocker."

    save_state(payload.get("cwd") or os.getcwd(), state)
    output_context("UserPromptSubmit", context, "MotorLab: ⚡ checkpoint automatico registrato.")

def handle_stop(payload, state):
    cwd = payload.get("cwd") or os.getcwd()
    checkpoint(state, "STOP", payload.get("turn_id"), "stop gate evaluated")
    approval = approval_eval(state)

    barriers = open_barriers(state)
    if barriers:
        save_state(cwd, state)
        names = ", ".join(b.get("fingerprint","?") for b in barriers)
        sys.stdout.write(json.dumps({
            "decision": "block",
            "reason": f"MotorLab completion barrier open ({names}). Continue the active repair/root-cause/prevention/verification work from the latest checkpoint. Do not drain unrelated queue work. If a barrier genuinely requires Bruno/manual-only/external action, persist that blocker instead of looping.",
            "systemMessage": "MotorLab: barriera di completamento aperta."
        }, ensure_ascii=False))
        return

    if approval and approval.get("state") == "WAITING_USER":
        view = approval_view(approval)
        save_state(cwd, state)
        sys.stdout.write(json.dumps({
            "decision":"block",
            "reason": f"MotorLab approval countdown is still active: {view['display']}. Keep the current operation/checkpoint; wait or continue safe read-only preparation. Do not start the protected write before explicit or automatic approval.",
            "systemMessage": view["display"]
        }, ensure_ascii=False))
        return

    if approval and approval.get("state") in {"EXPLICIT_REJECTED", "MANUAL_ONLY"}:
        save_state(cwd, state)
        return

    active = state.get("active")
    if active and active.get("status") not in {"COMPLETED", "CANCELLED_BY_USER", "FAILED_SAFE"}:
        save_state(cwd, state)
        sys.stdout.write(json.dumps({
            "decision":"block",
            "reason": (
                "The current MotorLab operation is not terminal. Resume it from the latest checkpoint and finish it before unrelated queued work. "
                "When and only when it is fully verified with no blocking barrier, run: python3 .codex/hooks/motorlab_runtime.py mark-complete before stopping."
            ),
            "systemMessage":"MotorLab: operazione corrente ancora prioritaria."
        }, ensure_ascii=False))
        return

    if active and active.get("status") in {"COMPLETED", "CANCELLED_BY_USER", "FAILED_SAFE"}:
        advanced = next_after_completion(state)
        if advanced and advanced[1]:
            save_state(cwd, state)
            kind, item = advanced
            sys.stdout.write(json.dumps({
                "decision":"block",
                "reason": (
                    f"MotorLab automatically selected the next operation ({kind}) after checkpointed completion. "
                    f"Continue now with: {item.get('prompt','')}. Preserve FIFO/paused ordering, approval gates and single-writer safety."
                ),
                "systemMessage":"MotorLab: prossimo lavoro in coda avviato."
            }, ensure_ascii=False))
            return

    save_state(cwd, state)

def handle_hook(payload):
    event = str(payload.get("hook_event_name") or "")
    cwd = str(payload.get("cwd") or os.getcwd())
    session = str(payload.get("session_id") or "unknown")
    state = load_state(cwd, session)
    pointer_path(cwd).write_text(session, encoding="utf-8")

    if event == "UserPromptSubmit":
        handle_prompt(payload, state)
    elif event == "Stop":
        handle_stop(payload, state)
    elif event in {"PostToolUse", "Interrupt"}:
        checkpoint(state, event.upper(), payload.get("turn_id"), payload.get("tool_name"))
        save_state(cwd, state)
        if event == "PostToolUse" and state.get("active"):
            output_context(event, "MotorLab safe-point checkpoint saved. Preserve active operation priority, progress floor, completion barriers and FIFO queue ordering.")
    elif event == "SessionStart":
        checkpoint(state, "SESSION_START", payload.get("turn_id"), payload.get("source"))
        save_state(cwd, state)
        output_context(event, hook_context(state), "MotorLab runtime governance loaded.")
    else:
        save_state(cwd, state)

def cmd_show(args):
    cwd = os.getcwd()
    session = resolve_session(cwd, args.session)
    print(json.dumps(load_state(cwd, session), ensure_ascii=False))

def cmd_complete(args):
    cwd = os.getcwd()
    session = resolve_session(cwd, args.session)
    state = load_state(cwd, session)
    active = state.get("active")
    if not active:
        print(json.dumps({"state":"NO_ACTIVE_OPERATION"}))
        return
    active["completion_requested"] = True
    active["completion_requested_at"] = now_iso()
    if not open_barriers(state):
        active["status"] = "COMPLETED"
        active["completed_at"] = now_iso()
    checkpoint(state, "MARK_COMPLETE", None, args.summary)
    save_state(cwd, state)
    print(json.dumps({"state":active["status"],"barriers_open":len(open_barriers(state))}))

def cmd_open_barrier(args):
    cwd = os.getcwd()
    session = resolve_session(cwd, args.session)
    state = load_state(cwd, session)
    fp = safe_id(args.fingerprint)
    existing = state.setdefault("barriers", {}).get(fp)
    if existing and existing.get("status") == "OPEN":
        existing["last_seen_at"] = now_iso()
        existing["evidence_count"] = int(existing.get("evidence_count",1)) + 1
        existing["reason"] = existing.get("reason") or args.reason
    else:
        state["barriers"][fp] = {
            "fingerprint": fp,
            "reason": args.reason,
            "status": "OPEN",
            "opened_at": now_iso(),
            "last_seen_at": now_iso(),
            "evidence_count": 1,
            "progress": 0,
        }
    checkpoint(state, "BARRIER_OPEN", None, fp)
    save_state(cwd, state)
    print(json.dumps(state["barriers"][fp], ensure_ascii=False))

def cmd_close_barrier(args):
    cwd = os.getcwd()
    session = resolve_session(cwd, args.session)
    state = load_state(cwd, session)
    fp = safe_id(args.fingerprint)
    barrier = state.setdefault("barriers", {}).get(fp)
    if not barrier:
        print(json.dumps({"error":"BARRIER_NOT_FOUND","fingerprint":fp}))
        return
    barrier["status"] = "CLOSED_VERIFIED"
    barrier["progress"] = 100
    barrier["verification"] = args.verification
    barrier["closed_at"] = now_iso()
    active = state.get("active")
    if active and active.get("completion_requested") and not open_barriers(state):
        active["status"] = "COMPLETED"
        active["completed_at"] = now_iso()
    checkpoint(state, "BARRIER_CLOSED_VERIFIED", None, fp)
    save_state(cwd, state)
    print(json.dumps(barrier, ensure_ascii=False))

def cmd_categories(args):
    print(json.dumps(APPROVAL_SECONDS))

def cmd_approval_start(args):
    cwd = os.getcwd()
    session = resolve_session(cwd, args.session)
    state = load_state(cwd, session)
    category = args.category.upper()
    if category not in APPROVAL_SECONDS:
        raise SystemExit(f"invalid category: {category}")
    start = float(args.now) if args.now is not None else time.time()
    seconds = APPROVAL_SECONDS[category]
    approval = {
        "approval_id": f"a-{int(start*1000)}",
        "scope_hash": args.scope_hash,
        "category": category,
        "classification_rationale": args.rationale,
        "timer_started_at": now_iso(start),
        "auto_approve_after_seconds": seconds,
        "auto_approve_at_epoch": None if args.manual_only else start + seconds,
        "auto_approve_at": None if args.manual_only else now_iso(start + seconds),
        "state": "MANUAL_ONLY" if args.manual_only else "WAITING_USER",
    }
    state["approval"] = approval
    checkpoint(state, "APPROVAL_START", None, category)
    save_state(cwd, state)
    print(json.dumps(approval_view(approval, start), ensure_ascii=False))

def cmd_approval_eval(args):
    cwd = os.getcwd()
    session = resolve_session(cwd, args.session)
    state = load_state(cwd, session)
    current = float(args.now) if args.now is not None else time.time()
    approval_eval(state, current)
    save_state(cwd, state)
    print(json.dumps(approval_view(state.get("approval"), current), ensure_ascii=False))

def cmd_approval_wait(args):
    cwd = os.getcwd()
    session = resolve_session(cwd, args.session)
    while True:
        state = load_state(cwd, session)
        approval_eval(state)
        save_state(cwd, state)
        view = approval_view(state.get("approval"))
        print(view.get("display", "Prova — NONE"), flush=True)
        if view.get("state") != "WAITING_USER":
            return
        time.sleep(1)

def parser():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="command")
    s = sub.add_parser("show-state"); s.add_argument("--session")
    s = sub.add_parser("mark-complete"); s.add_argument("--session"); s.add_argument("--summary", default="")
    s = sub.add_parser("open-barrier"); s.add_argument("--session"); s.add_argument("--fingerprint", required=True); s.add_argument("--reason", required=True)
    s = sub.add_parser("close-barrier"); s.add_argument("--session"); s.add_argument("--fingerprint", required=True); s.add_argument("--verification", required=True)
    sub.add_parser("approval-categories")
    s = sub.add_parser("approval-start"); s.add_argument("--session"); s.add_argument("--category", required=True); s.add_argument("--scope-hash", required=True); s.add_argument("--rationale", default=""); s.add_argument("--now", type=float); s.add_argument("--manual-only", action="store_true")
    s = sub.add_parser("approval-evaluate"); s.add_argument("--session"); s.add_argument("--now", type=float)
    s = sub.add_parser("approval-wait"); s.add_argument("--session")
    return p

def main():
    p = parser()
    if len(sys.argv) > 1:
        args = p.parse_args()
        commands = {
            "show-state": cmd_show,
            "mark-complete": cmd_complete,
            "open-barrier": cmd_open_barrier,
            "close-barrier": cmd_close_barrier,
            "approval-categories": cmd_categories,
            "approval-start": cmd_approval_start,
            "approval-evaluate": cmd_approval_eval,
            "approval-wait": cmd_approval_wait,
        }
        if args.command not in commands:
            p.print_help()
            return 2
        commands[args.command](args)
        return 0
    try:
        payload = json.load(sys.stdin)
    except Exception:
        return 0
    handle_hook(payload)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
