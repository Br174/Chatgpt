import test from "node:test";
import assert from "node:assert/strict";
import {createChatAuthorizedCoordinator} from "../chat-coordinator.mjs";
const OPENAPI={openapi:"3.1.0",paths:{"/repos/Br174/Chatgpt/commits":{get:{operationId:"listCommits"}}}};
const NOW=1792410000000;
test("existing single Pac-Man coordinator owns dynamic capability discovery and client routing",()=>{
 const coordinator=createChatAuthorizedCoordinator();
 assert.equal(typeof coordinator.discoverReadCapabilities,"function");
 assert.equal(typeof coordinator.describeReadClients,"function");
 assert.equal(typeof coordinator.executeAuthenticatedClientRead,"function");
 assert.equal(typeof coordinator.reviewPendingReadOnlyDeployment,"function");
 assert.equal(coordinator.describeReadClients().length,3);
 const catalog=coordinator.discoverReadCapabilities({provider:"github",
  verifiedOrigin:"https://api.github.com",openapi:OPENAPI});
 assert.equal(catalog.count,1);
 assert.equal(catalog.operations["github:listCommits"].method,"GET");
 assert.equal(coordinator.executeSignedControlledRequest instanceof Function,true);
 assert.equal(coordinator.submitReadOnlyWorkflowApproval instanceof Function,true);
});
test("unconnected coordinator cannot turn chat text into protected GitHub reviewer consent",async()=>{
 const c=createChatAuthorizedCoordinator();
 await assert.rejects(()=>c.reviewPendingReadOnlyDeployment({prepared:{approved:true},attestation:{decision:"authorize"},
  runId:22,requestCommitSha:"a".repeat(40)}),/PACMAN_OWNER_REVIEW_HOST_NOT_CONNECTED/);
});
test("unconnected coordinator cannot claim Android/AI API live execution",async()=>{
 const c=createChatAuthorizedCoordinator(),catalog=c.discoverReadCapabilities({provider:"github",
  verifiedOrigin:"https://api.github.com",openapi:OPENAPI});
 await assert.rejects(()=>c.executeAuthenticatedClientRead({client:"android",catalog,
  request:{requestId:"LAB-test-1",operationId:"github:listCommits"},now:NOW}),
  /PACMAN_MULTICLIENT_HOLD_VERIFIED_HOST_REQUIRED/);
});
test("authenticated mock host can exercise exactly one GET through existing coordinator",async()=>{
 let networkReads=0;const events=[];
 const host={
  verifySession:async()=>({verified:true,authMethod:"connected-provider",audience:"pacman-chat",
   subject:"202558590",expiresAt:NOW+60000,provider:"github",ownerApprovedRead:true}),
  getAuthenticatedProvider:async()=>({authenticated:true,readOnce:async()=>{networkReads++;return {status:200}}}),
  audit:async x=>{events.push(x);return true}
 };
 const c=createChatAuthorizedCoordinator({multiClientTrustedHost:host});
 const catalog=c.discoverReadCapabilities({provider:"github",
  verifiedOrigin:"https://api.github.com",openapi:OPENAPI});
 const response=await c.executeAuthenticatedClientRead({client:"chatgpt",catalog,
  request:{requestId:"LAB-mock-1",operationId:"github:listCommits"},now:NOW});
 assert.equal(response.state,"READ_VERIFIED");assert.equal(networkReads,1);
 assert.deepEqual(events.map(x=>x.state),["READ_PREPARED","READ_VERIFIED"]);
});
test("OAuth reviewer host presence does not bypass missing real signed owner attestation",async()=>{
 let traffic=0;
 const c=createChatAuthorizedCoordinator({
  ownerReviewTrustedHost:{getOwnerAccessToken:async()=>"X".repeat(32),
   fetchImpl:async()=>{traffic++;return {status:200,json:async()=>({})};}}
 });
 await assert.rejects(()=>c.reviewPendingReadOnlyDeployment({
  prepared:{approved:true},attestation:{decision:"authorize"},runId:900,
  requestCommitSha:"a".repeat(40),now:NOW}),/PACMAN_REVIEW_WEBAUTHN_HOLD_/);
 assert.equal(traffic,0);
});

test("OAuth PKCE routes reuse existing coordinator, but no configured trusted host means no login",async()=>{
 const c=createChatAuthorizedCoordinator();
 assert.equal(typeof c.prepareGithubOwnerOAuth,"function");
 assert.equal(typeof c.completeGithubOwnerOAuth,"function");
 await assert.rejects(()=>c.prepareGithubOwnerOAuth({
  clientId:"Iv1_0123456789abcdef",
  redirectUri:"https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback",
  nowMs:1792410000000}),/PACMAN_GITHUB_OAUTH_PKCE_HOLD_TRUSTED_HTTPS_HOST_REQUIRED/);
 await assert.rejects(()=>c.completeGithubOwnerOAuth({
  clientId:"Iv1_0123456789abcdef",state:"A".repeat(43),
  code:"synthetic-oauth-code-12345",
  redirectUri:"https://motorlab-pacman-webauthn-staging-lab.motorlab-staging.workers.dev/oauth/github/callback",
  nowMs:1792410000000}),/PACMAN_GITHUB_OAUTH_PKCE_HOLD_TRUSTED_HTTPS_HOST_REQUIRED/);
});
