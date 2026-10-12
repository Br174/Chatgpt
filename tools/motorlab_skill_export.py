#!/usr/bin/env python3
"""Reproducible OPTIONAL Skill Creator export from an allowlisted subset of MotorLab CORE.
The resulting ZIP is portable documentation, not an executable CORE or ChatGPT integration.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED, ZipInfo
import argparse
import hashlib
import json
import re

ALLOWLIST = (
    "MOTORLAB_CORE_ENTRYPOINT_V1.txt",
    "MOTORLAB_CHANGE_COMPATIBILITY_GUARD_V1.txt",
    "MOTORLAB_PROJECT_CONTINUITY_V1.txt",
    "MOTORLAB_RELEASE_MANIFEST_V1.txt",
    "MOTORLAB_REENTRY_GATE_V1.txt",
    "UAB_PROJECT_ROUTING.txt",
    "MOTORLAB_BIDIRECTIONAL_SYNC_V1.txt",
    "MOTORLAB_PERSISTENT_OPERATIONAL_STATE_V1.txt",
    "UAB_ADAPTER_SPEC_V1.txt",
)
LEAK = re.compile(r"(?:ghp_[A-Za-z0-9]{12,}|github_pat_[A-Za-z0-9_]{12,}|sk-proj-[A-Za-z0-9_-]{12,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|(?:api[_-]?key|password|access[_-]?token)\s*[=:]\s*['\"]?[A-Za-z0-9_-]{24,})",re.I)
SKILL_MD = """---
name: motorlab-core-companion
description: Read-only, optional MotorLab reference for safe project routing, re-entry, version compatibility and checkpointing. Apply alongside official CORE; never replace the live repository.
---
# MotorLab CORE companion (export, not authoritative)
Source of truth: private GitHub repository `Br174/Chatgpt` and its live project state. This ZIP is an optional frozen reference, not a duplicated scheduler, an active agent or a new MotorLab release.

Use the accompanying `references/` documents to understand:
1. Scope and change compatibility: identical rules supersede only same scope; contradictory rules require verified retirement; complementary rules remain.
2. Routing and re-entry: do not confuse **using** MotorLab in the current project with modifying MotorLab central CORE or another project.
3. Continuity: prefer live repository/provider evidence to this exported snapshot; preserve operation_id, checkpoint, LAST_GOOD, active locks and safe boundaries.
4. Project engines: use existing native engines; never modify Android sources, packages, signing, audio player or AI model merely to synchronize MotorLab metadata.
5. Cloud and other AI providers: optional; no required ChatGPT login/API key, no unapproved paid service, no false promise of 24/7 work.
6. Security: no confidential chats, secrets, identity documents or private chain-of-thought in evidence; preserve dormant Cover-Lab-AI exclusion.
7. Use an authenticated executor and explicit authorized scope for repository writes, builds, release promotion and background operations.

Each reference's SHA-256 is recorded in `references/manifest.json`. Re-export after canonical CORE updates. Importing this ZIP into a Skill Creator environment may require explicit user action and does NOT automatically enable any external connection.
"""

def build(root, output):
    root=Path(root).resolve()
    data={}
    for name in ALLOWLIST:
        p=(root/name).resolve()
        if p.parent!=root or not p.is_file():
            raise ValueError("missing allowlisted CORE file: "+name)
        raw=p.read_bytes()
        text=raw.decode("utf-8")
        if LEAK.search(text):
            raise ValueError("potential private credential detected, refusing export: "+name)
        data["references/"+name]=raw
    data["SKILL.md"]=SKILL_MD.encode("utf-8")
    hashes={k:hashlib.sha256(v).hexdigest() for k,v in sorted(data.items())}
    data["references/manifest.json"]=(json.dumps({"schema_version":1,"source":"Br174/Chatgpt","authority":"export_only","files_sha256":hashes},indent=2,sort_keys=True)+"\n").encode()
    output=Path(output).resolve()
    output.parent.mkdir(parents=True,exist_ok=True)
    with ZipFile(output,"w",ZIP_DEFLATED,compresslevel=9) as z:
        for path in sorted(data):
            entry=ZipInfo(path,(1980,1,1,0,0,0))
            entry.compress_type=ZIP_DEFLATED
            entry.external_attr=0o644<<16
            z.writestr(entry,data[path],compress_type=ZIP_DEFLATED,compresslevel=9)
    return output

if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--root",default=".")
    p.add_argument("--out",default="dist/MotorLab-Skill-Export.zip")
    args=p.parse_args()
    path=build(args.root,args.out)
    print("MOTORLAB_SKILL_EXPORT=CREATED file="+str(path)+" sha256="+hashlib.sha256(path.read_bytes()).hexdigest())
