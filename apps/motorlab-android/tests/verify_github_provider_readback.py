#!/usr/bin/env python3
"""Read-only GitHub provider proof for MotorLab AutoSetup.
This attests a remote GitHub commit, NEVER a third-party form submission.
"""
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request

def compare(branch, pull, ref_name, expected_sha, repo):
    if pull.get("number") != 44 or pull.get("state") != "open":
        return "ERROR_UNEXPECTED_PR"
    head=pull.get("head") or {}
    if head.get("ref") != ref_name:
        return "ERROR_UNEXPECTED_REF"
    if (head.get("repo") or {}).get("full_name") != repo:
        return "ERROR_FOREIGN_REPOSITORY"
    a=(branch.get("commit") or {}).get("sha","")
    b=head.get("sha","")
    if len(a)!=40 or len(b)!=40 or any(c not in "0123456789abcdef" for c in a+b):
        return "ERROR_INVALID_SHA"
    if a != b:
        return "ERROR_PROVIDER_INCONSISTENT"
    if a != expected_sha:
        return "STALE_RUN"
    return "MATCH"

def fetch_json(url, token):
    request=urllib.request.Request(url,headers={
        "Accept":"application/vnd.github+json",
        "Authorization":"Bearer "+token,
        "X-GitHub-Api-Version":"2022-11-28",
        "User-Agent":"MotorLab-AutoSetup-Readback-Gate"
    },method="GET")
    with urllib.request.urlopen(request,timeout=18) as response:
        return json.load(response)

def self_test():
    repo="example/MotorLab"
    ref="motorlab/app-lab05-unified-autosetup-20261013"
    sha="a"*40
    b={"commit":{"sha":sha}}
    p={"number":44,"state":"open","head":{"ref":ref,"repo":{"full_name":repo},"sha":sha}}
    assert compare(b,p,ref,sha,repo)=="MATCH"
    assert compare(b,p,ref,"b"*40,repo)=="STALE_RUN"
    assert compare(b,{**p,"number":45},ref,sha,repo)=="ERROR_UNEXPECTED_PR"
    assert compare(b,{**p,"head":{**p["head"],"sha":"b"*40}},ref,sha,repo)=="ERROR_PROVIDER_INCONSISTENT"
    assert compare(b,{**p,"head":{**p["head"],"repo":{"full_name":"other/repo"}}},ref,sha,repo)=="ERROR_FOREIGN_REPOSITORY"
    print("MOTORLAB_PROVIDER_READBACK_LOCAL_TEST=PASSED")

def main():
    if len(sys.argv)==2 and sys.argv[1]=="--self-test":
        self_test()
        return 0
    token=os.getenv("GH_TOKEN","")
    repo=os.getenv("GITHUB_REPOSITORY","")
    ref=os.getenv("GITHUB_REF_NAME","")
    sha=os.getenv("GITHUB_SHA","")
    if not token or repo.count("/")!=1 or not ref.startswith("motorlab/app-lab05-unified-autosetup-") or len(sha)!=40:
        print("MOTORLAB_PROVIDER_READBACK=BLOCKED_MISSING_CONTEXT")
        return 2
    try:
        owner,name=repo.split("/")
        base="https://api.github.com/repos/"+urllib.parse.quote(owner,safe="")+"/"+urllib.parse.quote(name,safe="")
        branch=fetch_json(base+"/branches/"+urllib.parse.quote(ref,safe=""),token)
        pull=fetch_json(base+"/pulls/44",token)
        result=compare(branch,pull,ref,sha,repo)
        if result=="MATCH":
            print("MOTORLAB_PROVIDER_READBACK=VERIFIED_GITHUB_BRANCH_AND_PR")
            print("MOTORLAB_PROVIDER_READBACK_SCOPE=GITHUB_COMMIT_ONLY_NOT_WEBSITE_FORM")
            return 0
        if result=="STALE_RUN":
            print("MOTORLAB_PROVIDER_READBACK=STALE_SHA_NOT_ATTESTED")
            return 0
        print("MOTORLAB_PROVIDER_READBACK=FAILED_PROVIDER_MISMATCH")
        return 1
    except (urllib.error.URLError, TimeoutError, ValueError, KeyError):
        print("MOTORLAB_PROVIDER_READBACK=UNAVAILABLE_NO_ATTESTATION")
        return 1

if __name__=="__main__":
    sys.exit(main())
