import test from "node:test";
import assert from "node:assert/strict";
import {preparePacmanOwnerGitHubAppRegistrationLab} from "./github-app-owner-registration-lab.mjs";
test("private GitHub App registration is on github.com, contains only minimal scoped permissions",()=>{
 const r=preparePacmanOwnerGitHubAppRegistrationLab();
 const u=new URL(r.registrationUrl);
 assert.equal(u.origin,"https://github.com");
 assert.equal(u.pathname,"/settings/apps/new");
 assert.equal(u.searchParams.get("public"),"false");
 assert.equal(u.searchParams.get("webhook_active"),"false");
 assert.equal(u.searchParams.get("request_oauth_on_install"),"false");
 assert.equal(u.searchParams.get("deployments"),"write");
 assert.equal(u.searchParams.get("actions"),"read");
 assert.equal(u.searchParams.get("contents"),"read");
 assert.equal(u.searchParams.getAll("callback_urls[]").length,1);
 assert.equal(u.searchParams.get("callback_urls[]"),r.callbackUrl);
 assert.equal(u.searchParams.get("url"),"https://github.com/Br174/Chatgpt");
 assert.deepEqual([...u.searchParams.keys()].sort(),[
 "actions","callback_urls[]","contents","deployments","description",
 "name","public","request_oauth_on_install","url","webhook_active"].sort());
});
test("app setup helper cannot manufacture GitHub identity, credentials or installed permission",()=>{
 const r=preparePacmanOwnerGitHubAppRegistrationLab();
 assert.equal(r.appCreated,false);assert.equal(r.appInstalled,false);
 assert.equal(r.oauthVerified,false);assert.equal(r.safeToAttemptLiveOAuth,false);
 assert.equal(r.workerDeployed,false);assert.equal(r.requiresOwnerGithubSignIn,true);
 const u=new URL(r.registrationUrl);
 assert.equal([...u.searchParams.values()].some(v=>/ghu_|ghs_|client.secret|api.token|password/i.test(v)),false);
});
