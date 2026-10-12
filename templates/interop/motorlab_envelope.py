#!/usr/bin/env python3
"""Standalone Python host adapter: validates a signed-by-host evidence envelope only.
No ChatGPT, Gemini, cloud API, shell execution, scheduler or project write.
"""
import json
import re
import sys

ID = re.compile(r"^[a-zA-Z0-9._:/-]{1,128}$")
SHA = re.compile(r"^[0-9a-f]{40}$")
EXPECTED = {"schema_version","project_id","operation_id","source_sha","action","host_executor_verified","scope_approved"}

def interpret_motorlab_envelope(payload):
    if not isinstance(payload, dict):
        return {"status":"REJECTED_INVALID_ENVELOPE"}
    if set(payload)-EXPECTED:
        return {"status":"REJECTED_UNEXPECTED_FIELD"}
    if (type(payload.get("schema_version")) is not int or payload["schema_version"] != 1 or
        not isinstance(payload.get("project_id"),str) or not ID.fullmatch(payload["project_id"]) or
        not isinstance(payload.get("operation_id"),str) or not ID.fullmatch(payload["operation_id"]) or
        not isinstance(payload.get("source_sha"),str) or not SHA.fullmatch(payload["source_sha"]) or
        payload.get("action") not in ("READ_STATUS","PROPOSE_CHANGE") or
        type(payload.get("host_executor_verified")) is not bool or
        type(payload.get("scope_approved")) is not bool):
        return {"status":"REJECTED_INVALID_ENVELOPE"}
    if payload["project_id"]=="Br174/Cover-Lab-AI":
        return {"status":"DORMANT_RESERVED"}
    if payload["action"]=="READ_STATUS":
        return {"status":"READ_ONLY_READY","operation_id":payload["operation_id"]}
    if not payload["scope_approved"]:
        return {"status":"APPROVAL_REQUIRED","operation_id":payload["operation_id"]}
    if not payload["host_executor_verified"]:
        return {"status":"PENDING_EXECUTOR","operation_id":payload["operation_id"]}
    return {"status":"ADAPTER_READY_NO_EXECUTION","operation_id":payload["operation_id"]}

if __name__=="__main__":
    try:
        print(json.dumps(interpret_motorlab_envelope(json.load(sys.stdin)),sort_keys=True))
    except (ValueError,TypeError,json.JSONDecodeError):
        print(json.dumps({"status":"REJECTED_INVALID_ENVELOPE"}))
