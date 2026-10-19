import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const source=fs.readFileSync(".github/workflows/pacman-chat-readonly-multiplex-protected-lab.yml","utf8");
const has=s=>source.includes(s);
const all=xs=>xs.forEach(x=>assert.ok(has(x),x));
const absent=xs=>xs.forEach(x=>assert.equal(has(x),false,x));
test("push only on new read command request, no manual or scheduled triggers",()=>{
 all(["on:","push:","read-command-requests/request-*.json"]);
 absent(["workflow_dispatch","repository_dispatch","schedule:","workflow_call:"]);
});
test("LAB source pinned and only first attempt permitted",()=>{
 all(["github.repository == 'Br174/Chatgpt'",
 "github.ref == 'refs/heads/motorlab/pacman-real-operations-lab-20261017'",
 "github.run_attempt == 1","github.event_name == 'push'"]);
});
test("single-writer request diff and source blob pin validated",()=>{
 all(["diff-tree","changedPaths.length!==1",
 "checkReadCommandTrigger({request,requestPath,changedPaths,parentSha,workflowSha,guardSha})"]);
});
test("mandatory protected existing reviewer environment",()=>{
 all(["needs: source-guard","needs.source-guard.result == 'success'",
 "environment: pacman-execution-staging"]);
});
test("post review HEAD and protected main checked independently",()=>{
 all(["PACMAN_CHAT_MULTI_OWNER_REVIEWED_HEAD_MAIN_PASS",
 "lab[0]?.sha!==process.env.GITHUB_SHA","main?.protected!==true",
 "8615e8321bf9896f28826a09aa0c9f61ce5ecbb7"]);
});
test("live Worker version pinned and protected Cloudflare metadata GET",()=>{
 all(["currentDeploymentVersion(meta)","version!==EXECUTION_VERSION",
 "CF_TOKEN: "+String.fromCharCode(36)+"{{ secrets.PACMAN_CF_API_TOKEN }}",
 "WORKER_VERSION_DRIFT"]);
 absent(["wrangler deploy","wrangler@","cloudflare/wrangler-action"]);
});
test("private Worker bearer only in protected workflow, not in printed output",()=>{
 all(["EXECUTION_KEY: "+String.fromCharCode(36)+"{{ secrets.PACMAN_EXECUTION_KEY }}",
 "headers.authorization='Bearer '+process.env.EXECUTION_KEY"]);
 absent(["console.log(process.env","console.log(headers)","console.log(meta)",
 "console.log(body)","console.log(response)"]);
});
test("only allowlisted GET target, no SQL or provider write",()=>{
 all(["response=await fetch(target.url,{method:'GET'","readCommandTarget(command)",
 "verifyReadCommandResult(command,response.status,body)"]);
 assert.equal(source.split("response=await fetch(target.url,").length,2);
 absent(["method:'PUT'","method:'POST'","method:'DELETE'","method:'PATCH'",
 "sql:","/execute'","db.prepare(",".run("]);
});
test("no retries and only privacy-safe result markers",()=>{
 all(["cancel-in-progress: false","PACMAN_CHAT_MULTI_RESULT=PASS",
 "PACMAN_CHAT_MULTI_PROOF=","PACMAN_CHAT_MULTI_ONE_GET_ZERO_WRITES_VERIFIED",
 "RESULT_HOLD"]);
 absent(["continue-on-error: true","retries:","retry(","console.log(data)"]);
});
test("Worker metadata gate applies only to Worker commands",()=>{
 all(["if(target.source==='worker')","if(target.authenticated)",
 "PACMAN_CHAT_MULTI_WORKER_VERSION_PINNED_PASS"]);
});
