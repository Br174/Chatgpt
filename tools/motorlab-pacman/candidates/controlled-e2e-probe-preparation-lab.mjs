// Pac-Man Real Operations LAB: PURE, source-bound first-real-trial preparation.
// Does not use any connector, fetch, D1, secrets, WebAuthn or GitHub writes.
// A prepared intent is NOT a WebAuthn challenge or authorization to execute it.
// No real provider operation may be started without an independently obtained
// owner approval and an actual passkey ceremony for these exact parameters.
import {createHash} from "node:crypto";
import {validateControlledChatIntent} from "../chat-approval.mjs";
import {CONTROLLED_LAB_BRANCH,controlledLabPath}
 from "./github-controlled-update-lab.mjs";

export const FIRST_TRIAL_PATH=
 "tools/motorlab-pacman/lab-workspace/pacman-controlled-e2e-probe-20261018.txt";
export const FIRST_TRIAL_OPERATION="pacman-controlled-e2e-20261018-001";
export const FIRST_TRIAL_INITIAL=
 "PACMAN_CONTROLLED_E2E_PROBE_V1\n"+
 "state=READY_FOR_OWNER_APPROVAL\n"+
 "purpose=isolated-lab-webauthn-github-proof\n";
export const FIRST_TRIAL_UPDATED=
 "PACMAN_CONTROLLED_E2E_PROBE_V1\n"+
 "state=APPROVED_BIOMETRICALLY_AND_VERIFIED\n"+
 "purpose=isolated-lab-webauthn-github-proof\n";
export const FIRST_TRIAL_EXPECTED_BLOB_SHA=
 "b513e360ba9f7cbc2a76d7f6ff45633fffbb9dda";
export const FIRST_TRIAL_CONTENT_SHA256=
 "86044c4c3d9532a3d992901dea0cea7508502c94ff9645566dbc4095a6f02ab2";
const MAIN_SHA="8615e8321bf9896f28826a09aa0c9f61ce5ecbb7";
const hash=(kind,content)=>{
 const b=Buffer.from(content,"utf8");
 if(kind==="gitblob")return createHash("sha1").update(
  Buffer.concat([Buffer.from("blob "+b.length+"\x00"),b])).digest("hex");
 return createHash("sha256").update(b).digest("hex");
};
const fail=code=>{throw Error(code);};

export function prepareFirstRealControlledTrial({
 branch,path,blobSha,content,mainSha,mainProtected,
 labSha,expectedLabSha
}={}){
 if(branch!==CONTROLLED_LAB_BRANCH||path!==FIRST_TRIAL_PATH||
  !controlledLabPath(path)||mainSha!==MAIN_SHA||mainProtected!==true||
  !/^[a-f0-9]{40}$/.test(labSha||"")||
  expectedLabSha!==labSha)
  fail("FIRST_TRIAL_SCOPE_OR_HEAD_UNVERIFIED");
 if(content!==FIRST_TRIAL_INITIAL||
  hash("gitblob",content)!==FIRST_TRIAL_EXPECTED_BLOB_SHA||
  blobSha!==FIRST_TRIAL_EXPECTED_BLOB_SHA)
  fail("FIRST_TRIAL_FILE_OR_BLOB_MISMATCH");
 if(FIRST_TRIAL_UPDATED===FIRST_TRIAL_INITIAL||
  hash("sha256",FIRST_TRIAL_UPDATED)!==FIRST_TRIAL_CONTENT_SHA256)
  fail("FIRST_TRIAL_CONTENT_FINGERPRINT_INVALID");
 const intent=validateControlledChatIntent({
  operationId:FIRST_TRIAL_OPERATION,capability:"github.lab-file-update",
  branch:CONTROLLED_LAB_BRANCH,path:FIRST_TRIAL_PATH,
  expectedSha:blobSha,contentSha256:FIRST_TRIAL_CONTENT_SHA256
 });
 return Object.freeze({
  readiness:"PREPARED_PENDING_SEPARATE_OWNER_AUTHORIZATION",
  intent,proposedContent:FIRST_TRIAL_UPDATED,
  startingBlobSha:blobSha,proposedContentSha256:FIRST_TRIAL_CONTENT_SHA256,
  gitHubProviderWrites:0,biometricChallenges:0,remoteD1Mutations:0,
  mayExecute:false,mayIssueBiometricChallenge:false,
  mayUseSignedApproval:false,requiresSeparateScopedOwnerConsent:true,
  requiresFreshProviderPreflight:true
 });
}
